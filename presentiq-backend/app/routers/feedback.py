from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.websocket.manager import active_sessions, session_memories

# call stack: main.py includes at /api/feedback
# This router now only handles session SUMMARY (end of session)
# Real-time feedback fires through WebSocket in manager.py — not here
router = APIRouter(prefix="/api/feedback", tags=["feedback"])


class FeedbackRequest(BaseModel):
    session_id: int
    charisma_scores: dict
    transcript: str
    time_elapsed_seconds: int
    total_duration_seconds: int


@router.post("/realtime")
async def get_realtime_feedback(body: FeedbackRequest):
    """
    Legacy endpoint — frontend still calls this every 15s.
    Now returns cached last feedback from SessionMemory instead of calling Groq.
    Real Groq calls happen event-driven through the WebSocket.
    """
    mem = session_memories.get(body.session_id)
    cov = active_sessions.get(body.session_id)

    if mem and mem.last_feedback:
        # Strip internal keys before returning
        feedback = {k: v for k, v in mem.last_feedback.items() if not k.startswith('_')}
        if feedback:
            return {**feedback, "coverage_percent": cov.coverage_percent if cov else 0}

    # No feedback yet — return neutral holding response
    return {
        "overall_score": 50.0,
        "top_issue": "Session just started — keep going!",
        "quick_tip": "Speak clearly and look at the camera.",
        "time_advice": f"{body.total_duration_seconds - body.time_elapsed_seconds}s remaining.",
        "strengths": [],
        "metrics": {},
        "coverage_percent": cov.coverage_percent if cov else 0,
        "coverage_gap": cov.coverage_gap if cov else 0,
    }