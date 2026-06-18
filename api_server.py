#!/usr/bin/env python3
"""api_server.py — GF Fairfax Installer Portal backend (PostgreSQL/Supabase)."""
import hashlib
import secrets
import os
from contextlib import asynccontextmanager

import psycopg2
import psycopg2.extras
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = os.environ.get("DATABASE_URL", "")


def get_db():
    conn = psycopg2.connect(DATABASE_URL, sslmode="require")
    return conn


def db_cursor(conn):
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)


def hash_pw(password, salt=None):
    if salt is None:
        salt = secrets.token_hex(16)
    h = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}:{h}"


def check_pw(password, stored):
    salt, _ = stored.split(":", 1)
    return hash_pw(password, salt) == stored


def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'installer',
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT '',
            unit TEXT NOT NULL DEFAULT '',
            quantity FLOAT NOT NULL DEFAULT 0,
            low_stock_qty FLOAT NOT NULL DEFAULT 5,
            updated_at TIMESTAMP DEFAULT NOW(),
            updated_by TEXT NOT NULL DEFAULT ''
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS jobs (
            id SERIAL PRIMARY KEY,
            customer_name TEXT NOT NULL,
            address TEXT NOT NULL DEFAULT '',
            job_date TEXT NOT NULL DEFAULT '',
            job_type TEXT NOT NULL DEFAULT 'Other',
            status TEXT NOT NULL DEFAULT 'upcoming',
            assigned_to TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '',
            created_by TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """)
    # Seed default accounts if table is empty
    cur.execute("SELECT COUNT(*) FROM users")
    count = cur.fetchone()[0]
    if count == 0:
        defaults = [
            ("rob", "lV0qPPGhz0", "Rob Ellis", "admin"),
            ("howard", "cNuMzoOZsQ", "Howard", "installer"),
            ("rich", "bmIfJytA5v", "Rich", "installer"),
            ("marvin", "qfR8pPLipP", "Marvin", "installer"),
        ]
        for uname, pw, name, role in defaults:
            cur.execute(
                "INSERT INTO users (username, password_hash, name, role) VALUES (%s, %s, %s, %s)",
                (uname, hash_pw(pw), name, role),
            )
    conn.commit()
    cur.close()
    conn.close()


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

class ProductCreate(BaseModel):
    name: str
    category: str = ""
    unit: str = ""
    quantity: float = 0
    low_stock_qty: float = 5

class ProductUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    unit: str | None = None
    quantity: float | None = None
    low_stock_qty: float | None = None

class JobCreate(BaseModel):
    customer_name: str
    address: str = ""
    job_date: str = ""
    job_type: str = "Other"
    status: str = "upcoming"
    assigned_to: str = ""
    notes: str = ""

class JobUpdate(BaseModel):
    customer_name: str | None = None
    address: str | None = None
    job_date: str | None = None
    job_type: str | None = None
    status: str | None = None
    assigned_to: str | None = None
    notes: str | None = None


# --- Auth ---
sessions = {}  # token -> {username, name, role}

def require_auth(request: Request):
    token = request.headers.get("X-Auth-Token", "")
    session = sessions.get(token)
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return session

def require_admin(request: Request):
    session = require_auth(request)
    if session["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return session


@app.post("/api/login")
def login(req: LoginReq, request: Request):
    conn = get_db()
    cur = db_cursor(conn)
    cur.execute("SELECT * FROM users WHERE LOWER(username) = LOWER(%s)", (req.username,))
    row = cur.fetchone()
    cur.close()
    conn.close()
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


# ==========================================
# USER MANAGEMENT (admin only)
# ==========================================

@app.get("/api/users")
def list_users(request: Request):
    require_admin(request)
    conn = get_db()
    cur = db_cursor(conn)
    cur.execute("SELECT id, username, name, role, created_at FROM users ORDER BY id")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/users", status_code=201)
def create_user(user: UserCreate, request: Request):
    require_admin(request)
    conn = get_db()
    cur = db_cursor(conn)
    cur.execute("SELECT id FROM users WHERE LOWER(username) = LOWER(%s)", (user.username,))
    if cur.fetchone():
        cur.close(); conn.close()
        raise HTTPException(status_code=400, detail="Username already exists")
    cur.execute(
        "INSERT INTO users (username, password_hash, name, role) VALUES (%s, %s, %s, %s) RETURNING id",
        (user.username.lower(), hash_pw(user.password), user.name, user.role),
    )
    new_id = cur.fetchone()["id"]
    conn.commit()
    cur.close(); conn.close()
    return {"id": new_id, "username": user.username.lower(), "name": user.name, "role": user.role}


@app.put("/api/users/{user_id}")
def update_user(user_id: int, updates: UserUpdate, request: Request):
    require_admin(request)
    conn = get_db()
    cur = db_cursor(conn)
    cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    if not cur.fetchone():
        cur.close(); conn.close()
        raise HTTPException(status_code=404, detail="User not found")
    if updates.name is not None:
        cur.execute("UPDATE users SET name = %s WHERE id = %s", (updates.name, user_id))
    if updates.password is not None:
        cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (hash_pw(updates.password), user_id))
    if updates.role is not None:
        cur.execute("UPDATE users SET role = %s WHERE id = %s", (updates.role, user_id))
    conn.commit()
    cur.execute("SELECT id, username, name, role, created_at FROM users WHERE id = %s", (user_id,))
    updated = dict(cur.fetchone())
    cur.close(); conn.close()
    return updated


@app.delete("/api/users/{user_id}")
def delete_user(user_id: int, request: Request):
    session = require_admin(request)
    conn = get_db()
    cur = db_cursor(conn)
    cur.execute("SELECT username FROM users WHERE id = %s", (user_id,))
    row = cur.fetchone()
    if not row:
        cur.close(); conn.close()
        raise HTTPException(status_code=404, detail="User not found")
    if row["username"].lower() == session["username"].lower():
        cur.close(); conn.close()
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
    conn.commit()
    cur.close(); conn.close()
    return {"deleted": user_id}


# ==========================================
# INVENTORY
# ==========================================

@app.get("/api/products")
def list_products(request: Request):
    require_auth(request)
    conn = get_db()
    cur = db_cursor(conn)
    cur.execute("SELECT * FROM products ORDER BY category, name")
    rows = [dict(r) for r in cur.fetchall()]
    cur.close(); conn.close()
    return rows


@app.post("/api/products", status_code=201)
def create_product(product: ProductCreate, request: Request):
    require_admin(request)
    conn = get_db()
    cur = db_cursor(conn)
    cur.execute(
        "INSERT INTO products (name, category, unit, quantity, low_stock_qty) VALUES (%s, %s, %s, %s, %s) RETURNING *",
        (product.name, product.category, product.unit, product.quantity, product.low_stock_qty),
    )
    row = dict(cur.fetchone())
    conn.commit()
    cur.close(); conn.close()
    return row


@app.put("/api/products/{product_id}")
def update_product(product_id: int, updates: ProductUpdate, request: Request):
    session = require_auth(request)
    is_admin = session["role"] == "admin"
    conn = get_db()
    cur = db_cursor(conn)
    cur.execute("SELECT * FROM products WHERE id = %s", (product_id,))
    if not cur.fetchone():
        cur.close(); conn.close()
        raise HTTPException(status_code=404, detail="Product not found")
    if updates.name is not None and is_admin:
        cur.execute("UPDATE products SET name = %s WHERE id = %s", (updates.name, product_id))
    if updates.category is not None and is_admin:
        cur.execute("UPDATE products SET category = %s WHERE id = %s", (updates.category, product_id))
    if updates.unit is not None and is_admin:
        cur.execute("UPDATE products SET unit = %s WHERE id = %s", (updates.unit, product_id))
    if updates.low_stock_qty is not None and is_admin:
        cur.execute("UPDATE products SET low_stock_qty = %s WHERE id = %s", (updates.low_stock_qty, product_id))
    if updates.quantity is not None:
        cur.execute(
            "UPDATE products SET quantity = %s, updated_at = NOW(), updated_by = %s WHERE id = %s",
            (updates.quantity, session["name"], product_id)
        )
    conn.commit()
    cur.execute("SELECT * FROM products WHERE id = %s", (product_id,))
    updated = dict(cur.fetchone())
    cur.close(); conn.close()
    return updated


@app.delete("/api/products/{product_id}")
def delete_product(product_id: int, request: Request):
    require_admin(request)
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM products WHERE id = %s", (product_id,))
    conn.commit()
    cur.close(); conn.close()
    return {"deleted": product_id}


# ==========================================
# JOBS
# ==========================================

@app.get("/api/jobs")
def list_jobs(request: Request):
    require_auth(request)
    conn = get_db()
    cur = db_cursor(conn)
    cur.execute("SELECT * FROM jobs ORDER BY job_date DESC, created_at DESC")
    rows = [dict(r) for r in cur.fetchall()]
    cur.close(); conn.close()
    return rows


@app.post("/api/jobs", status_code=201)
def create_job(job: JobCreate, request: Request):
    session = require_auth(request)
    conn = get_db()
    cur = db_cursor(conn)
    cur.execute(
        "INSERT INTO jobs (customer_name, address, job_date, job_type, status, assigned_to, notes, created_by) VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING *",
        (job.customer_name, job.address, job.job_date, job.job_type, job.status, job.assigned_to, job.notes, session["name"]),
    )
    row = dict(cur.fetchone())
    conn.commit()
    cur.close(); conn.close()
    return row


@app.put("/api/jobs/{job_id}")
def update_job(job_id: int, updates: JobUpdate, request: Request):
    require_auth(request)
    conn = get_db()
    cur = db_cursor(conn)
    cur.execute("SELECT id FROM jobs WHERE id = %s", (job_id,))
    if not cur.fetchone():
        cur.close(); conn.close()
        raise HTTPException(status_code=404, detail="Job not found")
    changed = updates.model_dump(exclude_none=True)
    if changed:
        fields = [f"{k} = %s" for k in changed] + ["updated_at = NOW()"]
        vals = list(changed.values()) + [job_id]
        cur.execute(f"UPDATE jobs SET {', '.join(fields)} WHERE id = %s", vals)
        conn.commit()
    cur.execute("SELECT * FROM jobs WHERE id = %s", (job_id,))
    updated = dict(cur.fetchone())
    cur.close(); conn.close()
    return updated


@app.delete("/api/jobs/{job_id}")
def delete_job(job_id: int, request: Request):
    require_admin(request)
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM jobs WHERE id = %s", (job_id,))
    conn.commit()
    cur.close(); conn.close()
    return {"deleted": job_id}


# --- Serve frontend static files ---
@app.get("/")
def serve_index():
    return FileResponse(os.path.join(BASE_DIR, "index.html"))

app.mount("/", StaticFiles(directory=BASE_DIR), name="static")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
