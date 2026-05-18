import asyncio
import json
import base64
import time
from fastapi import WebSocket
from app.services.cv_processor import analyze_frame, CVResult
from app.services.coverage_tracker import CoverageState
from app.services.session_memory import SessionMemory
from app.config import settings

# call stack anchor: websocket/manager.py
# main.py → handle_connection()
#   → frame msgs → _process_frame() → cv_processor → charisma scores
#   → transcript_chunk msgs → _handle_transcript() → event detection → _request_feedback()
#   → _request_feedback() → groq_client.generate_feedback(memory_context) → WS push

# Coverage state (keyword tracking)
active_sessions: dict[int, CoverageState] = {}

# Session memory (rolling summary, confirmed points, behavioral trends, cooldowns)
session_memories: dict[int, SessionMemory] = {}

# Frame smoothing buffers
_frame_buffers: dict[int, list[CVResult]] = {}

SMOOTHING_WINDOW = 5

# Event thresholds
FILLER_SPIKE_THRESHOLD = 3    # fillers in 15-word window
WORDS_PER_FEEDBACK = 30       # words spoken before forcing a feedback check
SUMMARY_INTERVAL = 30         # seconds between rolling summary updates


async def handle_connection(websocket: WebSocket, session_id: int):
    """
    call stack root: client connects → handle_connection
    
    Message types received:
      init_session    — session config + topic_map from document upload
      frame           — base64 JPEG from webcam every 500ms
      transcript_chunk — new words from Groq Whisper every 3s
      elapsed_tick    — elapsed seconds sent every second
      ping            — keepalive

    Message types sent:
      session_ready   — ack after init
      frame_result    — charisma scores + coverage snapshot
      feedback_update — Groq coaching (event-driven, not timed)
      pong            — keepalive ack
    """
    await websocket.accept()
    _frame_buffers[session_id] = []
    session_memories[session_id] = SessionMemory()

    # Track when we last updated the rolling summary
    last_summary_update = time.time()

    try:
        while True:
            raw = await websocket.receive_text()
            message = json.loads(raw)
            msg_type = message.get("type")

            if msg_type == "init_session":
                _init_session(session_id, message)
                await websocket.send_text(json.dumps({
                    "type": "session_ready",
                    "session_id": session_id,
                    "keywords": active_sessions[session_id].all_keywords,
                    "topic_map": session_memories[session_id].topic_map,
                }))

            elif msg_type == "frame":
                result = await _process_frame(session_id, message)
                await websocket.send_text(json.dumps(result))

            elif msg_type == "transcript_chunk":
                # call stack: transcript_chunk → _handle_transcript → maybe _request_feedback
                feedback = await _handle_transcript(session_id, message)
                if feedback:
                    await websocket.send_text(json.dumps({
                        "type": "feedback_update",
                        "feedback": feedback,
                        "trigger": feedback.get("trigger", "words"),
                    }))

                # Rolling summary update every 30s
                mem = session_memories.get(session_id)
                if mem and (time.time() - last_summary_update) >= SUMMARY_INTERVAL:
                    last_summary_update = time.time()
                    asyncio.create_task(_update_summary(session_id))

            elif msg_type == "elapsed_tick":
                mem = session_memories.get(session_id)
                if mem:
                    mem.elapsed = message.get("elapsed", 0)
                cov = active_sessions.get(session_id)
                if cov:
                    cov.elapsed_seconds = message.get("elapsed", 0)

            elif msg_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

    except Exception as e:
        print(f"[WS] session {session_id} error: {e}")
    finally:
        _frame_buffers.pop(session_id, None)
        # Keep memory for results page — clean up after 10 min
        asyncio.create_task(_delayed_cleanup(session_id, delay=600))
        try:
            await websocket.close()
        except Exception:
            pass


def _init_session(session_id: int, message: dict):
    """
    call stack: handle_connection → _init_session
    Sets up CoverageState and SessionMemory for this session.
    topic_map comes from document upload (already processed by Groq once).
    """
    keywords = message.get("keywords", [])
    duration = message.get("duration_seconds", 300)
    topic_map = message.get("topic_map", {})  # Pre-processed from /api/documents/upload

    # If topic_map has keywords, merge with manually added keywords
    doc_keywords = topic_map.get("keywords", [])
    all_keywords = list(dict.fromkeys(keywords + doc_keywords))  # deduplicated

    active_sessions[session_id] = CoverageState(
        all_keywords=all_keywords,
        total_duration_seconds=duration,
    )

    mem = session_memories[session_id]
    mem.topic_map = topic_map
    mem.total_duration = duration
    mem.session_goal = topic_map.get("title", "Presentation practice")


async def _handle_transcript(session_id: int, message: dict) -> dict | None:
    """
    call stack: handle_connection → _handle_transcript → _request_feedback (conditional)

    Processes a 3s transcript chunk from the frontend.
    Updates SessionMemory state.
    Fires Groq feedback only when an event threshold is crossed AND cooldown allows.

    Events (in priority order):
      1. filler_spike  — 3+ fillers in 15-word window
      2. keyword       — a tracked topic just mentioned
      3. words         — every 30 words spoken
    """
    mem = session_memories.get(session_id)
    if not mem:
        return None

    new_text = message.get("text", "").strip()
    if not new_text:
        return None

    words = new_text.lower().split()

    # Update filler window and check for spike
    window_fillers = mem.update_filler_window(words)
    filler_count = sum(1 for w in words if w in {
        "um", "uh", "like", "basically", "literally",
        "actually", "so", "right", "you know", "kind of", "sort of"
    })
    mem.filler_total += filler_count

    # Update rolling transcript + word counts
    mem.add_transcript_chunk(new_text, words)

    # Update coverage tracker — returns newly hit keywords
    newly_covered = []
    if session_id in active_sessions:
        newly_covered = active_sessions[session_id].update_from_transcript(new_text)
        for kw in newly_covered:
            mem.confirm_point(kw)

    # Determine trigger (priority order)
    trigger = None
    keyword_hit = None

    if window_fillers >= FILLER_SPIKE_THRESHOLD and mem.can_fire("filler_spike"):
        trigger = "filler_spike"
    elif newly_covered and mem.can_fire("keyword"):
        trigger = "keyword"
        keyword_hit = newly_covered[0]
    elif mem.words_since_feedback >= WORDS_PER_FEEDBACK and mem.can_fire("words"):
        trigger = "words"

    if trigger is None:
        return None

    # Fire feedback
    feedback = await _request_feedback(session_id, trigger, keyword_hit)
    if feedback:
        mem.mark_fired(trigger, feedback.get("top_issue", ""))
        mem.words_since_feedback = 0
        feedback["trigger"] = trigger

    return feedback


async def _request_feedback(
    session_id: int,
    trigger: str,
    keyword_hit: str | None = None,
) -> dict | None:
    """
    call stack: _handle_transcript → _request_feedback → groq_client.generate_feedback
    Assembles minimal context from SessionMemory and fires Groq.
    """
    from app.services.groq_client import generate_feedback

    mem = session_memories.get(session_id)
    cov = active_sessions.get(session_id)
    if not mem:
        return None

    return await generate_feedback(
        charisma_scores=mem.last_feedback.get("_cv_scores", {
            "eye_contact": 0.5, "posture": 0.5, "gesture": 0.5, "overall": 0.5
        }),
        trigger=trigger,
        memory_context=mem.get_context_for_groq(),
        time_elapsed_seconds=mem.elapsed,
        total_duration_seconds=mem.total_duration,
        filler_total=mem.filler_total,
        coverage_percent=cov.coverage_percent if cov else 0,
        uncovered_keywords=cov.uncovered_keywords[:3] if cov else [],
        keyword_hit=keyword_hit,
    )


async def _update_summary(session_id: int):
    """
    call stack: handle_connection (task) → _update_summary → groq_client.summarize_transcript
    Runs every 30s in background. Updates SessionMemory.summary_memory.
    This keeps Groq context tight — sends summary not raw transcript.
    """
    from app.services.groq_client import summarize_transcript
    mem = session_memories.get(session_id)
    if not mem or not mem.rolling_transcript.strip():
        return
    try:
        new_summary = await summarize_transcript(
            current_summary=mem.summary_memory,
            new_chunk=mem.rolling_transcript[-300:],
            session_goal=mem.session_goal,
        )
        mem.summary_memory = new_summary
    except Exception as e:
        print(f"[Summary] session {session_id} error: {e}")


async def _delayed_cleanup(session_id: int, delay: int):
    """Clean up session memory after delay seconds"""
    await asyncio.sleep(delay)
    session_memories.pop(session_id, None)
    active_sessions.pop(session_id, None)


async def _process_frame(session_id: int, message: dict) -> dict:
    """
    call stack: handle_connection → _process_frame → analyze_frame (cv_processor)
    Runs MediaPipe on base64 JPEG. Returns charisma scores + coverage snapshot.
    Stores latest CV scores in SessionMemory for feedback context.
    """
    image_b64 = message.get("image", "")
    if not image_b64:
        return {"type": "error", "message": "no image data"}

    frame_bytes = base64.b64decode(image_b64)
    loop = asyncio.get_event_loop()
    cv_result: CVResult = await loop.run_in_executor(None, analyze_frame, frame_bytes)

    buf = _frame_buffers.setdefault(session_id, [])
    buf.append(cv_result)
    if len(buf) > SMOOTHING_WINDOW:
        buf.pop(0)

    smoothed = _smooth_results(buf)
    charisma = _compute_charisma(smoothed)

    # Store latest CV scores in memory so feedback calls have them
    mem = session_memories.get(session_id)
    if mem:
        mem.last_feedback["_cv_scores"] = charisma

    coverage_data = {}
    if session_id in active_sessions:
        cov = active_sessions[session_id]
        coverage_data = {
            "coverage_percent": cov.coverage_percent,
            "expected_coverage": cov.expected_coverage_percent,
            "coverage_gap": cov.coverage_gap,
            "time_advice": cov.time_advice(),
            "uncovered_count": len(cov.uncovered_keywords),
        }

    return {
        "type": "frame_result",
        "timestamp_ms": message.get("timestamp_ms", 0),
        "cv": {
            "face_detected": smoothed.face_detected,
            "eye_contact": smoothed.eye_contact,
            "posture_score": smoothed.posture_score,
            "gesture_activity": smoothed.gesture_activity,
        },
        "charisma": charisma,
        "coverage": coverage_data,
    }


def _smooth_results(buf: list[CVResult]) -> CVResult:
    """call stack: _process_frame → _smooth_results — temporal smoothing over last N frames"""
    if not buf:
        return CVResult(False, 0.0, 0.0, 0.0, {})
    return CVResult(
        face_detected=any(r.face_detected for r in buf),
        eye_contact=sum(r.eye_contact for r in buf) / len(buf),
        posture_score=sum(r.posture_score for r in buf) / len(buf),
        gesture_activity=sum(r.gesture_activity for r in buf) / len(buf),
        raw_landmarks={},
    )


def _compute_charisma(cv: CVResult) -> dict:
    """call stack: _process_frame → _compute_charisma — weighted score from CV metrics"""
    w = settings
    score = (
        cv.eye_contact * w.WEIGHT_EYE_CONTACT
        + cv.posture_score * w.WEIGHT_POSTURE
        + cv.gesture_activity * w.WEIGHT_GESTURE
    ) / (w.WEIGHT_EYE_CONTACT + w.WEIGHT_POSTURE + w.WEIGHT_GESTURE)

    return {
        "overall": round(score, 3),
        "eye_contact": round(cv.eye_contact, 3),
        "posture": round(cv.posture_score, 3),
        "gesture": round(cv.gesture_activity, 3),
    }