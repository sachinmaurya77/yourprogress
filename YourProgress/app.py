"""YourProgress - Online Aptitude Test & Student Performance Analysis System.

Flask backend + SQLite database. Run with:  python app.py
"""
import json
import os
import re
import secrets
import sqlite3
import time
from datetime import datetime, timezone
from functools import wraps

from flask import Flask, Response, g, jsonify, render_template, request, session
from werkzeug.security import check_password_hash, generate_password_hash

import db as database
import demo
import mcq

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SETTINGS = {"th_max": 30, "int_max": 20, "th_min": 12, "int_min": 8}


def load_secret_key():
    """Keep one random secret key in secret.key so logins survive a restart."""
    env = os.environ.get("YP_SECRET_KEY")
    if env:
        return env
    path = os.path.join(BASE_DIR, "secret.key")
    if not os.path.exists(path):
        with open(path, "w") as f:
            f.write(secrets.token_hex(32))
    with open(path) as f:
        return f.read().strip()


app = Flask(__name__)
app.config.update(
    DATABASE=os.path.join(BASE_DIR, "database.db"),
    MAX_CONTENT_LENGTH=25 * 1024 * 1024,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    PERMANENT_SESSION_LIFETIME=8 * 3600,
    SEND_FILE_MAX_AGE_DEFAULT=0,
    SECRET_KEY=load_secret_key(),
)
app.teardown_appcontext(database.close_db)
get_db = database.get_db


# ---------------------------------------------------------------- helpers
class ApiError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message, self.status = message, status


@app.errorhandler(ApiError)
def handle_api_error(e):
    return jsonify(error=e.message), e.status


@app.errorhandler(413)
def too_large(_e):
    return jsonify(error="The file is larger than 25 MB. Split it and try again."), 413


@app.errorhandler(404)
def not_found(_e):
    if request.path.startswith("/api/"):
        return jsonify(error="Not found."), 404
    return "Not found", 404


@app.errorhandler(500)
def server_error(_e):
    if request.path.startswith("/api/"):
        return jsonify(error="Server error. Check the terminal for details."), 500
    return "Server error", 500


@app.before_request
def block_cross_site_writes():
    # Our own pages always send this header; other websites cannot add it.
    if request.path.startswith("/api/") and request.method in ("POST", "PUT", "DELETE"):
        if request.headers.get("X-Requested-With") != "YourProgress":
            raise ApiError("Blocked request.", 403)


@app.after_request
def no_cache_api(resp):
    if request.path.startswith("/api/"):
        resp.headers["Cache-Control"] = "no-store"
    return resp


def to_int(value, label="Value"):
    try:
        return int(value)
    except (TypeError, ValueError):
        raise ApiError(f"{label} is not valid.")


def to_float(value, label="Value"):
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise ApiError(f"{label} must be a number.")
    if number != number or number in (float("inf"), float("-inf")):
        raise ApiError(f"{label} must be a number.")
    return number


def tidy(number):
    return int(number) if float(number).is_integer() else float(number)


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        role, uid = session.get("role"), session.get("uid")
        if not role or not uid:
            raise ApiError("Please sign in.", 401)
        table = "admins" if role == "admin" else "students"
        if not get_db().execute(f"SELECT 1 FROM {table} WHERE id=?", (uid,)).fetchone():
            session.clear()
            raise ApiError("Please sign in again.", 401)
        return fn(*args, **kwargs)
    return wrapper


def role_required(role):
    def decorator(fn):
        @wraps(fn)
        @login_required
        def wrapper(*args, **kwargs):
            if session.get("role") != role:
                raise ApiError("You do not have access to this.", 403)
            return fn(*args, **kwargs)
        return wrapper
    return decorator


admin_required = role_required("admin")
student_required = role_required("student")


def get_scheme(db):
    s = {r["key"]: r["value"] for r in db.execute("SELECT key, value FROM settings")}
    return {
        "thMax": tidy(s.get("th_max", 30)), "thMin": tidy(s.get("th_min", 12)),
        "intMax": tidy(s.get("int_max", 20)), "intMin": tidy(s.get("int_min", 8)),
    }


# ---------------------------------------------------------------- pages
@app.get("/")
def index():
    return render_template("index.html")


# ---------------------------------------------------------------- auth
FAILED_LOGINS = {}


def too_many_attempts():
    now = time.time()
    recent = [t for t in FAILED_LOGINS.get(request.remote_addr, []) if now - t < 300]
    FAILED_LOGINS[request.remote_addr] = recent
    return len(recent) >= 8


@app.post("/api/login")
def login():
    d = request.get_json(silent=True) or {}
    role = d.get("role")
    username = str(d.get("username", "")).strip()
    password = str(d.get("password", ""))
    if too_many_attempts():
        raise ApiError("Too many wrong attempts. Wait a few minutes and try again.", 429)
    db = get_db()
    if role == "admin":
        row = db.execute("SELECT * FROM admins WHERE username=?", (username,)).fetchone()
        message = "Username or password is incorrect."
    elif role == "student":
        row = db.execute("SELECT * FROM students WHERE roll_no=?", (username,)).fetchone()
        message = "Roll number or password is incorrect."
    else:
        raise ApiError("Choose Admin or Student.")
    if not row or not check_password_hash(row["password_hash"], password):
        FAILED_LOGINS.setdefault(request.remote_addr, []).append(time.time())
        raise ApiError(message, 401)
    FAILED_LOGINS.pop(request.remote_addr, None)
    session.clear()
    session.update(role=role, uid=row["id"])
    session.permanent = True
    return jsonify(ok=True)


@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify(ok=True)


# ---------------------------------------------------------------- data for the page
def attempt_json(r, with_snapshot):
    out = {
        "id": str(r["id"]), "testId": str(r["test_id"]), "studentId": str(r["student_id"]),
        "title": r["title"], "score": r["score"], "total": r["total"],
        "secs": r["seconds"], "date": r["taken_at"],
    }
    if with_snapshot:
        out["snap"] = json.loads(r["snapshot"])
    return out


def class_average(db, scheme):
    per_max = scheme["thMax"] + scheme["intMax"]
    by_sem = {}
    rows = db.execute(
        "SELECT student_id, semester, COUNT(*) AS n, SUM(th_marks + int_marks) AS total"
        " FROM subject_marks GROUP BY student_id, semester"
    ).fetchall()
    for r in rows:
        if per_max:
            by_sem.setdefault(r["semester"], []).append(r["total"] / (r["n"] * per_max) * 100)
    return [round(sum(by_sem[n]) / len(by_sem[n]), 1) if by_sem.get(n) else None for n in range(1, 7)]


@app.get("/api/bootstrap")
@login_required
def bootstrap():
    db = get_db()
    admin = session["role"] == "admin"
    uid = session["uid"]
    scheme = get_scheme(db)
    if admin:
        scheme["adminUser"] = db.execute("SELECT username FROM admins WHERE id=?", (uid,)).fetchone()["username"]

    if admin:
        student_rows = db.execute("SELECT * FROM students ORDER BY id").fetchall()
    else:
        student_rows = db.execute("SELECT * FROM students WHERE id=?", (uid,)).fetchall()
    students = [{
        "id": str(r["id"]), "roll": r["roll_no"], "name": r["name"], "course": r["course"],
        "semester": r["semester"], "email": r["email"], "phone": r["phone"], "year": r["academic_year"],
    } for r in student_rows]

    materials = []
    if admin:
        for r in db.execute("SELECT * FROM materials ORDER BY id"):
            materials.append({
                "id": str(r["id"]), "title": r["title"], "subject": r["subject"], "pages": r["pages"],
                "words": r["words"], "createdAt": r["created_at"], "preview": r["content"][:2500],
            })

    test_rows = db.execute(
        "SELECT * FROM tests" + ("" if admin else " WHERE published=1") + " ORDER BY id").fetchall()
    questions = {}
    for q in db.execute("SELECT * FROM questions ORDER BY test_id, position"):
        item = {"q": q["question_text"], "options": [q["option_a"], q["option_b"], q["option_c"], q["option_d"]]}
        if admin:
            item["answer"] = q["correct_option"]
        questions.setdefault(q["test_id"], []).append(item)
    tests = [{
        "id": str(t["id"]), "title": t["title"], "duration": t["duration_min"],
        "materialId": str(t["material_id"]) if t["material_id"] else None,
        "published": bool(t["published"]), "createdAt": t["created_at"],
        "questions": questions.get(t["id"], []),
    } for t in test_rows]

    if admin:
        attempts = [attempt_json(r, False) for r in db.execute(
            "SELECT id, test_id, student_id, title, score, total, seconds, taken_at FROM attempts ORDER BY id")]
    else:
        attempts = [attempt_json(r, True) for r in db.execute(
            "SELECT * FROM attempts WHERE student_id=? ORDER BY id", (uid,))]

    records = {}
    rec_sql = "SELECT session_id, student_id, status FROM attendance_records"
    rec_rows = db.execute(rec_sql) if admin else db.execute(rec_sql + " WHERE student_id=?", (uid,))
    for r in rec_rows:
        records.setdefault(r["session_id"], {})[str(r["student_id"])] = r["status"]
    attendance = [{
        "id": str(s["id"]), "sem": s["semester"], "date": s["session_date"], "subject": s["subject"],
        "records": records[s["id"]],
    } for s in db.execute("SELECT * FROM attendance_sessions ORDER BY session_date, id") if s["id"] in records]

    marks_map = {}
    mark_sql = "SELECT * FROM subject_marks"
    mark_rows = db.execute(mark_sql + " ORDER BY student_id, semester, position, id") if admin else db.execute(
        mark_sql + " WHERE student_id=? ORDER BY semester, position, id", (uid,))
    for m in mark_rows:
        key = (m["student_id"], m["semester"])
        entry = marks_map.setdefault(key, {
            "id": f"{key[0]}-{key[1]}", "studentId": str(key[0]), "sem": key[1], "subjects": []})
        entry["subjects"].append({"name": m["subject_name"], "th": tidy(m["th_marks"]), "int": tidy(m["int_marks"])})

    return jsonify(
        user={"role": session["role"], "id": str(uid)},
        data={
            "settings": scheme, "students": students, "materials": materials, "tests": tests,
            "attempts": attempts, "attendance": attendance, "marks": list(marks_map.values()),
            "classAvg": class_average(db, scheme),
        },
    )


# ---------------------------------------------------------------- Module 1: students
def read_student_fields(d):
    roll = str(d.get("roll", "")).strip()
    name = str(d.get("name", "")).strip()
    course = str(d.get("course", "")).strip()
    if not roll or not name or not course:
        raise ApiError("Roll no., name and course are required.")
    sem = to_int(d.get("semester"), "Semester")
    if not 1 <= sem <= 6:
        raise ApiError("Semester must be between 1 and 6.")
    if max(len(roll), len(name), len(course)) > 100:
        raise ApiError("Roll no., name or course is too long.")
    return (roll, name, course, sem, str(d.get("email", "")).strip()[:120],
            str(d.get("phone", "")).strip()[:30], str(d.get("year", "")).strip()[:20])


@app.post("/api/students")
@admin_required
def add_student():
    d = request.get_json(silent=True) or {}
    roll, name, course, sem, email, phone, year = read_student_fields(d)
    password = str(d.get("password", "")) or roll
    db = get_db()
    try:
        with db:
            cur = db.execute(
                "INSERT INTO students (roll_no, name, course, semester, email, phone, academic_year, password_hash)"
                " VALUES (?,?,?,?,?,?,?,?)",
                (roll, name, course, sem, email, phone, year, generate_password_hash(password)))
    except sqlite3.IntegrityError:
        raise ApiError("This roll number already exists.", 409)
    return jsonify(ok=True, id=str(cur.lastrowid))


@app.put("/api/students/<int:sid>")
@admin_required
def edit_student(sid):
    d = request.get_json(silent=True) or {}
    roll, name, course, sem, email, phone, year = read_student_fields(d)
    db = get_db()
    if not db.execute("SELECT 1 FROM students WHERE id=?", (sid,)).fetchone():
        raise ApiError("Student not found.", 404)
    try:
        with db:
            db.execute(
                "UPDATE students SET roll_no=?, name=?, course=?, semester=?, email=?, phone=?, academic_year=?"
                " WHERE id=?", (roll, name, course, sem, email, phone, year, sid))
            if d.get("password"):
                db.execute("UPDATE students SET password_hash=? WHERE id=?",
                           (generate_password_hash(str(d["password"])), sid))
    except sqlite3.IntegrityError:
        raise ApiError("This roll number already exists.", 409)
    return jsonify(ok=True)


@app.delete("/api/students/<int:sid>")
@admin_required
def delete_student(sid):
    db = get_db()
    with db:
        db.execute("DELETE FROM students WHERE id=?", (sid,))  # marks, attendance, attempts go with it
    return jsonify(ok=True)


# ---------------------------------------------------------------- Module 2: PDF + MCQs
def extract_pdf(stream):
    try:
        from pypdf import PdfReader
        reader = PdfReader(stream)
        if reader.is_encrypted:
            reader.decrypt("")
        pages = len(reader.pages)
        text = "\n\n".join((p.extract_text() or "") for p in reader.pages[:300])
        return text, pages
    except ImportError:
        raise ApiError("PDF support is missing. Run: pip install pypdf", 500)
    except Exception:
        raise ApiError("This file could not be read as a PDF.", 422)


@app.post("/api/materials")
@admin_required
def add_material():
    file = request.files.get("file")
    if file:
        filename = file.filename or "study-material.pdf"
        head = file.stream.read(5)
        file.stream.seek(0)
        if not filename.lower().endswith(".pdf") or head != b"%PDF-":
            raise ApiError("This file is not a PDF.", 415)
        title = request.form.get("title", "").strip() or re.sub(r"\.pdf$", "", filename, flags=re.I)
        subject = request.form.get("subject", "").strip()
        raw, pages = extract_pdf(file.stream)
        empty_msg = ("This PDF has almost no selectable text. It may be a scanned image. "
                     "Try another PDF or paste the text.")
    else:
        d = request.get_json(silent=True) or {}
        title = str(d.get("title", "")).strip()
        subject = str(d.get("subject", "")).strip()
        raw, pages, filename = str(d.get("text", "")), 0, ""
        if not title:
            raise ApiError("Give the material a title.")
        empty_msg = "Add at least a few paragraphs of text."
    text = mcq.clean_text(raw)[:150000]
    if len(re.sub(r"\s", "", text)) < 200:
        raise ApiError(empty_msg, 422)
    db = get_db()
    with db:
        cur = db.execute(
            "INSERT INTO materials (title, subject, file_name, pages, words, content) VALUES (?,?,?,?,?,?)",
            (title[:150], subject[:80], filename[:200], pages, len(text.split()), text))
    return jsonify(ok=True, id=str(cur.lastrowid))


@app.delete("/api/materials/<int:mid>")
@admin_required
def delete_material(mid):
    db = get_db()
    with db:
        db.execute("DELETE FROM materials WHERE id=?", (mid,))
    return jsonify(ok=True)


@app.post("/api/materials/<int:mid>/generate")
@admin_required
def generate_questions(mid):
    row = get_db().execute("SELECT content FROM materials WHERE id=?", (mid,)).fetchone()
    if not row:
        raise ApiError("Study material not found.", 404)
    count = max(3, min(40, to_int((request.get_json(silent=True) or {}).get("n", 10), "Number of questions")))
    questions = mcq.generate_mcqs(row["content"], count)
    if not questions:
        raise ApiError("Not enough full sentences were found in this material to create questions.", 422)
    return jsonify(questions=questions)


# ---------------------------------------------------------------- Module 2/3: tests
def clean_questions(items):
    if not isinstance(items, list) or not items:
        raise ApiError("Add at least one question.")
    if len(items) > 100:
        raise ApiError("A test can have at most 100 questions.")
    out = []
    for i, q in enumerate(items, 1):
        if not isinstance(q, dict):
            raise ApiError(f"Question {i} is not valid.")
        text = str(q.get("q", "")).strip()
        options = [str(o).strip() for o in (q.get("options") or [])]
        answer = q.get("answer")
        if not text:
            raise ApiError(f"Question {i} has no text.")
        if len(options) != 4 or any(not o for o in options):
            raise ApiError(f"Question {i} needs all four options.")
        if len({o.lower() for o in options}) < 4:
            raise ApiError(f"Question {i} has repeated options.")
        if not isinstance(answer, int) or isinstance(answer, bool) or not 0 <= answer <= 3:
            raise ApiError(f"Question {i} needs a correct answer.")
        out.append((text, options, answer))
    return out


def write_test(db, test_id, d):
    title = str(d.get("title", "")).strip()
    if not title:
        raise ApiError("Give the test a title.")
    duration = to_int(d.get("duration", 15), "Time limit")
    if not 1 <= duration <= 300:
        raise ApiError("Time limit must be between 1 and 300 minutes.")
    questions = clean_questions(d.get("questions"))
    material_id = None
    if d.get("materialId") not in (None, ""):
        mid = to_int(d.get("materialId"), "Material")
        if db.execute("SELECT 1 FROM materials WHERE id=?", (mid,)).fetchone():
            material_id = mid
    published = 1 if d.get("published") else 0
    with db:
        if test_id is None:
            cur = db.execute(
                "INSERT INTO tests (title, duration_min, material_id, published, created_at) VALUES (?,?,?,?,?)",
                (title[:150], duration, material_id, published, now_iso()))
            test_id = cur.lastrowid
        else:
            if not db.execute("SELECT 1 FROM tests WHERE id=?", (test_id,)).fetchone():
                raise ApiError("Test not found.", 404)
            db.execute("UPDATE tests SET title=?, duration_min=?, material_id=?, published=? WHERE id=?",
                       (title[:150], duration, material_id, published, test_id))
            db.execute("DELETE FROM questions WHERE test_id=?", (test_id,))
        demo.insert_questions(db, test_id, questions)
    return test_id


@app.post("/api/tests")
@admin_required
def add_test():
    return jsonify(ok=True, id=str(write_test(get_db(), None, request.get_json(silent=True) or {})))


@app.put("/api/tests/<int:tid>")
@admin_required
def edit_test(tid):
    write_test(get_db(), tid, request.get_json(silent=True) or {})
    return jsonify(ok=True)


@app.post("/api/tests/<int:tid>/publish")
@admin_required
def publish_test(tid):
    db = get_db()
    flag = 1 if (request.get_json(silent=True) or {}).get("published") else 0
    with db:
        db.execute("UPDATE tests SET published=? WHERE id=?", (flag, tid))
    return jsonify(ok=True)


@app.delete("/api/tests/<int:tid>")
@admin_required
def delete_test(tid):
    db = get_db()
    with db:
        db.execute("DELETE FROM tests WHERE id=?", (tid,))
    return jsonify(ok=True)


@app.post("/api/tests/<int:tid>/start")
@student_required
def start_test(tid):
    if not get_db().execute("SELECT 1 FROM tests WHERE id=? AND published=1", (tid,)).fetchone():
        raise ApiError("This test is not available.", 404)
    session[f"exam_{tid}"] = time.time()
    return jsonify(ok=True)


@app.post("/api/tests/<int:tid>/submit")
@student_required
def submit_test(tid):
    db = get_db()
    test = db.execute("SELECT * FROM tests WHERE id=? AND published=1", (tid,)).fetchone()
    if not test:
        raise ApiError("This test is not available.", 404)
    rows = db.execute("SELECT * FROM questions WHERE test_id=? ORDER BY position", (tid,)).fetchall()
    answers = (request.get_json(silent=True) or {}).get("answers")
    answers = answers if isinstance(answers, list) else []
    snapshot, score = [], 0
    for i, q in enumerate(rows):
        pick = answers[i] if i < len(answers) else -1
        if not isinstance(pick, int) or isinstance(pick, bool) or not 0 <= pick <= 3:
            pick = -1
        score += pick == q["correct_option"]
        snapshot.append({
            "q": q["question_text"],
            "options": [q["option_a"], q["option_b"], q["option_c"], q["option_d"]],
            "answer": q["correct_option"], "pick": pick,
        })
    started = session.pop(f"exam_{tid}", None)
    seconds = int(min(max(time.time() - started, 0), test["duration_min"] * 60)) if started else 0
    with db:
        cur = db.execute(
            "INSERT INTO attempts (test_id, student_id, title, score, total, seconds, taken_at, snapshot)"
            " VALUES (?,?,?,?,?,?,?,?)",
            (tid, session["uid"], test["title"], score, len(rows), seconds, now_iso(), json.dumps(snapshot)))
    row = db.execute("SELECT * FROM attempts WHERE id=?", (cur.lastrowid,)).fetchone()
    return jsonify(attempt=attempt_json(row, True))


# ---------------------------------------------------------------- Module 4: attendance
@app.post("/api/attendance")
@admin_required
def save_attendance():
    d = request.get_json(silent=True) or {}
    sem = to_int(d.get("sem"), "Semester")
    if not 1 <= sem <= 6:
        raise ApiError("Semester must be between 1 and 6.")
    day = str(d.get("date", ""))
    try:
        datetime.strptime(day, "%Y-%m-%d")
    except ValueError:
        raise ApiError("Choose a valid date.")
    subject = str(d.get("subject", "")).strip()[:80]
    records = d.get("records")
    if not isinstance(records, dict) or not records:
        raise ApiError("No students to save.")
    db = get_db()
    known = {r["id"] for r in db.execute("SELECT id FROM students")}
    with db:
        db.execute("INSERT OR IGNORE INTO attendance_sessions (semester, session_date, subject) VALUES (?,?,?)",
                   (sem, day, subject))
        session_id = db.execute(
            "SELECT id FROM attendance_sessions WHERE semester=? AND session_date=? AND subject=?",
            (sem, day, subject)).fetchone()["id"]
        for key, status in records.items():
            sid = to_int(key, "Student")
            if status not in ("P", "A"):
                raise ApiError("Attendance must be Present or Absent.")
            if sid in known:
                db.execute("INSERT OR REPLACE INTO attendance_records (session_id, student_id, status) VALUES (?,?,?)",
                           (session_id, sid, status))
    return jsonify(ok=True)


@app.delete("/api/attendance/<int:sess_id>")
@admin_required
def delete_attendance(sess_id):
    db = get_db()
    with db:
        db.execute("DELETE FROM attendance_sessions WHERE id=?", (sess_id,))
    return jsonify(ok=True)


# ---------------------------------------------------------------- Module 5: marks
@app.post("/api/marks")
@admin_required
def save_marks():
    d = request.get_json(silent=True) or {}
    sid = to_int(d.get("studentId"), "Student")
    sem = to_int(d.get("sem"), "Semester")
    if not 1 <= sem <= 6:
        raise ApiError("Semester must be between 1 and 6.")
    subjects = d.get("subjects")
    if not isinstance(subjects, list) or not subjects:
        raise ApiError("Enter marks for at least one subject.")
    if len(subjects) > 30:
        raise ApiError("At most 30 subjects per semester.")
    db = get_db()
    if not db.execute("SELECT 1 FROM students WHERE id=?", (sid,)).fetchone():
        raise ApiError("Student not found.", 404)
    scheme = get_scheme(db)
    clean = []
    for pos, s in enumerate(subjects):
        name = str((s or {}).get("name", "")).strip()[:80]
        if not name:
            raise ApiError(f"Row {pos + 1}: enter the subject name.")
        th = to_float(s.get("th"), f"{name}: TH marks")
        it = to_float(s.get("int"), f"{name}: INT marks")
        if not 0 <= th <= scheme["thMax"] or not 0 <= it <= scheme["intMax"]:
            raise ApiError(f"{name}: marks are outside the allowed range.")
        clean.append((sid, sem, pos, name, th, it))
    with db:
        db.execute("DELETE FROM subject_marks WHERE student_id=? AND semester=?", (sid, sem))
        db.executemany(
            "INSERT INTO subject_marks (student_id, semester, position, subject_name, th_marks, int_marks)"
            " VALUES (?,?,?,?,?,?)", clean)
    return jsonify(ok=True)


@app.delete("/api/marks/<int:sid>/<int:sem>")
@admin_required
def delete_marks(sid, sem):
    db = get_db()
    with db:
        db.execute("DELETE FROM subject_marks WHERE student_id=? AND semester=?", (sid, sem))
    return jsonify(ok=True)


# ---------------------------------------------------------------- settings, account, backup
@app.put("/api/settings")
@admin_required
def save_settings():
    d = request.get_json(silent=True) or {}
    th_max = to_float(d.get("thMax"), "TH maximum")
    th_min = to_float(d.get("thMin"), "TH minimum")
    int_max = to_float(d.get("intMax"), "INT maximum")
    int_min = to_float(d.get("intMin"), "INT minimum")
    if th_max < 1 or int_max < 1 or th_min < 0 or int_min < 0:
        raise ApiError("Enter valid numbers.")
    if th_min > th_max or int_min > int_max:
        raise ApiError("Minimum marks cannot be more than maximum marks.")
    db = get_db()
    with db:
        for key, val in (("th_max", th_max), ("th_min", th_min), ("int_max", int_max), ("int_min", int_min)):
            db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)", (key, val))
    return jsonify(ok=True)


@app.put("/api/account")
@admin_required
def update_account():
    d = request.get_json(silent=True) or {}
    username = str(d.get("username", "")).strip()
    old, new = str(d.get("oldPassword", "")), str(d.get("newPassword", ""))
    if not username:
        raise ApiError("Username cannot be empty.")
    db = get_db()
    row = db.execute("SELECT * FROM admins WHERE id=?", (session["uid"],)).fetchone()
    if new or old:
        if not check_password_hash(row["password_hash"], old):
            raise ApiError("Current password is incorrect.")
        if len(new) < 6:
            raise ApiError("New password must be at least 6 characters.")
    try:
        with db:
            db.execute("UPDATE admins SET username=? WHERE id=?", (username, row["id"]))
            if new:
                db.execute("UPDATE admins SET password_hash=? WHERE id=?",
                           (generate_password_hash(new), row["id"]))
    except sqlite3.IntegrityError:
        raise ApiError("This username is already taken.", 409)
    return jsonify(ok=True)


@app.get("/api/backup")
@admin_required
def backup():
    db = get_db()
    dump = {}
    for table in ("settings", "students", "materials", "tests", "questions", "attempts",
                  "attendance_sessions", "attendance_records", "subject_marks"):
        rows = [dict(r) for r in db.execute(f"SELECT * FROM {table}")]
        for r in rows:
            r.pop("password_hash", None)
        dump[table] = rows
    name = "yourprogress-backup-" + datetime.now().strftime("%Y-%m-%d") + ".json"
    return Response(json.dumps(dump, indent=1), mimetype="application/json",
                    headers={"Content-Disposition": f'attachment; filename="{name}"'})


@app.post("/api/reset")
@admin_required
def reset_all():
    db = get_db()
    with db:
        for table in ("attempts", "attendance_records", "attendance_sessions", "subject_marks",
                      "questions", "tests", "materials", "students"):
            db.execute(f"DELETE FROM {table}")
        for key, val in DEFAULT_SETTINGS.items():
            db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)", (key, val))
        demo.seed_sample_test(db)
    return jsonify(ok=True)


@app.post("/api/demo")
@admin_required
def load_demo():
    db = get_db()
    with db:
        added = demo.seed_demo(db, get_scheme(db))
    return jsonify(ok=True, added=added)


# ---------------------------------------------------------------- start-up
def bootstrap_database():
    """Create database.db from schema.sql on first run and add the defaults."""
    conn = database.connect(app.config["DATABASE"])
    with open(os.path.join(BASE_DIR, "schema.sql"), encoding="utf-8") as f:
        conn.executescript(f.read())
    with conn:
        for key, val in DEFAULT_SETTINGS.items():
            conn.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?,?)", (key, val))
        if not conn.execute("SELECT 1 FROM admins").fetchone():
            conn.execute("INSERT INTO admins (username, password_hash) VALUES (?,?)",
                         ("admin", generate_password_hash("admin123")))
        if not conn.execute("SELECT 1 FROM settings WHERE key='seeded'").fetchone():
            if not conn.execute("SELECT 1 FROM tests").fetchone():
                demo.seed_sample_test(conn)
            conn.execute("INSERT INTO settings (key, value) VALUES ('seeded', 1)")
    conn.close()


bootstrap_database()

if __name__ == "__main__":
    app.run(host="127.0.0.3", port=5000, debug=True)
