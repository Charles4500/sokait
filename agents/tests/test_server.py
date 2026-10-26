from fastapi.testclient import TestClient

from sokait_agents.server import app

from .conftest import make_moment

client = TestClient(app)


def test_healthz_reports_backend():
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_moments_returns_a_versioned_overlay():
    r = client.post("/moments", json=make_moment().model_dump())
    assert r.status_code == 200
    body = r.json()
    assert body["schema"] == "smie.overlay.v2"
    assert len(body["narrations"]) == 3


def test_invalid_moment_is_rejected():
    assert client.post("/moments", json={"match_id": "x"}).status_code == 422


def test_token_is_required_when_configured(monkeypatch):
    monkeypatch.setenv("AGENTS_TOKEN", "s3cret")
    body = make_moment().model_dump()
    assert client.post("/moments", json=body).status_code == 401
    ok = client.post("/moments", json=body, headers={"Authorization": "Bearer s3cret"})
    assert ok.status_code == 200


def test_recap_endpoint():
    from .test_workflow import recap_request

    r = client.post("/recap", json=recap_request().model_dump())
    assert r.status_code == 200
    assert r.json()["verification"]["status"] in ("pass", "repaired")


def test_ask_endpoint():
    from .test_ask import ask_request

    r = client.post("/ask", json=ask_request().model_dump())
    assert r.status_code == 200
    assert r.json()["answer"]
