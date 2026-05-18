import re
from dataclasses import dataclass

# call stack anchor: speech_engine.py
# routers/analysis.py → speech_engine.analyze_transcript() → SpeechResult

FILLER_WORDS = {
    "um", "uh", "like", "you know", "so", "basically", "literally",
    "actually", "right", "okay", "kind of", "sort of", "i mean",
    "you see", "well", "hmm", "er", "ah"
}

# Ideal speech pace range (words per minute)
PACE_MIN = 120
PACE_MAX = 160


@dataclass
class SpeechResult:
    words_per_minute: float
    filler_count: int
    filler_words_found: list[str]
    filler_score: float       # 1.0 = no fillers, 0.0 = many fillers
    pace_score: float         # 1.0 = ideal pace, lower if too fast/slow
    word_count: int
    coverage_keywords_hit: list[str]


def analyze_transcript(
    transcript: str,
    duration_seconds: float,
    expected_keywords: list[str] | None = None,
) -> SpeechResult:
    """
    call stack: routers/analysis.py::analyze_speech → analyze_transcript
    transcript: full or chunked text from Groq Whisper
    duration_seconds: how long this chunk covers
    expected_keywords: key terms from the user's planned content
    """
    if not transcript or duration_seconds <= 0:
        return SpeechResult(0, 0, [], 1.0, 0.5, 0, [])

    clean = transcript.lower().strip()
    words = clean.split()
    word_count = len(words)

    # Words per minute
    wpm = (word_count / duration_seconds) * 60

    # Pace score — penalise deviation from ideal range
    if PACE_MIN <= wpm <= PACE_MAX:
        pace_score = 1.0
    elif wpm < PACE_MIN:
        pace_score = max(0.0, wpm / PACE_MIN)
    else:
        pace_score = max(0.0, 1.0 - ((wpm - PACE_MAX) / PACE_MAX))

    # Filler word detection
    found_fillers = []
    for filler in FILLER_WORDS:
        pattern = r'\b' + re.escape(filler) + r'\b'
        matches = re.findall(pattern, clean)
        found_fillers.extend(matches)

    filler_count = len(found_fillers)

    # Filler score: penalise 0.05 per filler per 100 words
    filler_rate = filler_count / max(word_count, 1) * 100
    filler_score = max(0.0, 1.0 - (filler_rate * 0.05))

    # Content coverage: check which expected keywords were mentioned
    keywords_hit = []
    if expected_keywords:
        for kw in expected_keywords:
            if kw.lower() in clean:
                keywords_hit.append(kw)

    return SpeechResult(
        words_per_minute=round(wpm, 1),
        filler_count=filler_count,
        filler_words_found=list(set(found_fillers)),
        filler_score=round(filler_score, 3),
        pace_score=round(pace_score, 3),
        word_count=word_count,
        coverage_keywords_hit=keywords_hit,
    )


def compute_coverage_percent(
    keywords_hit: list[str],
    all_keywords: list[str],
    time_elapsed: float,
    total_duration: float,
) -> float:
    """
    call stack: routers/analysis.py → compute_coverage_percent
    The secret weapon: how much material covered vs time spent.
    Returns float 0.0 - 100.0
    """
    if not all_keywords:
        return 0.0

    raw_coverage = len(keywords_hit) / len(all_keywords)

    # Time efficiency: are they on track?
    time_ratio = time_elapsed / max(total_duration, 1)
    expected_coverage = time_ratio  # ideally coverage matches time used

    # If they're ahead: bonus. If behind: penalise slightly.
    efficiency_bonus = (raw_coverage - expected_coverage) * 20
    adjusted = (raw_coverage * 100) + efficiency_bonus

    return round(max(0.0, min(100.0, adjusted)), 1)
