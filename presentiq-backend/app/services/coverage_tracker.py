from dataclasses import dataclass, field
import re

# call stack anchor: coverage_tracker.py
# websocket/manager.py holds one CoverageState per session_id
# update_from_transcript() called on every transcript chunk


@dataclass
class CoverageState:
    """
    Mutable state object held in memory per active session.
    Tracks which key topics the presenter has covered vs planned.
    """
    all_keywords:           list[str]
    total_duration_seconds: float
    keywords_hit:           set[str] = field(default_factory=set)
    elapsed_seconds:        float    = 0.0

    def tick(self, chunk_duration: float, new_hits: list[str]):
        """
        call stack: routers/analysis.py → state.tick(chunk_duration, ...)
        Add chunk_duration seconds — NOT cumulative elapsed.
        new_hits come from speech_engine keyword detection.
        """
        self.elapsed_seconds += chunk_duration
        for kw in new_hits:
            self.keywords_hit.add(kw.lower())

    def update_from_transcript(self, text: str) -> list[str]:
        """
        call stack: websocket/manager.py::_handle_transcript → update_from_transcript
        Scans new transcript chunk for keyword matches using whole-word regex.
        Returns list of NEWLY covered keywords (not previously hit).
        Used to trigger keyword-hit feedback events.
        """
        text_lower    = text.lower()
        newly_covered = []

        for kw in self.all_keywords:
            kw_lower = kw.lower()
            if kw_lower not in self.keywords_hit:
                pattern = r'\b' + re.escape(kw_lower) + r'\b'
                if re.search(pattern, text_lower):
                    self.keywords_hit.add(kw_lower)
                    newly_covered.append(kw)

        return newly_covered

    # ── Read-only properties ──────────────────────────────────────────────────

    @property
    def coverage_percent(self) -> float:
        if not self.all_keywords:
            return 0.0
        return round(len(self.keywords_hit) / len(self.all_keywords) * 100, 1)

    @property
    def time_ratio(self) -> float:
        return min(1.0, self.elapsed_seconds / max(self.total_duration_seconds, 1))

    @property
    def expected_coverage_percent(self) -> float:
        """Linear expectation: 50% through time → expect 50% coverage."""
        return round(self.time_ratio * 100, 1)

    @property
    def coverage_gap(self) -> float:
        """Positive = ahead of schedule. Negative = behind."""
        return round(self.coverage_percent - self.expected_coverage_percent, 1)

    @property
    def uncovered_keywords(self) -> list[str]:
        return [kw for kw in self.all_keywords if kw.lower() not in self.keywords_hit]

    def time_advice(self) -> str:
        """Plain-English time-pressure advice for coaching prompts."""
        remaining = self.total_duration_seconds - self.elapsed_seconds
        uncovered = len(self.uncovered_keywords)

        if remaining <= 0:
            return "Time is up!"
        if remaining < 30:
            return f"Under 30s left — {uncovered} topics uncovered. Wrap up now."
        if remaining < 90:
            return f"{int(remaining)}s left, {uncovered} topics remaining. Speed up."
        if self.coverage_gap < -20:
            return f"Behind — {self.coverage_percent:.0f}% covered at {self.time_ratio*100:.0f}% time used."
        if self.coverage_gap > 20:
            return "Ahead of schedule — slow down, add depth and examples."
        return f"On track — {self.coverage_percent:.0f}% covered, {int(remaining)}s remaining."