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

    ext = info.get("ext", "mp4")
    path = f"{DOWNLOAD_DIR}/{job_id}.{ext}"
    vcodec = info.get("vcodec", "none")
    media_type = "video" if vcodec and vcodec != "none" else "image"

    return path, media_type
