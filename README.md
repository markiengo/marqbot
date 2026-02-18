# MarqBot - Marquette Finance Course Advisor

MarqBot helps Marquette Finance students choose what courses to take next.
You enter completed/in-progress courses, pick your next semester(s), and get recommendations with prereq checks and degree-progress buckets.

## What This App Does

- Recommends eligible Finance courses based on what you already took
- Supports planning for 1 or 2 semesters
- Shows if a course counts toward multiple requirement buckets
- Includes a "Can I take this next semester?" checker
- Shows estimated terms left for Finance major requirements

## Beginner Setup (Windows, step-by-step)

Use this if you are not technical.

## 1. Install required tools

Install these 3 things first:

1. `Git` (for downloading project code)  
   Download: https://git-scm.com/download/win
2. `Python 3.10+`  
   Download: https://www.python.org/downloads/windows/  
   Important: during install, check `Add Python to PATH`.
3. `VS Code` (optional, but easiest editor)  
   Download: https://code.visualstudio.com/

## 2. Download the project

Option A (recommended): open `Git Bash` or `PowerShell` and run:

```powershell
git clone https://github.com/markiengo/marqbot.git
cd marqbot
```

Option B: on GitHub page, click `Code` -> `Download ZIP`, then extract and open folder.

## 3. Open project folder

If using VS Code:

1. Open VS Code
2. Click `File` -> `Open Folder...`
3. Select the `marqbot` folder

## 4. Create local config file

In project root, create a file named `.env` (same folder as `README.md`) and add:

```env
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o-mini
USE_OPENAI_EXPLANATIONS=0
```

Notes:
- `USE_OPENAI_EXPLANATIONS=0` = faster and cheaper (deterministic mode)
- `USE_OPENAI_EXPLANATIONS=1` = call OpenAI for explanation text

## 5. Install Python packages

From project root in PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## 6. Run the app

From project root:

```powershell
.\.venv\Scripts\python.exe backend/server.py
```

Then open your browser at:

`http://localhost:5000`

## 7. Stop the app

In the same terminal window, press:

`Ctrl + C`

## Common Issues (Quick Fixes)

- Error: `No module named flask`  
  Run install again:
  ```powershell
  .\.venv\Scripts\python.exe -m pip install -r requirements.txt
  ```

- Error: `running scripts is disabled on this system`  
  Do not activate with `Activate.ps1`; run Python directly:
  ```powershell
  .\.venv\Scripts\python.exe backend/server.py
  ```

- Error: `Address already in use` (port 5000 busy)  
  Use another port:
  ```powershell
  $env:PORT=5001; .\.venv\Scripts\python.exe backend/server.py
  ```
  Then open `http://localhost:5001`.

## Project Data File

Main data file:

- `marquette_courses_full.xlsx`

Main sheets:

- `courses`
- `equivalencies`
- `tracks`
- `buckets`
- `bucket_course_map`

## API (for developers)

`POST /recommend` supports:

- `target_semester_primary`
- optional `target_semester_secondary` (`Auto`, explicit label, or `__NONE__`)
- `max_recommendations` (1-4)
- optional `requested_course` for can-take mode

Response includes a `semesters` array for 1-2 semester output.

## Run Tests (optional)

```powershell
.\.venv\Scripts\python.exe -m pytest tests -v
```
