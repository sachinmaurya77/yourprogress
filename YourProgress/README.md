# YourProgress – Online Aptitude Test & Student Performance Analysis System

Frontend: HTML, CSS, JavaScript, Chart.js
Backend: Python Flask
Database: SQLite (file: `database.db`, created automatically)

## Run in VS Code

1. Install Python 3.10 or newer (tick "Add Python to PATH") and VS Code.
2. In VS Code: File > Open Folder > choose this `YourProgress` folder.
3. Open the terminal (Ctrl + `) and run:

   Windows
       python -m venv venv
       venv\Scripts\activate
       pip install -r requirements.txt
       python app.py

   Mac / Linux
       python3 -m venv venv
       source venv/bin/activate
       pip install -r requirements.txt
       python app.py

4. Open http://127.0.0.1:5000 in the browser.

First login
- Admin: username `admin`, password `admin123` (change it in Settings)
- Student: roll number as username. The first password is the same as the roll number,
  unless the admin set another one.

Click "Load sample data" on the dashboard to see six semesters of marks, attendance and test results.
Chart.js loads from the internet (CDN), so connect to the internet the first time.

## VS Code extensions
- Python (Microsoft)
- SQLite Viewer (open `database.db` and see the tables)

## Project structure
    app.py            Flask routes (REST API, login, all modules)
    db.py             SQLite connection helper
    schema.sql        All table definitions
    mcq.py            PDF text -> MCQ generator
    demo.py           Sample test and demo students
    templates/        index.html (single page)
    static/css        style.css
    static/js         app.js (screens, graphs, CGPA calculation)

## Database tables
admins, students, settings, materials, tests, questions, attempts,
attendance_sessions, attendance_records, subject_marks

## Rules used for results
- Subject maximum = TH 30 + INT 20 = 50. TH needs 12 and INT needs 8 to pass (changeable in Settings).
- Percentage = total marks / maximum marks x 100.
- Grade points: 80%+ = 10, 70% = 9, 60% = 8, 55% = 7, 50% = 6, 45% = 5, 40% = 4. A failed subject scores 0.
- SGPA = average grade point of the subjects in one semester. CGPA = average over all saved semesters.
