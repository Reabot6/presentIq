from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.groq_client import client as groq_client
from app.services.session_memory import SessionMemory
from app.websocket.manager import session_memories
from app.config import settings
import json
import re

# call stack anchor: routers/quiz.py
# POST /api/quiz/start   — get first question for this session
# POST /api/quiz/message — send answer, get grade + next question (or off_topic / banned flags)
# POST /api/quiz/finish  — finalise quiz, get readiness report

router = APIRouter(prefix="/api/quiz", tags=["quiz"])

QUIZ_QUESTION_COUNT = 5   # total questions per quiz
MAX_OFF_TOPIC = 2         # warnings before ban (1 warning = strike 1, 2nd = banned)


class QuizStartRequest(BaseModel):
    session_id: int
    topic_map: dict | None = None   # sent from frontend after doc upload


class QuizMessageRequest(BaseModel):
    session_id: int
    user_answer: str
    current_question: str
    current_topic: str


class QuizFinishRequest(BaseModel):
    session_id: int


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/start")
async def start_quiz(body: QuizStartRequest):
    """
    call stack: POST /api/quiz/start
      → creates SessionMemory if WS hasn't opened yet (quiz runs before practice)
      → seeds topic_map from request body if provided
      → asks Groq to generate first question
    """
    # Auto-create SessionMemory if WebSocket hasn't opened yet
    # This is normal — quiz runs before the practice WS connection
    mem = session_memories.get(body.session_id)
    if not mem:
        mem = SessionMemory()
        session_memories[body.session_id] = mem

    # Seed topic_map from request if provided and not already set
    if body.topic_map and not mem.topic_map:
        mem.topic_map = body.topic_map

    # Block if already banned from a previous attempt
    if getattr(mem, 'quiz_banned', False):
        raise HTTPException(403, "Quiz access revoked due to repeated off-topic answers.")

    allowed, wait = mem.check_rate_limit()
    if not allowed:
        raise HTTPException(429, f"Slow down — wait {wait} seconds before next message.")

    topic_map = mem.topic_map
    if not topic_map:
        raise HTTPException(400, "No document uploaded. Upload material before taking the quiz.")

    # Reset off-topic counter fresh every time /start is called
    # (new session = clean slate, previous ban doesn't carry over)
    mem.off_topic_warnings = 0
    mem.quiz_banned = False

    question_data = await _generate_first_question(topic_map)
    return {
        "question": question_data["question"],
        "topic": question_data["topic"],
        "coach_intro": question_data.get("intro", ""),
        "questions_remaining": QUIZ_QUESTION_COUNT,
        "total_questions": QUIZ_QUESTION_COUNT,
    }


@router.post("/message")
async def quiz_message(body: QuizMessageRequest):
    """
    call stack: POST /api/quiz/message
      → rate limit check
      → off-topic relevance check (baked into Groq grade call)
      → if off_topic and warnings == 0: warn, increment counter
      → if off_topic and warnings == 1: ban, return banned=True
      → if on-topic: grade answer, generate next question
      → records answer in SessionMemory.quiz_history
    """
    mem = session_memories.get(body.session_id)
    if not mem:
        raise HTTPException(404, "Session not found.")

    # Hard block — already banned
    if getattr(mem, 'quiz_banned', False):
        return {
            "banned": True,
            "off_topic": True,
            "feedback": "This quiz session has been ended.",
            "score": 0,
            "is_final": True,
        }

    # Rate limit
    allowed, wait = mem.check_rate_limit()
    if not allowed:
        raise HTTPException(429, f"Take a breath — wait {wait} seconds before continuing.")

    # ── Return-phrase detection (pre-Groq, zero API cost) ────────────────────
    # Catches apologies/re-engagement attempts — don't penalise, just repeat question
    answer_lower = body.user_answer.lower().strip()
    RETURN_PHRASES = [
        "sorry", "i'm sorry", "im sorry", "apolog", "my bad", "let's get back",
        "lets get back", "back to", "return to", "i'll focus", "ill focus",
        "let me answer", "let me try", "i'll try", "ill try", "ok let's",
        "ok lets", "got it", "understood", "noted", "back on track",
        "refocus", "re-focus", "stay on topic", "on topic", "continue",
        "let's continue", "lets continue", "move on", "next question",
    ]
    is_return_attempt = any(phrase in answer_lower for phrase in RETURN_PHRASES)

    if is_return_attempt:
        # They're re-engaging — don't penalise this message, but DON'T reset
        # the warning counter. It's cumulative for the whole quiz session.
        # They still only get 2 total off-topic strikes, regardless of apologies.
        return {
            "off_topic": False,
            "banned": False,
            "score": 0,
            "is_repeat": True,
            "feedback": "Good — let's pick up where we left off:",
            "is_final": False,
            "next_question": body.current_question,
            "next_topic": body.current_topic,
            "questions_answered": mem.quiz_questions_asked,
            "total_questions": QUIZ_QUESTION_COUNT,
        }

    is_final = mem.quiz_questions_asked >= QUIZ_QUESTION_COUNT - 1

    result = await _grade_and_continue(
        topic_map=mem.topic_map,
        question=body.current_question,
        topic=body.current_topic,
        answer=body.user_answer,
        quiz_history=mem.quiz_history,
        is_final=is_final,
    )

    # ── Off-topic handling ────────────────────────────────────────────────────
    if result.get("off_topic"):
        warnings = getattr(mem, 'off_topic_warnings', 0)

        if warnings >= 1:
            # Second offence — ban
            mem.quiz_banned = True
            return {
                "off_topic": True,
                "banned": True,
                "feedback": (
                    "That's your second off-topic message. "
                    "This quiz has been ended. Stay focused when you present — your audience won't give you a second chance either."
                ),
                "score": 0,
                "is_final": True,
                "questions_answered": mem.quiz_questions_asked,
            }
        else:
            # First offence — warn
            mem.off_topic_warnings = warnings + 1
            return {
                "off_topic": True,
                "banned": False,
                "feedback": (
                    "Stay focused — that's outside your material. Let's keep going. "
                    "One more off-topic message and this quiz session will end."
                ),
                "score": 0,
                "is_final": False,
                "next_question": body.current_question,   # repeat the same question
                "next_topic": body.current_topic,
                "questions_answered": mem.quiz_questions_asked,
            }

    # ── On-topic: record and continue ────────────────────────────────────────
    mem.record_quiz_answer(
        question=body.current_question,
        answer=body.user_answer,
        score=result["score"],
        feedback=result["feedback"],
        topic=body.current_topic,
    )

    response = {
        "off_topic": False,
        "banned": False,
        "score": result["score"],
        "feedback": result["feedback"],
        "is_final": is_final,
        "questions_answered": mem.quiz_questions_asked,
        "total_questions": QUIZ_QUESTION_COUNT,
    }

    if not is_final:
        response["next_question"] = result.get("next_question", "")
        response["next_topic"]    = result.get("next_topic", "")

    return response


@router.post("/finish")
async def finish_quiz(body: QuizFinishRequest):
    """
    call stack: POST /api/quiz/finish
      → SessionMemory.finalise_quiz()
      → returns readiness score, weak areas, strong areas, advice
    """
    mem = session_memories.get(body.session_id)
    if not mem:
        raise HTTPException(404, "Session not found.")

    mem.finalise_quiz()

    ready = mem.quiz_score >= 70
    return {
        "readiness_score": mem.quiz_score,
        "ready": ready,
        "weak_areas": mem.weak_areas,
        "strong_areas": mem.strong_areas,
        "message": (
            f"You're ready. Watch out for: {', '.join(mem.weak_areas)}. "
            f"We'll flag these during your session."
            if ready and mem.weak_areas
            else "You're well prepared. Let's go." if ready
            else f"Review these before presenting: {', '.join(mem.weak_areas or ['your key points'])}."
        ),
        "can_start": True,
    }


# ── Groq helpers ──────────────────────────────────────────────────────────────

async def _generate_first_question(topic_map: dict) -> dict:
    """
    call stack: start_quiz → _generate_first_question → Groq
    """
    key_points    = topic_map.get("key_points", [])
    key_questions = topic_map.get("key_questions_to_answer", [])
    title         = topic_map.get("title", "your presentation")

    prompt = f"""You are a sharp, direct presentation coach sitting across from someone who is about to present on "{title}".

You're not grading a form — you're talking to them directly. Use "you" and "your". Be warm but don't waste words.

Their presentation covers: {', '.join(key_points[:5])}
Questions their audience will throw at them: {', '.join(key_questions[:3])}

Ask your FIRST question to test if they actually know their material.
Pick the most important topic. Make it feel like a real conversation, not a test.
Don't say "Question 1:" or number it. Just ask it naturally.

Respond ONLY with valid JSON, no markdown:
{{
  "intro": "<one warm, direct sentence to open — e.g. 'Alright, let's see how ready you are.' or 'Before we go live, I want to make sure you've got this down.'>",
  "question": "<your question, addressed directly to them using 'you' — specific, not generic>",
  "topic": "<the topic this tests, e.g. 'revenue model'>"
}}"""

    response = await groq_client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
        max_tokens=200,
    )
    raw = _clean_json(response.choices[0].message.content)
    try:
        return json.loads(raw)
    except Exception:
        return {
            "intro": "Let's make sure you're ready. A few quick questions.",
            "question": "Walk me through the core problem your presentation addresses.",
            "topic": "core problem",
        }


async def _grade_and_continue(
    topic_map: dict,
    question: str,
    topic: str,
    answer: str,
    quiz_history: list,
    is_final: bool,
) -> dict:
    """
    call stack: quiz_message → _grade_and_continue → Groq

    Key addition: Groq now checks relevance FIRST.
    If the answer is completely unrelated to the question and topic_map,
    it returns off_topic: true and we never record the answer.
    """
    covered_topics   = [q.get("topic", "") for q in quiz_history]
    key_points       = topic_map.get("key_points", [])
    remaining_topics = [p for p in key_points if p not in covered_topics]
    title            = topic_map.get("title", "their presentation")

    next_instruction = (
        "This was the last question. Set next_question and next_topic to empty strings."
        if is_final
        else (
            f"Generate the next question covering remaining topics: {', '.join(remaining_topics[:3])}. "
            f"Do not repeat covered topics: {', '.join(covered_topics)}."
        )
    )

    prompt = f"""You are a presentation coach in a live coaching session with someone preparing to present on "{title}".

You speak directly to them — use "you", "your", "you said". You're not writing a report. You're talking to them.

Their material covers: {', '.join(key_points[:6])}
You just asked them about: "{topic}"
Your question was: "{question}"
They answered: "{answer}"

STEP 1 — IS THIS ANSWER RELEVANT?
Are they genuinely trying to answer your question about "{topic}"?
- Mark off_topic TRUE only if they're completely ignoring the question — asking you something unrelated, typing nonsense, testing the system, or talking about a totally different subject.
- A wrong answer, a vague answer, a short answer, or a nervous answer → off_topic FALSE. Grade it.
- If they're apologising or trying to refocus → off_topic FALSE, score 0, note it in feedback.

STEP 2 — GIVE THEM FEEDBACK (only if off_topic is false):
Talk to them directly. Tell them what they got right, what they missed, what they need to sharpen.
Score 0-10:
- 0-4: they clearly don't know it — be direct, tell them what's missing
- 5-6: partially there — tell them what they hit and what they skipped
- 7-8: solid — acknowledge it, note the gap
- 9-10: nailed it — tell them so, move on

STEP 3 — NEXT QUESTION:
{next_instruction}
Ask it like you're talking to them. No numbering. Natural.

Respond ONLY with valid JSON, no markdown:
{{
  "off_topic": <true|false>,
  "score": <int 0-10>,
  "feedback": "<your direct feedback to them — 1-2 sentences, use 'you' not 'the presenter'>",
  "next_question": "<your next question to them, or empty string if final>",
  "next_topic": "<topic the next question covers, or empty string if final>"
}}"""

    response = await groq_client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=320,
    )
    raw = _clean_json(response.choices[0].message.content)
    try:
        return json.loads(raw)
    except Exception:
        return {
            "off_topic": False,
            "score": 5,
            "feedback": "Answer recorded.",
            "next_question": "What's the main outcome you want your audience to remember?",
            "next_topic": "key takeaway",
        }


def _clean_json(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text