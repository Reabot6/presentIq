from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from app.services.groq_client import transcribe_audio_chunk
from app.services.speech_engine import analyze_transcript, compute_coverage_percent
from app.websocket.manager import active_sessions

# call stack: main.py includes at /api/analysis
router = APIRouter(prefix="/api/analysis", tags=["analysis"])


class SpeechAnalysisResponse(BaseModel):
    transcript:        str
    words_per_minute:  float
    filler_count:      int
    filler_words_found: list[str]
    filler_score:      float
    pace_score:        float
    coverage_percent:  float
    time_advice:       str
    keywords_hit:      list[str] = []   # ← strict field, not injected into raw dict


@router.post("/audio", response_model=SpeechAnalysisResponse)
async def analyze_audio(
    session_id:      int   = Form(...),
    elapsed_seconds: float = Form(...),   # cumulative — total elapsed so far
    chunk_duration:  float = Form(...),   # how long THIS chunk is (e.g. 3.0)
    audio:           UploadFile = File(...),
):
    """
    call stack: POST /api/analysis/audio
      → transcribe_audio_chunk (groq_client / Groq Whisper)
      → analyze_transcript (speech_engine)
      → state.tick(chunk_duration, ...)   ← uses chunk, NOT cumulative elapsed
      → returns SpeechAnalysisResponse

    Frontend sends:
      elapsed_seconds = total time since session start  (for time_advice)
      chunk_duration  = length of this specific audio blob (for tick + WPM)

    Why separate?
      state.tick(elapsed_seconds) would double-count:
        chunk1=5s, chunk2=10s, chunk3=15s → tick adds 5+10+15=30s, real time=15s
      state.tick(chunk_duration) adds only the new seconds each time.
    """
    audio_bytes = await audio.read()
    if len(audio_bytes) < 100:
        raise HTTPException(status_code=400, detail="Audio chunk too small")

    # ── Step 1: Groq Whisper transcription ───────────────────────────────────
    transcript = await transcribe_audio_chunk(audio_bytes)

    # ── Step 2: Pull session state ────────────────────────────────────────────
    state          = active_sessions.get(session_id)
    keywords       = state.all_keywords           if state else []
    total_duration = state.total_duration_seconds if state else 300.0

    # ── Step 3: Speech analysis on this chunk ────────────────────────────────
    # chunk_duration drives WPM calculation — must be chunk length, not cumulative
    speech = analyze_transcript(transcript, chunk_duration, keywords)

    # ── Step 4: Update coverage state ────────────────────────────────────────
    coverage   = 0.0
    time_advice= ""
    hits       = []

    if state:
        # tick with chunk_duration only — never with elapsed_seconds
        state.tick(chunk_duration, speech.coverage_keywords_hit)
        # sync elapsed so time_advice is accurate
        state.elapsed_seconds = elapsed_seconds
        coverage    = state.coverage_percent
        time_advice = state.time_advice()
        hits        = list(state.keywords_hit)
    else:
        coverage = compute_coverage_percent(
            speech.coverage_keywords_hit,
            keywords,
            elapsed_seconds,
            total_duration,
        )

    return SpeechAnalysisResponse(
        transcript        = transcript,
        words_per_minute  = speech.words_per_minute,
        filler_count      = speech.filler_count,
        filler_words_found= speech.filler_words_found,
        filler_score      = speech.filler_score,
        pace_score        = speech.pace_score,
        coverage_percent  = coverage,
        time_advice       = time_advice,
        keywords_hit      = hits,
    )