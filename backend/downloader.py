import os
import uuid
import yt_dlp

DOWNLOAD_DIR = "/tmp/truth_verifier"


def download_instagram(url: str) -> tuple[str, str]:
    """Download a public Instagram post. Returns (file_path, media_type)."""
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    job_id = str(uuid.uuid4())
    output_template = f"{DOWNLOAD_DIR}/{job_id}.%(ext)s"

    ydl_opts = {
        "outtmpl": output_template,
        "quiet": True,
        "no_warnings": True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)

    ext = (info.get("ext") or "mp4").lower()
    path = f"{DOWNLOAD_DIR}/{job_id}.{ext}"
    video_exts = {"mp4", "webm", "mkv", "mov", "avi", "m4v", "flv"}
    media_type = "video" if ext in video_exts else "image"

    return path, media_type
