import os

# Tests always use the offline client, even when agents/.env holds real credentials:
# load_dotenv never overrides variables that are already set.
os.environ["OPENAI_API_KEY"] = ""
os.environ["GEMINI_API_KEY"] = ""
os.environ["FOUNDRY_PROJECT_ENDPOINT"] = ""

import pytest

from pitchpulse_agents.models import MomentRequest


def make_moment(**overrides) -> MomentRequest:
    base = {
        "match_id": "main",
        "moment_id": "1:57",
        "minute": 63,
        "event": {
            "id": 57,
            "minute": 63,
            "type": "shot",
            "team": "away",
            "player": "Theo Quinn",
            "xg": 0.42,
            "ballSpeed": 112,
            "zone": "att",
            "importance": 0.7,
            "label": "Theo Quinn shot · xG 0.42",
        },
        "score": {"home": 1, "away": 0},
        "stats": {
            "possession": {"home": 48, "away": 52},
            "xg": {"home": 0.89, "away": 1.31},
            "shots": {"home": 5, "away": 8},
            "pressure": {"home": 6, "away": 14},
            "chaos": 31,
            "control": 69,
            "momentum": -3.2,
            "topShotSpeed": 118,
            "avgPassDifficulty": 5.4,
            "winProb": {"home": 64, "away": 12, "draw": 24},
        },
        "teams": {
            "home": {"name": "Thames Rovers", "short": "THR"},
            "away": {"name": "Mersey Athletic", "short": "MER"},
        },
        "segments": [
            {"persona": "analyst", "language": "English"},
            {"persona": "casual", "language": "Spanish"},
            {
                "persona": "player",
                "language": "English",
                "favourite_player": "Eli Mensah",
            },
        ],
        "fallback_text": "High-value chance (0.42 xG). Mersey Athletic are breaking lines.",
    }
    base.update(overrides)
    return MomentRequest.model_validate(base)


@pytest.fixture
def moment() -> MomentRequest:
    return make_moment()
