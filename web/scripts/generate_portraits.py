"""Generate a realistic portrait of every (fictional) player, once, with FLUX.1-schnell
(Apache-2.0) on Cloudflare Workers AI's free tier. Saves 256 px WebP files to
web/public/players/<player id>.webp; the app falls back to DiceBear art when one is missing.

    bun scripts/export-players.ts > /tmp/players.json
    uv run --no-project --with python-dotenv --with pillow python scripts/generate_portraits.py /tmp/players.json
Needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in agents/.env.
"""

import base64
import io
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from dotenv import dotenv_values
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "web" / "public" / "players"
MODEL = "@cf/black-forest-labs/flux-1-schnell"

# Varied, generic looks so squads don't look cloned and nobody resembles a real player.
SKIN = ["light", "olive", "tan", "medium brown", "dark brown", "deep dark"]
HAIR = [
    "short fade haircut",
    "short curly hair",
    "buzz cut",
    "swept-back hair",
    "short twists",
    "shaved head",
    "wavy medium-length hair",
]
FACE = ["clean-shaven", "light stubble", "a short neat beard", "a thin moustache"]
AGE = [21, 24, 27, 30, 33]


def prompt(p: dict, i: int) -> str:
    look = (
        f"{SKIN[i % len(SKIN)]} skin, {HAIR[(i * 3) % len(HAIR)]}, "
        f"{FACE[(i * 5) % len(FACE)]}, about {AGE[(i * 7) % len(AGE)]} years old"
    )
    return (
        "Studio portrait photograph of a fictional professional footballer, head and "
        f"shoulders, facing camera, confident expression, {look}, wearing a plain "
        f"{p['kit']} football shirt with white collar, plain dark grey studio background, "
        "soft rim lighting, photorealistic, sports game player card style. "
        "No logos, no badges, no text, no numbers."
    )


def generate(account: str, token: str, text: str) -> bytes:
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/{MODEL}",
        data=json.dumps({"prompt": text, "steps": 6}).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return base64.b64decode(json.load(r)["result"]["image"])


def main() -> None:
    env = dotenv_values(ROOT / "agents" / ".env")
    account, token = env["CLOUDFLARE_ACCOUNT_ID"], env["CLOUDFLARE_API_TOKEN"]
    players = json.loads(Path(sys.argv[1]).read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    for i, p in enumerate(players):
        path = OUT / f"{p['id']}.webp"
        if path.exists():
            continue
        for attempt in range(3):
            try:
                raw = generate(account, token, prompt(p, i))
                break
            except urllib.error.HTTPError as e:
                print(f"{p['id']}: HTTP {e.code}, retrying", file=sys.stderr)
                time.sleep(5 * (attempt + 1))
        else:
            continue
        img = Image.open(io.BytesIO(raw)).convert("RGB").resize((256, 256), Image.LANCZOS)
        img.save(path, "WEBP", quality=82)
        print(f"{p['id']:8} {p['name']:16} {path.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
