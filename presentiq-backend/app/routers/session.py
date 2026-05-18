from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.database import get_db
from app.models import Session as SessionModel

# call stack: main.py includes this router at /api/sessions
router = APIRouter(prefix="/api/sessions", tags=["sessions"])


class CreateSessionRequest(BaseModel):
    title: str
    duration_seconds: int = 300
    keywords: list[str] = []


class SessionResponse(BaseModel):
    id: int
    title: str
    duration_seconds: int
    overall_charisma_score: float
    content_coverage_percent: float

    model_config = {"from_attributes": True}


@router.post("/", response_model=SessionResponse)
async def create_session(body: CreateSessionRequest, db: AsyncSession = Depends(get_db)):
    """
    call stack: POST /api/sessions → create_session → DB insert
    Creates a new practice session record. Keywords are stored in the WS manager separately.
    """
    session = SessionModel(
        title=body.title,
        duration_seconds=body.duration_seconds,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.get("/", response_model=list[SessionResponse])
async def list_sessions(db: AsyncSession = Depends(get_db)):
    """call stack: GET /api/sessions → list_sessions → DB select"""
    result = await db.execute(select(SessionModel).order_by(SessionModel.created_at.desc()))
    return result.scalars().all()


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(session_id: int, db: AsyncSession = Depends(get_db)):
    """call stack: GET /api/sessions/{id} → get_session → DB select"""
    result = await db.execute(select(SessionModel).where(SessionModel.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session
