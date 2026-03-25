#!/usr/bin/env python3
"""api_server.py — User management backend for GF Fairfax Installer Portal."""
import sqlite3
import hashlib
import secrets
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# DB_PATH = "/home/user/workspace/gf-portal/users.db"
DB_PATH = os.path.join(os.getcwd(), "users.db")

def get_db():
    db = sqlite3.connect(DB_PATH, check_same_thread=False)
    db.row_factory = sqlite3.Row
    return db

def hash_pw(password, salt=None):
    if salt is None:
        salt = secrets.token_hex(16)
    h = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}:{h}"

def check_pw(password, stored):
    salt, _ = stored.split(":", 1)
    return hash_pw(password, salt) == stored

def init_db():
    db = get_db()
    db.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'installer',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # Seed default accounts if table is empty
    count = db.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    if count == 0:
        defaults = [
            ("rob", "admin2026", "Rob Ellis", "admin"),
            ("stacey", "gf-stacey", "Stacey Webb", "installer"),
            ("shane", "gf-shane", "Shane McClung", "installer"),
        ]
        for uname, pw, name, role in defaults:
            db.execute(
                "INSERT INTO users (username, password_hash, name, role) VALUES (?, ?, ?, ?)",
                (uname, hash_pw(pw), name, role),
            )
    db.commit()
    db.close()

@asynccontextmanager
async def lifespan(app):
    init_db()
    yield

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- Models ---
class LoginReq(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    password: str
    name: str
    role: str = "installer"

class UserUpdate(BaseModel):
    name: str | None = None
    password: str | None = None
    role: str | None = None

# --- Auth ---
# Simple token-based session: visitor header + username
# In-memory session store (resets on server restart, which is fine)
sessions = {}  # token -> {username, name, role}

@app.post("/api/login")
def login(req: LoginReq, request: Request):
    db = get_db()
    row = db.execute("SELECT * FROM users WHERE LOWER(username) = LOWER(?)", (req.username,)).fetchone()
    db.close()
    if not row or not check_pw(req.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    visitor = request.headers.get("X-Visitor-Id", secrets.token_hex(8))
    token = f"{visitor}:{row['username']}"
    sessions[token] = {"username": row["username"], "name": row["name"], "role": row["role"]}
    return {"token": token, "username": row["username"], "name": row["name"], "role": row["role"]}

@app.post("/api/logout")
def logout(request: Request):
    token = request.headers.get("X-Auth-Token", "")
    sessions.pop(token, None)
    return {"ok": True}

def require_admin(request: Request):
    token = request.headers.get("X-Auth-Token", "")
    session = sessions.get(token)
    if not session or session["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return session

# --- User Management (admin only) ---
@app.get("/api/users")
def list_users(request: Request):
    require_admin(request)
    db = get_db()
    rows = db.execute("SELECT id, username, name, role, created_at FROM users ORDER BY id").fetchall()
    db.close()
    return [dict(r) for r in rows]

@app.post("/api/users", status_code=201)
def create_user(user: UserCreate, request: Request):
    require_admin(request)
    db = get_db()
    # Check unique username
    existing = db.execute("SELECT id FROM users WHERE LOWER(username) = LOWER(?)", (user.username,)).fetchone()
    if existing:
        db.close()
        raise HTTPException(status_code=400, detail="Username already exists")
    
    db.execute(
        "INSERT INTO users (username, password_hash, name, role) VALUES (?, ?, ?, ?)",
        (user.username.lower(), hash_pw(user.password), user.name, user.role),
    )
    db.commit()
    new_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
    db.close()
    return {"id": new_id, "username": user.username.lower(), "name": user.name, "role": user.role}

@app.put("/api/users/{user_id}")
def update_user(user_id: int, updates: UserUpdate, request: Request):
    require_admin(request)
    db = get_db()
    row = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        db.close()
        raise HTTPException(status_code=404, detail="User not found")
    
    if updates.name is not None:
        db.execute("UPDATE users SET name = ? WHERE id = ?", (updates.name, user_id))
    if updates.password is not None:
        db.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_pw(updates.password), user_id))
    if updates.role is not None:
        db.execute("UPDATE users SET role = ? WHERE id = ?", (updates.role, user_id))
    db.commit()
    updated = db.execute("SELECT id, username, name, role, created_at FROM users WHERE id = ?", (user_id,)).fetchone()
    db.close()
    return dict(updated)

@app.delete("/api/users/{user_id}")
def delete_user(user_id: int, request: Request):
    session = require_admin(request)
    db = get_db()
    row = db.execute("SELECT username FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        db.close()
        raise HTTPException(status_code=404, detail="User not found")
    # Prevent deleting yourself
    if row["username"].lower() == session["username"].lower():
        db.close()
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    db.execute("DELETE FROM users WHERE id = ?", (user_id,))
    db.commit()
    db.close()
    return {"deleted": user_id}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
