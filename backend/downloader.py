import os
import tempfile
import uuid
import yt_dlp

DOWNLOAD_DIR = "/tmp/truth_verifier"


def _cookies_file() -> str | None:
    """Write INSTAGRAM_COOKIES env var to a temp file and return its path, or None."""
    cookies = os.environ.get("INSTAGRAM_COOKIES", "").strip()
    if not cookies:
        return None
    tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False)
    tmp.write(cookies)
    tmp.close()
    return tmp.name


def download_instagram(url: str) -> tuple[str, str]:
    """Download a public Instagram post. Returns (file_path, media_type)."""
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    job_id = str(uuid.uuid4())
    output_template = f"{DOWNLOAD_DIR}/{job_id}.%(ext)s"

    cookies_path = _cookies_file()

    ydl_opts = {
        "outtmpl": output_template,
        "quiet": True,
        "no_warnings": True,
    }

    if cookies_path:
        ydl_opts["cookiefile"] = cookies_path

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
    finally:
        if cookies_path and os.path.exists(cookies_path):
            os.unlink(cookies_path)

    ext = (info.get("ext") or "mp4").lower()
    path = f"{DOWNLOAD_DIR}/{job_id}.{ext}"
    video_exts = {"mp4", "webm", "mkv", "mov", "avi", "m4v", "flv"}
    media_type = "video" if ext in video_exts else "image"

    return path, media_type
