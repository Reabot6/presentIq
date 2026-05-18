from sqlalchemy import String, Float, Integer, Text, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime, timezone
from app.database import Base


class Session(Base):
    """One practice run = one session"""
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Charisma scores (0.0 - 1.0)
    eye_contact_score: Mapped[float] = mapped_column(Float, default=0.0)
    posture_score: Mapped[float] = mapped_column(Float, default=0.0)
    gesture_score: Mapped[float] = mapped_column(Float, default=0.0)
    speech_pace_score: Mapped[float] = mapped_column(Float, default=0.0)
    filler_word_score: Mapped[float] = mapped_column(Float, default=0.0)
    overall_charisma_score: Mapped[float] = mapped_column(Float, default=0.0)

    # Content coverage
    content_coverage_percent: Mapped[float] = mapped_column(Float, default=0.0)
    filler_word_count: Mapped[int] = mapped_column(Integer, default=0)
    words_per_minute: Mapped[float] = mapped_column(Float, default=0.0)

    # Raw data
    transcript: Mapped[str] = mapped_column(Text, default="")
    feedback_summary: Mapped[str] = mapped_column(Text, default="")
    key_points_covered: Mapped[dict] = mapped_column(JSON, default=dict)


class FrameAnalysis(Base):
    """CV snapshot per frame — powers the real-time feed"""
    __tablename__ = "frame_analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(Integer, nullable=False)
    timestamp_ms: Mapped[int] = mapped_column(Integer, nullable=False)

    # Raw MediaPipe outputs
    eye_contact: Mapped[float] = mapped_column(Float, default=0.0)
    posture_score: Mapped[float] = mapped_column(Float, default=0.0)
    gesture_activity: Mapped[float] = mapped_column(Float, default=0.0)
    face_detected: Mapped[bool] = mapped_column(default=False)
