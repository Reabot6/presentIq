from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from app.services.document_processor import extract_text, build_topic_map, SUPPORTED_EXTENSIONS
from app.services.groq_client import client as groq_client
from pathlib import Path

# call stack anchor: routers/documents.py
# POST /api/documents/upload → extract_text → build_topic_map → returns topic_map
# Frontend stores topic_map and sends it with session init

router = APIRouter(prefix="/api/documents", tags=["documents"])


class TopicMapResponse(BaseModel):
    title: str
    doc_summary: str
    key_points: list[str]
    expected_flow: list[str]
    keywords: list[str]
    expected_duration_split: dict
    key_questions_to_answer: list[str]
    raw_text_length: int


@router.post("/upload", response_model=TopicMapResponse)
async def upload_document(
    file: UploadFile = File(...),
    session_title: str = Form(default="My Presentation"),
):
    """
    call stack: POST /api/documents/upload
      → validate file type
      → extract_text (PDF/DOCX/PPTX/TXT)
      → build_topic_map via Groq (ONE TIME per session)
      → return topic_map to frontend

    Frontend stores this and sends it in the WS init_session message.
    It becomes the stable coaching context — never re-uploaded per feedback call.
    """
    ext = Path(file.filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Supported: {', '.join(SUPPORTED_EXTENSIONS)}"
        )

    # Read file bytes
    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=400, detail="File too large. Max 10MB.")

    # Extract raw text
    try:
        raw_text = await extract_text(file_bytes, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except ImportError as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not raw_text.strip():
        raise HTTPException(status_code=422, detail="Could not extract text from file. Is it a scanned image PDF?")

    # Build topic map via Groq — ONCE
    try:
        topic_map = await build_topic_map(raw_text, session_title, groq_client)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Topic map generation failed: {e}")

    return TopicMapResponse(
        title=topic_map.get("title", session_title),
        doc_summary=topic_map.get("doc_summary", ""),
        key_points=topic_map.get("key_points", []),
        expected_flow=topic_map.get("expected_flow", []),
        keywords=topic_map.get("keywords", []),
        expected_duration_split=topic_map.get("expected_duration_split", {}),
        key_questions_to_answer=topic_map.get("key_questions_to_answer", []),
        raw_text_length=len(raw_text),
    )