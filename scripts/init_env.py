"""Create local configuration without printing secrets or overwriting existing data."""
from pathlib import Path
import secrets

root = Path(__file__).resolve().parents[1]
content = (root / ".env.example").read_text(encoding="utf-8")
content = content.replace("replace-with-a-local-database-password", secrets.token_urlsafe(32))
content = content.replace("replace-with-a-random-secret-of-at-least-32-characters", secrets.token_urlsafe(48))
try:
    with (root / ".env").open("x", encoding="utf-8") as file:
        file.write(content)
except FileExistsError:
    raise SystemExit(".env already exists; kept unchanged.")
print("Created .env with random local secrets. Do not commit this file.")
