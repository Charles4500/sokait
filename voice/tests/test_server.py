from fastapi.testclient import TestClient

from sokait_voice.server import app

client = TestClient(app)


def test_speaks_or_reports_missing_voice():
    r = client.post("/tts", json={"text": "Goal!", "language": "English"})
    if "English" in client.get("/healthz").json()["languages"]:
        assert r.status_code == 200 and r.headers["content-type"] == "audio/wav"
        assert r.content[:4] == b"RIFF"
    else:  # CI has no voice files
        assert r.status_code == 404


def test_unknown_language_is_404():
    r = client.post("/tts", json={"text": "x", "language": "Klingon"})
    assert r.status_code == 404


def test_token_is_required_when_configured(monkeypatch):
    monkeypatch.setenv("VOICE_TOKEN", "s3cret")
    assert client.post("/tts", json={"text": "x"}).status_code == 401
