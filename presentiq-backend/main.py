from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database import init_db
from app.websocket.manager import handle_connection
from app.routers import session, analysis, feedback, documents, quiz


@asynccontextmanager
async def lifespan(app: FastAPI):
    # call stack: startup → init_db (creates tables if not exist)
    await init_db()
    yield
    # shutdown hooks go here if needed


app = FastAPI(
    title="PresentIQ API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# REST routers
# call stack: request → FastAPI router match → routers/session|analysis|feedback.py
app.include_router(session.router)
app.include_router(analysis.router)
app.include_router(feedback.router)
app.include_router(documents.router)
app.include_router(quiz.router)


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: int):
    """
    call stack: WS connect → websocket_endpoint → manager.handle_connection()
    Each browser tab opens one WS connection per practice session.
    """
    try:
        await handle_connection(websocket, session_id)
    except WebSocketDisconnect:
        pass


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.APP_ENV}
