-- YourProgress database schema (SQLite)
-- This file runs automatically the first time you start the app.
-- It creates database.db in the project folder.

PRAGMA foreign_keys = ON;

-- Teacher / admin login
CREATE TABLE IF NOT EXISTS admins (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL
);

-- Module 1: students
CREATE TABLE IF NOT EXISTS students (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    roll_no       TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name          TEXT NOT NULL,
    course        TEXT NOT NULL,
    semester      INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 6),
    email         TEXT NOT NULL DEFAULT '',
    phone         TEXT NOT NULL DEFAULT '',
    academic_year TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- Marking scheme (TH / INT maximum and minimum marks)
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value REAL NOT NULL
);

-- Module 2: study material (text read from PDF)
CREATE TABLE IF NOT EXISTS materials (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    subject    TEXT NOT NULL DEFAULT '',
    file_name  TEXT NOT NULL DEFAULT '',
    pages      INTEGER NOT NULL DEFAULT 0,
    words      INTEGER NOT NULL DEFAULT 0,
    content    TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- Module 2 and 3: tests and MCQ questions
CREATE TABLE IF NOT EXISTS tests (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT NOT NULL,
    duration_min INTEGER NOT NULL DEFAULT 15 CHECK (duration_min > 0),
    material_id  INTEGER REFERENCES materials(id) ON DELETE SET NULL,
    published    INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS questions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id        INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    position       INTEGER NOT NULL,
    question_text  TEXT NOT NULL,
    option_a       TEXT NOT NULL,
    option_b       TEXT NOT NULL,
    option_c       TEXT NOT NULL,
    option_d       TEXT NOT NULL,
    correct_option INTEGER NOT NULL CHECK (correct_option BETWEEN 0 AND 3)
);
CREATE INDEX IF NOT EXISTS idx_questions_test ON questions(test_id, position);

-- Module 3: test attempts (snapshot keeps the questions as the student saw them)
CREATE TABLE IF NOT EXISTS attempts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id    INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    score      INTEGER NOT NULL,
    total      INTEGER NOT NULL,
    seconds    INTEGER NOT NULL DEFAULT 0,
    taken_at   TEXT NOT NULL,
    snapshot   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempts_student ON attempts(student_id);

-- Module 4: attendance (one session = one date + subject, many student records)
CREATE TABLE IF NOT EXISTS attendance_sessions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    semester     INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 6),
    session_date TEXT NOT NULL,
    subject      TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
    UNIQUE (semester, session_date, subject)
);

CREATE TABLE IF NOT EXISTS attendance_records (
    session_id INTEGER NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    status     TEXT NOT NULL CHECK (status IN ('P','A')),
    PRIMARY KEY (session_id, student_id)
);

-- Module 5: semester marks (TH out of 30, INT out of 20 by default)
CREATE TABLE IF NOT EXISTS subject_marks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    semester     INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 6),
    position     INTEGER NOT NULL DEFAULT 0,
    subject_name TEXT NOT NULL,
    th_marks     REAL NOT NULL CHECK (th_marks >= 0),
    int_marks    REAL NOT NULL CHECK (int_marks >= 0)
);
CREATE INDEX IF NOT EXISTS idx_marks_student ON subject_marks(student_id, semester);
