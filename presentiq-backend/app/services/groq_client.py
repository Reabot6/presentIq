from groq import AsyncGroq
from app.config import settings
import json
import re

# call stack anchor: groq_client.py
# Three entry points:
#   1. generate_feedback()     — event-driven live coaching (WS manager)
#   2. transcribe_audio_chunk() — Whisper STT
#   3. summarize_transcript()  — rolling 30s summary update

client = AsyncGroq(api_key=settings.GROQ_API_KEY)


async def generate_feedback(
    charisma_scores: dict,
    trigger: str,
    memory_context: dict,
    time_elapsed_seconds: int,
    total_duration_seconds: int,
    filler_total: int = 0,
    coverage_percent: float = 0,
    uncovered_keywords: list = None,
    keyword_hit: str = None,
) -> dict:
    """
    call stack: websocket/manager.py::_request_feedback → generate_feedback → Groq

    Uses memory_context (not raw transcript) — includes:
      - doc title + summary (from upload)
      - rolling 90s transcript
      - confirmed points covered
      - quiz weak_areas → watched extra closely during live session
      - last 2 feedback messages (anti-repeat)
    """
    uncovered_keywords = uncovered_keywords or []
    time_remaining = total_duration_seconds - time_elapsed_seconds
    time_pressure = (
        "CRITICAL — under 1 minute left" if time_remaining < 60
        else "urgent — under 3 minutes" if time_remaining < 180
        else "comfortable"
    )

    # Trigger-specific instruction — coach focuses on what matters NOW
    trigger_instruction = {
        "filler_spike": f"PRIORITY: Filler word spike detected ({filler_total} total). Address this first.",
        "keyword": f"PRIORITY: Presenter just mentioned '{keyword_hit}' — a key topic. Acknowledge and guide what's next.",
        "words": "Balanced mid-session check — most impactful thing to improve.",
        "posture": "PRIORITY: Persistent posture issue. Address this.",
        "pace": "PRIORITY: Speech pace problem detected.",
        "structure": "PRIORITY: Presenter drifting from their document structure. Guide them back.",
        "weak_area": f"PRIORITY: Presenter is covering a topic they struggled with in the quiz. Give extra encouragement and guidance.",
    }.get(trigger, "Give balanced feedback on the most impactful issue right now.")

    # Doc context from memory — never re-uploads the document
    doc_context = ""
    if memory_context.get("doc_title"):
        doc_context = f"""PRESENTATION CONTEXT (from uploaded document):
Title: {memory_context.get('doc_title', '')}
Summary: {memory_context.get('doc_summary', '')}
Expected flow: {' → '.join(memory_context.get('expected_flow', []))}
Points confirmed covered: {', '.join(memory_context.get('confirmed_points', [])) or 'none yet'}"""

    # Quiz weak areas — these get flagged if presenter covers/avoids them
    weak_areas = memory_context.get("weak_areas", [])
    weak_area_str = ""
    if weak_areas:
        weak_area_str = f"\nQUIZ WEAK AREAS (watch closely): {', '.join(weak_areas)}"

    # Anti-repeat — don't echo last 2 tips
    last_tips = list(memory_context.get("last_feedback", {}).values())[-2:]
    anti_repeat = f"\nDO NOT repeat these recent tips: {last_tips}" if last_tips else ""

    prompt = f"""You are a real-time presentation coach. The presenter is actively speaking — be concise and direct.

{doc_context}
{weak_area_str}

CHARISMA (0–1 scale):
- Eye contact: {charisma_scores.get('eye_contact', 0):.2f}
- Posture: {charisma_scores.get('posture', 0):.2f}
- Gesture: {charisma_scores.get('gesture', 0):.2f}

SPEECH:
- Filler words: {filler_total} total, {memory_context.get('filler_rate', 0):.1f}% rate
- Content covered: {coverage_percent:.0f}%
- Uncovered topics: {', '.join(uncovered_keywords[:3]) or 'none'}

RECENT SPEECH (last 90s):
{memory_context.get('recent_speech', '')[-500:]}

SESSION MEMORY:
{memory_context.get('summary_memory', 'Session just started.')}

TIME: {time_elapsed_seconds}s / {total_duration_seconds}s — {time_pressure}

{trigger_instruction}
{anti_repeat}

Respond ONLY with valid JSON:
{{
  "overall_score": <float 0-100>,
  "top_issue": "<most important fix RIGHT NOW — max 12 words>",
  "quick_tip": "<one sentence they can act on immediately>",
  "time_advice": "<specific advice for time remaining>",
  "strengths": ["<genuine strength 1>", "<genuine strength 2>"],
  "severity": "<low|medium|high>",
  "category": "<eye_contact|posture|gesture|filler|pace|content|structure>",
  "metrics": {{
    "eye_contact_label": "<Poor|Fair|Good|Excellent>",
    "posture_label": "<Poor|Fair|Good|Excellent>",
    "pace_label": "<Too slow|Good|Too fast>",
    "filler_label": "<High|Moderate|Low>"
  }}
}}"""

    response = await client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=500,
    )

    raw = _clean_json(response.choices[0].message.content)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {
            "overall_score": 50.0,
            "top_issue": "Keep going — stay focused",
            "quick_tip": "Move to your next key point.",
            "time_advice": f"{time_remaining}s remaining.",
            "strengths": [],
            "severity": "low",
            "category": "general",
            "metrics": {},
        }


async def summarize_transcript(
    current_summary: str,
    new_chunk: str,
    session_goal: str,
) -> str:
    """
    call stack: websocket/manager.py (every 30s) → summarize_transcript
    Replaces old summary — never appends raw text.
    """
    prompt = f"""Update this presentation coaching session summary.

Goal: {session_goal}
Previous summary: {current_summary or "Session just started."}
New speech (last 30s): {new_chunk}

Write a NEW 2-3 sentence summary of the full session so far.
Cover: topics addressed, recurring issues, overall trajectory.
No bullet points. Be factual and brief."""

    response = await client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=150,
    )
    return response.choices[0].message.content.strip()


async def transcribe_audio_chunk(audio_bytes: bytes, language: str = "en") -> str:
    """
    call stack: routers/analysis.py → transcribe_audio_chunk → Groq Whisper
    """
    response = await client.audio.transcriptions.create(
        file=("chunk.webm", audio_bytes, "audio/webm"),
        model="whisper-large-v3",
        language=language,
        response_format="text",
    )
    return response


def _clean_json(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text