import asyncio
import base64
import os
import subprocess
from pathlib import Path

import gradium


async def _transcribe_audio(audio_path: str) -> str:
    """Stream WAV file through Gradium STT. Returns transcript string."""
    client = gradium.client.GradiumClient()

    with open(audio_path, "rb") as f:
        audio_data = f.read()

    async def audio_generator(data, chunk_size=1920):
        for i in range(0, len(data), chunk_size):
            yield data[i: i + chunk_size]

    stream = await client.stt_stream(
        {
            "model_name": "default",
            "input_format": "wav",
            "json_config": {"language": "en", "text_temperature": 0.0},
        },
        audio_generator(audio_data),
    )

    transcript = []
    async for message in stream.iter_text():
        transcript.append(message)

    return " ".join(transcript)


async def _extract_audio_text(video_path: str) -> str:
    """Extract audio from video with ffmpeg, transcribe with Gradium. Returns text."""
    audio_path = str(Path(video_path).with_suffix(".wav"))

    result = subprocess.run(
        [
            "ffmpeg", "-i", video_path,
            "-vn", "-acodec", "pcm_s16le", "-ar", "24000", "-ac", "1",
            audio_path, "-y", "-loglevel", "error",
        ],
        capture_output=True,
    )

    if result.returncode != 0 or not os.path.exists(audio_path):
        return ""

    if os.path.getsize(audio_path) < 1000:
        os.unlink(audio_path)
        return ""

    try:
        text = await _transcribe_audio(audio_path)
    finally:
        if os.path.exists(audio_path):
            os.unlink(audio_path)

    return text


def _extract_keyframes(video_path: str, num_frames: int = 3) -> list[str]:
    """Extract evenly-spaced keyframes from video. Returns list of JPEG file paths."""
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", video_path],
        capture_output=True,
        text=True,
    )
    duration = float(result.stdout.strip() or "10")
    frame_paths = []

    for i in range(num_frames):
        t = duration * (i + 1) / (num_frames + 1)
        out_path = f"{video_path}_frame{i}.jpg"
        subprocess.run(
            ["ffmpeg", "-ss", str(t), "-i", video_path, "-vframes", "1", out_path, "-y", "-loglevel", "error"],
            check=True,
        )
        frame_paths.append(out_path)

    return frame_paths


def _analyze_visuals(image_paths: list[str]) -> str:
    """Use Gemini Vision to describe factual claims in images. Returns text.
    Only called when use_vision=True. Requires GEMINI_API_KEY env var."""
    import google.generativeai as genai
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    model = genai.GenerativeModel("gemini-2.0-flash")

    parts: list = [
        "List all factual claims, statistics, text overlays, and verifiable statements visible in these images. "
        "Be specific. One claim per line."
    ]

    for path in image_paths:
        with open(path, "rb") as f:
            image_bytes = f.read()
        parts.append({"mime_type": "image/jpeg", "data": base64.b64encode(image_bytes).decode()})

    response = model.generate_content(parts)
    return response.text


async def extract_text(file_path: str, media_type: str, use_vision: bool = False) -> str:
    """Extract textual content from media. Gemini Vision only runs if use_vision=True."""
    parts = []

    if media_type == "video":
        audio_text = await _extract_audio_text(file_path)
        if audio_text.strip():
            parts.append(f"Spoken content:\n{audio_text}")

        if use_vision:
            frame_paths = _extract_keyframes(file_path)
            try:
                visual_text = _analyze_visuals(frame_paths)
                if visual_text.strip():
                    parts.append(f"Visual content:\n{visual_text}")
            finally:
                for p in frame_paths:
                    if os.path.exists(p):
                        os.unlink(p)

    elif media_type == "image":
        if use_vision:
            visual_text = _analyze_visuals([file_path])
            if visual_text.strip():
                parts.append(f"Visual content:\n{visual_text}")

    return "\n\n".join(parts)
