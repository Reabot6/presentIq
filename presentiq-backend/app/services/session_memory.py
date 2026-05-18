from dataclasses import dataclass, field
import time

# call stack anchor: session_memory.py
# Single memory object per session — spans quiz AND live coaching.
# Quiz weak areas feed directly into live feedback priority.
#
# Timeline:
#   1. topic_map loaded from doc upload (once)
#   2. quiz_history built during pre-session quiz
#   3. weak_areas identified → watched during live session
#   4. summary_memory + rolling_transcript used during live coaching


@dataclass
class SessionMemory:

    # ── Document context (computed once at upload) ──────────────────────
    topic_map: dict = field(default_factory=dict)

    # ── Quiz state (pre-session) ─────────────────────────────────────────
    quiz_history: list = field(default_factory=list)
    # Each entry: { question, answer, score (0-10), feedback, topic }

    quiz_score: float = 0.0
    weak_areas: list = field(default_factory=list)
    strong_areas: list = field(default_factory=list)
    quiz_complete: bool = False
    quiz_questions_asked: int = 0

    # Rate limiting — checked before every Groq quiz call
    _message_timestamps: list = field(default_factory=list)
    RATE_LIMIT_MAX: int = 10
    RATE_LIMIT_WINDOW: int = 60

    # ── Live session state ───────────────────────────────────────────────
    summary_memory: str = ""
    rolling_transcript: str = ""
    confirmed_points: list = field(default_factory=list)

    last_feedback: dict = field(default_factory=dict)
    last_feedback_time: dict = field(default_factory=dict)

    session_goal: str = "general presentation"
    total_duration: int = 300
    elapsed: int = 0

    words_since_feedback: int = 0
    total_words: int = 0
    filler_total: int = 0
    filler_window: list = field(default_factory=list)

    COOLDOWNS: dict = field(default_factory=lambda: {
        "filler_spike": 12,
        "keyword": 8,
        "words": 20,
        "posture": 15,
        "pace": 15,
        "structure": 30,
        "weak_area": 10,
    })

    # ── Rate limiting ────────────────────────────────────────────────────

    def check_rate_limit(self) -> tuple:
        """
        call stack: routers/quiz.py → check_rate_limit
        Returns (allowed: bool, seconds_until_reset: int)
        """
        now = time.time()
        self._message_timestamps = [
            t for t in self._message_timestamps
            if now - t < self.RATE_LIMIT_WINDOW
        ]
        if len(self._message_timestamps) >= self.RATE_LIMIT_MAX:
            oldest = self._message_timestamps[0]
            wait = int(self.RATE_LIMIT_WINDOW - (now - oldest)) + 1
            return False, wait
        self._message_timestamps.append(now)
        return True, 0

    # ── Live session cooldowns ───────────────────────────────────────────

    def can_fire(self, category: str) -> bool:
        last = self.last_feedback_time.get(category, 0)
        cooldown = self.COOLDOWNS.get(category, 10)
        return (time.time() - last) >= cooldown

    def mark_fired(self, category: str, text: str):
        self.last_feedback_time[category] = time.time()
        self.last_feedback[category] = text

    # ── Transcript management ────────────────────────────────────────────

    def add_transcript_chunk(self, text: str, words: list):
        self.rolling_transcript += " " + text
        all_words = self.rolling_transcript.split()
        if len(all_words) > 300:
            self.rolling_transcript = " ".join(all_words[-300:])
        self.total_words += len(words)
        self.words_since_feedback += len(words)

    def update_filler_window(self, words: list) -> int:
        FILLERS = {"um", "uh", "like", "basically", "literally",
                   "actually", "so", "right", "you know", "kind of", "sort of"}
        self.filler_window.extend(words)
        self.filler_window = self.filler_window[-15:]
        return sum(1 for w in self.filler_window if w in FILLERS)

    def confirm_point(self, point: str):
        if point not in self.confirmed_points:
            self.confirmed_points.append(point)

    # ── Quiz helpers ─────────────────────────────────────────────────────

    def record_quiz_answer(self, question: str, answer: str, score: int, feedback: str, topic: str = ""):
        """call stack: routers/quiz.py → record_quiz_answer"""
        self.quiz_history.append({
            "question": question,
            "answer": answer,
            "score": score,
            "feedback": feedback,
            "topic": topic or question[:40],
            "timestamp": time.time(),
        })
        self.quiz_questions_asked += 1

    def compute_readiness(self) -> float:
        if not self.quiz_history:
            return 0.0
        total = sum(q["score"] for q in self.quiz_history)
        return round((total / (len(self.quiz_history) * 10)) * 100, 1)

    def finalise_quiz(self):
        """
        call stack: routers/quiz.py → finalise_quiz
        Computes final score and splits topics into weak/strong.
        Weak areas are then watched during live coaching.
        """
        self.quiz_score = self.compute_readiness()
        self.quiz_complete = True
        weak, strong = [], []
        for q in self.quiz_history:
            topic = q.get("topic", q["question"][:40])
            if q["score"] < 6:
                weak.append(topic)
            elif q["score"] >= 7:
                strong.append(topic)
        self.weak_areas = weak
        self.strong_areas = strong

    # ── Groq context builder ─────────────────────────────────────────────

    def get_context_for_groq(self) -> dict:
        """
        Minimal context sent to Groq on each feedback call.
        Includes quiz weak areas so live coaching watches them closely.
        """
        return {
            "doc_title": self.topic_map.get("title", "Presentation"),
            "doc_summary": self.topic_map.get("doc_summary", "")[:300],
            "expected_flow": self.topic_map.get("expected_flow", []),
            "confirmed_points": self.confirmed_points[-5:],
            "summary_memory": self.summary_memory[-400:] if self.summary_memory else "",
            "recent_speech": self.rolling_transcript[-600:],
            "filler_rate": round(self.filler_total / max(self.total_words, 1) * 100, 1),
            "last_feedback": {k: v for k, v in self.last_feedback.items() if not k.startswith('_')},
            "weak_areas": self.weak_areas,
            "strong_areas": self.strong_areas,
            "quiz_score": self.quiz_score,
        }