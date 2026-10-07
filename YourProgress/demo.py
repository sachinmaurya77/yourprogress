"""Sample aptitude test and optional demo students (marks, attendance, test attempts)."""
import json
import random
from datetime import date, datetime, timedelta, timezone

from werkzeug.security import generate_password_hash

SAMPLE_TITLE = "General Aptitude Test (Sample)"

SAMPLE_QUESTIONS = [
    ("A train travels 120 km in 2 hours. What is its speed in km/h?", ["40", "50", "60", "80"], 2),
    ("What is 15% of 240?", ["24", "30", "36", "40"], 2),
    ("Find the next number: 2, 6, 12, 20, 30, ?", ["36", "40", "42", "48"], 2),
    ("An item bought for ₹400 is sold for ₹500. What is the profit percentage?", ["20%", "25%", "30%", "15%"], 1),
    ("What is the average of 10, 20, 30, 40 and 50?", ["25", "30", "35", "40"], 1),
    ('Pointing to a photo, Ravi says, "He is the son of my father\'s only son." Who is in the photo?',
     ["Ravi's brother", "Ravi's son", "Ravi's father", "Ravi's nephew"], 1),
    ("Which one is the odd one out?", ["Apple", "Banana", "Carrot", "Mango"], 2),
    ('Choose the word closest in meaning to "abundant".', ["Scarce", "Plentiful", "Rare", "Limited"], 1),
    ('Choose the word opposite in meaning to "expand".', ["Contract", "Grow", "Extend", "Stretch"], 0),
    ("Which sentence is grammatically correct?",
     ["She don't like tea.", "She doesn't like tea.", "She not like tea.", "She didn't liking tea."], 1),
    ("8 men can finish a job in 12 days. How many days will 6 men need?", ["14", "16", "18", "20"], 1),
    ("Find the missing number: 3, 9, 27, 81, ?", ["162", "216", "243", "324"], 2),
    ("If CODE is written as DPEF, how is BAD written in the same code?", ["CBE", "CAE", "DBE", "BCE"], 0),
    ("What is the simple interest on ₹1000 at 10% per year for 2 years?", ["₹100", "₹150", "₹200", "₹250"], 2),
    ("Which of these numbers is divisible by 9?", ["1234", "5238", "7312", "4561"], 1),
]

SEM_SUBJECTS = {
    1: ["Programming Principles", "Digital Electronics", "Discrete Mathematics", "Communication Skills",
        "Environmental Awareness", "Programming Lab", "Electronics Lab", "Mathematics Lab"],
    2: ["Object Oriented Programming", "Data Structures", "Linear Algebra", "Database Systems",
        "Web Programming", "OOP Lab", "Data Structures Lab", "DBMS Lab"],
    3: ["Operating Systems", "Computer Networks", "Python Programming", "Statistics", "Software Engineering",
        "Python Lab", "Networks Lab", "Statistics Lab", "Soft Skills"],
    4: ["Java Programming", "Theory of Computation", "Computer Graphics", "Core Java Lab", "Graphics Lab",
        "Applied Mathematics", "Research Methods"],
    5: ["Cyber and Information Security", "Ethical Hacking", "Android Development", "Data Mining", "Mini Project",
        "Security Lab", "Android Lab", "Ethical Hacking Lab", "Indian Knowledge Systems"],
    6: ["Cloud Computing", "Machine Learning", "Software Testing", "Information Retrieval", "Project Management",
        "Data Analytics", "Cyber Law", "Cloud Lab", "Machine Learning Lab", "Testing Lab", "Major Project"],
}

# roll, name, base performance for sem 1..6, attendance chance, test skill
PEOPLE = [
    ("151", "Sachin Maurya", [.68, .70, .72, .75, .78, .82], .93, .80),
    ("101", "Priya Sharma", [.86, .88, .87, .90, .89, .91], .97, .90),
    ("118", "Rohan Patil", [.58, .50, .60, .55, .63, .66], .68, .55),
    ("134", "Aditi Singh", [.70, .66, .72, .74, .71, .77], .84, .70),
]


def now_iso(offset_days=0):
    return (datetime.now(timezone.utc) - timedelta(days=offset_days)).strftime("%Y-%m-%dT%H:%M:%SZ")


def insert_questions(db, test_id, questions):
    for pos, (text, opts, ans) in enumerate(questions):
        db.execute(
            "INSERT INTO questions (test_id, position, question_text, option_a, option_b, option_c, option_d,"
            " correct_option) VALUES (?,?,?,?,?,?,?,?)",
            (test_id, pos, text, opts[0], opts[1], opts[2], opts[3], ans),
        )


def seed_sample_test(db):
    cur = db.execute(
        "INSERT INTO tests (title, duration_min, published, created_at) VALUES (?,?,1,?)",
        (SAMPLE_TITLE, 20, now_iso()),
    )
    insert_questions(db, cur.lastrowid, SAMPLE_QUESTIONS)


def _clamp(v, lo, hi):
    return max(lo, min(hi, v))


def seed_demo(db, scheme):
    """Add the demo students. Returns how many were added."""
    th_max, int_max = scheme["thMax"], scheme["intMax"]
    th_min, int_min = scheme["thMin"], scheme["intMin"]

    dates, d = [], date.today()
    while len(dates) < 12:
        d -= timedelta(days=1)
        if d.weekday() < 5:
            dates.append(d.isoformat())
    subjects = ["Cloud Computing", "Machine Learning", "Software Testing"]

    test = db.execute("SELECT id, title FROM tests ORDER BY id LIMIT 1").fetchone()
    questions = []
    if test:
        questions = db.execute(
            "SELECT * FROM questions WHERE test_id=? ORDER BY position", (test["id"],)
        ).fetchall()

    added = 0
    for roll, name, base, att, skill in PEOPLE:
        if db.execute("SELECT 1 FROM students WHERE roll_no=?", (roll,)).fetchone():
            continue
        r = random.Random(int(roll) * 7919)
        cur = db.execute(
            "INSERT INTO students (roll_no, name, course, semester, email, academic_year, password_hash)"
            " VALUES (?,?,?,?,?,?,?)",
            (roll, name, "B.Sc. Computer Science", 6, name.split()[0].lower() + "@example.com", "2025-26",
             generate_password_hash(roll)),
        )
        sid = cur.lastrowid
        added += 1

        for sem in range(1, 7):
            rows = []
            for pos, subject in enumerate(SEM_SUBJECTS[sem]):
                ability = base[sem - 1] + (r.random() - .5) * .16
                th = int(_clamp(ability + (r.random() - .5) * .14, .3, 1) * th_max + .5)
                it = int(_clamp(ability + .05 + (r.random() - .5) * .12, .4, 1) * int_max + .5)
                rows.append([pos, subject, th, it])
            if roll == "118" and sem == 2:
                rows[2][2] = max(0, th_min - 4)   # one failed TH paper
            if roll == "118" and sem == 4:
                rows[4][3] = max(0, int_min - 3)  # one failed INT paper
            db.executemany(
                "INSERT INTO subject_marks (student_id, semester, position, subject_name, th_marks, int_marks)"
                " VALUES (?,?,?,?,?,?)",
                [(sid, sem, p, s, t, i) for p, s, t, i in rows],
            )

        for i, day in enumerate(dates):
            subject = subjects[i % 3]
            db.execute(
                "INSERT OR IGNORE INTO attendance_sessions (semester, session_date, subject) VALUES (6,?,?)",
                (day, subject),
            )
            session_id = db.execute(
                "SELECT id FROM attendance_sessions WHERE semester=6 AND session_date=? AND subject=?",
                (day, subject),
            ).fetchone()["id"]
            db.execute(
                "INSERT OR REPLACE INTO attendance_records (session_id, student_id, status) VALUES (?,?,?)",
                (session_id, sid, "P" if r.random() < att else "A"),
            )

        if test and questions:
            for k, ago in enumerate((10, 3)):
                prob = _clamp(skill - .1 + k * .1, .2, .95)
                snap, score = [], 0
                for q in questions:
                    correct = q["correct_option"]
                    if r.random() < prob:
                        pick = correct
                    else:
                        pick = r.choice([x for x in range(4) if x != correct])
                    score += pick == correct
                    snap.append({
                        "q": q["question_text"],
                        "options": [q["option_a"], q["option_b"], q["option_c"], q["option_d"]],
                        "answer": correct,
                        "pick": pick,
                    })
                db.execute(
                    "INSERT INTO attempts (test_id, student_id, title, score, total, seconds, taken_at, snapshot)"
                    " VALUES (?,?,?,?,?,?,?,?)",
                    (test["id"], sid, test["title"], score, len(snap), int(300 + r.random() * 500),
                     now_iso(ago), json.dumps(snap)),
                )
    return added
