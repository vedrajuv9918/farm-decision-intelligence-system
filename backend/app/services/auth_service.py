"""
Clean SQLite-based auth service.
Uses Python's built-in sqlite3 — no SQLAlchemy, no async complexity.
"""
from __future__ import annotations

import hashlib
import secrets
import sqlite3
from pathlib import Path
from threading import Lock

from app.schemas.auth import AuthUser

_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "farmwise_auth.db"
_lock = Lock()


def _conn() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
    con.row_factory = sqlite3.Row
    return con


def init_auth_db() -> None:
    """Create the users table if it does not exist."""
    with _lock, _conn() as con:
        con.execute("""
            CREATE TABLE IF NOT EXISTS users (
                email           TEXT PRIMARY KEY,
                full_name       TEXT NOT NULL,
                password_salt   TEXT NOT NULL,
                password_hash   TEXT NOT NULL,
                has_farm_profile INTEGER NOT NULL DEFAULT 0
            )
        """)
        con.commit()


def _hash(password: str, salt: str | None = None) -> tuple[str, str]:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), 120_000
    )
    return salt, digest.hex()


def _verify(password: str, salt: str, stored_hash: str) -> bool:
    _, candidate = _hash(password, salt)
    return secrets.compare_digest(candidate, stored_hash)


class AuthService:
    def register(self, *, full_name: str, email: str, password: str) -> AuthUser | None:
        email = email.lower().strip()
        salt, pw_hash = _hash(password)
        with _lock, _conn() as con:
            existing = con.execute(
                "SELECT email FROM users WHERE email = ?", (email,)
            ).fetchone()
            if existing:
                return None  # duplicate
            con.execute(
                "INSERT INTO users (email, full_name, password_salt, password_hash, has_farm_profile) "
                "VALUES (?, ?, ?, ?, 0)",
                (email, full_name.strip(), salt, pw_hash),
            )
            con.commit()
        return AuthUser(full_name=full_name.strip(), email=email, has_farm_profile=False)

    def login(self, *, email: str, password: str) -> tuple[str, AuthUser | None]:
        email = email.lower().strip()
        with _conn() as con:
            row = con.execute(
                "SELECT * FROM users WHERE email = ?", (email,)
            ).fetchone()
        if not row:
            return "not_found", None
        if not _verify(password, row["password_salt"], row["password_hash"]):
            return "wrong_password", None
        return "success", AuthUser(
            full_name=row["full_name"],
            email=row["email"],
            has_farm_profile=bool(row["has_farm_profile"]),
        )

    def set_farm_profile_status(self, *, email: str, has_farm_profile: bool) -> AuthUser | None:
        email = email.lower().strip()
        with _lock, _conn() as con:
            row = con.execute(
                "SELECT * FROM users WHERE email = ?", (email,)
            ).fetchone()
            if not row:
                return None
            con.execute(
                "UPDATE users SET has_farm_profile = ? WHERE email = ?",
                (1 if has_farm_profile else 0, email),
            )
            con.commit()
            row = con.execute(
                "SELECT * FROM users WHERE email = ?", (email,)
            ).fetchone()
        return AuthUser(
            full_name=row["full_name"],
            email=row["email"],
            has_farm_profile=bool(row["has_farm_profile"]),
        )
