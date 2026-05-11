import io
from fastapi import UploadFile

MAX_CONTEXT_CHARS = 15_000


async def extract_text_from_file(file: UploadFile) -> str:
    """
    Extract plain text from an uploaded file.
    Supported formats: .txt, .pdf, .docx
    Returns extracted text capped at MAX_CONTEXT_CHARS characters.
    Raises ValueError for unsupported file types.
    """
    filename = (file.filename or "").lower()
    contents = await file.read()

    if filename.endswith(".txt"):
        text = _extract_txt(contents)
    elif filename.endswith(".pdf"):
        text = _extract_pdf(contents)
    elif filename.endswith(".docx"):
        text = _extract_docx(contents)
    else:
        raise ValueError(
            f"Unsupported file type. Please upload a .txt, .pdf, or .docx file."
        )

    # Cap to avoid token limit overruns
    return text[:MAX_CONTEXT_CHARS].strip()


def _extract_txt(contents: bytes) -> str:
    """Decode raw bytes as UTF-8 text (with fallback to latin-1)."""
    try:
        return contents.decode("utf-8")
    except UnicodeDecodeError:
        return contents.decode("latin-1")


def _extract_pdf(contents: bytes) -> str:
    """Extract all text from every page of a PDF."""
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(contents))
    pages_text = []
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            pages_text.append(page_text)
    return "\n".join(pages_text)


def _extract_docx(contents: bytes) -> str:
    """Extract all paragraph text from a Word document."""
    from docx import Document

    doc = Document(io.BytesIO(contents))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n".join(paragraphs)
