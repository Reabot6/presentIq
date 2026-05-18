import io
import re
from pathlib import Path
from typing import Optional

# call stack anchor: document_processor.py
# routers/documents.py → extract_text() → build_topic_map() → SessionMemory.topic_map
# Topic map is computed ONCE at session start, stored in memory, never re-prompted


SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".doc", ".pptx", ".ppt", ".txt", ".md"}


async def extract_text(file_bytes: bytes, filename: str) -> str:
    """
    call stack: routers/documents.py → extract_text
    Routes to the right extractor based on file extension.
    Returns plain text string.
    """
    ext = Path(filename).suffix.lower()

    if ext == ".pdf":
        return _extract_pdf(file_bytes)
    elif ext in (".docx", ".doc"):
        return _extract_docx(file_bytes)
    elif ext in (".pptx", ".ppt"):
        return _extract_pptx(file_bytes)
    elif ext in (".txt", ".md"):
        return file_bytes.decode("utf-8", errors="ignore")
    else:
        raise ValueError(f"Unsupported file type: {ext}. Supported: PDF, DOCX, PPTX, TXT, MD")


def _extract_pdf(file_bytes: bytes) -> str:
    """call stack: extract_text → _extract_pdf using pypdf"""
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        pages = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages.append(text.strip())
        return "\n\n".join(pages)
    except ImportError:
        raise ImportError("pypdf not installed. Run: pip install pypdf")
    except Exception as e:
        raise ValueError(f"PDF extraction failed: {e}")


def _extract_docx(file_bytes: bytes) -> str:
    """call stack: extract_text → _extract_docx using python-docx"""
    try:
        import docx
        doc = docx.Document(io.BytesIO(file_bytes))
        paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
        # Also extract tables
        for table in doc.tables:
            for row in table.rows:
                row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                if row_text:
                    paragraphs.append(row_text)
        return "\n\n".join(paragraphs)
    except ImportError:
        raise ImportError("python-docx not installed. Run: pip install python-docx")
    except Exception as e:
        raise ValueError(f"DOCX extraction failed: {e}")


def _extract_pptx(file_bytes: bytes) -> str:
    """call stack: extract_text → _extract_pptx using python-pptx"""
    try:
        from pptx import Presentation
        prs = Presentation(io.BytesIO(file_bytes))
        slides = []
        for i, slide in enumerate(prs.slides, 1):
            slide_text = [f"[Slide {i}]"]
            for shape in slide.shapes:
                if hasattr(shape, "text") and shape.text.strip():
                    slide_text.append(shape.text.strip())
            if len(slide_text) > 1:
                slides.append("\n".join(slide_text))
        return "\n\n".join(slides)
    except ImportError:
        raise ImportError("python-pptx not installed. Run: pip install python-pptx")
    except Exception as e:
        raise ValueError(f"PPTX extraction failed: {e}")


async def build_topic_map(raw_text: str, session_title: str, groq_client) -> dict:
    """
    call stack: routers/documents.py → build_topic_map → Groq API (ONE TIME)
    Sends the document text to Groq ONCE at session start.
    Returns structured topic_map stored in SessionMemory — never re-prompted.

    The topic_map becomes the stable context for all future feedback calls,
    replacing the need to re-send document content every time.
    """
    # Truncate to avoid token overflow — 6000 chars ≈ ~1500 tokens
    truncated = raw_text[:6000]
    if len(raw_text) > 6000:
        truncated += "\n\n[Document truncated for processing — key points extracted above]"

    prompt = f"""You are analyzing a presentation document to help coach the presenter in real-time.

Document title context: "{session_title}"

Document content:
{truncated}

Extract a structured coaching map. Respond ONLY with valid JSON, no markdown:
{{
  "title": "<inferred presentation title>",
  "doc_summary": "<2-3 sentence summary of what this presentation covers>",
  "key_points": ["<main point 1>", "<main point 2>", "<main point 3>", ...],
  "expected_flow": ["<section 1>", "<section 2>", "<section 3>", ...],
  "keywords": ["<technical term or key phrase 1>", "<term 2>", ...],
  "expected_duration_split": {{
    "<section 1>": "<suggested % of time>",
    "<section 2>": "<suggested % of time>"
  }},
  "key_questions_to_answer": ["<question audience will want answered 1>", ...]
}}

Keep keywords to the most important 8-15 terms. Key points should be 4-8 items."""

    import json
    from app.config import settings

    response = await groq_client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=800,
    )

    raw = response.choices[0].message.content.strip()

    # Strip markdown fences if Groq wraps it anyway
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Fallback — extract keywords manually if Groq JSON fails
        words = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', raw_text)
        unique_words = list(dict.fromkeys(words))[:12]
        return {
            "title": session_title,
            "doc_summary": raw_text[:200],
            "key_points": unique_words[:6],
            "expected_flow": ["Introduction", "Main content", "Conclusion"],
            "keywords": unique_words,
            "expected_duration_split": {},
            "key_questions_to_answer": [],
        }