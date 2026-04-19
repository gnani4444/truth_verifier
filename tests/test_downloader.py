import pytest
from unittest.mock import patch, MagicMock
from downloader import download_instagram


def make_mock_ydl(info: dict, side_effect=None):
    mock_instance = MagicMock()
    mock_instance.__enter__ = lambda s: mock_instance
    mock_instance.__exit__ = MagicMock(return_value=False)
    if side_effect:
        mock_instance.extract_info.side_effect = side_effect
    else:
        mock_instance.extract_info.return_value = info
    return mock_instance


def test_download_video_returns_mp4_and_video_type():
    info = {"ext": "mp4", "vcodec": "h264", "acodec": "aac"}
    with patch("downloader.yt_dlp.YoutubeDL", return_value=make_mock_ydl(info)):
        path, media_type = download_instagram("https://instagram.com/reel/abc")
    assert path.endswith(".mp4")
    assert media_type == "video"


def test_download_image_returns_jpg_and_image_type():
    info = {"ext": "jpg", "vcodec": "none", "acodec": "none"}
    with patch("downloader.yt_dlp.YoutubeDL", return_value=make_mock_ydl(info)):
        path, media_type = download_instagram("https://instagram.com/p/abc")
    assert path.endswith(".jpg")
    assert media_type == "image"


def test_download_raises_on_ydl_error():
    with patch(
        "downloader.yt_dlp.YoutubeDL",
        return_value=make_mock_ydl({}, side_effect=Exception("login required")),
    ):
        with pytest.raises(Exception, match="login required"):
            download_instagram("https://instagram.com/reel/private")
