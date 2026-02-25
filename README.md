# MarqBot

![Version](https://img.shields.io/badge/version-v1.9.2-003366?style=for-the-badge\&logo=bookstack\&logoColor=ffcc00)
![Audience](https://img.shields.io/badge/audience-students%20%26%20advisors-0A7E8C?style=for-the-badge)

MarqBot is a course-planning helper for Marquette business students.
It helps students understand where they are in their degree and what classes to take next.

---

## What MarqBot Helps You Do

* Plan the next semester based on completed and in-progress classes
* See degree progress in clear requirement groups
* Check whether a specific class is likely available next term
* Get early warnings about possible blockers (prerequisites, class standing, major/track rules)
* Build multi-semester plans to visualize a clear path forward

---

## Why Students and Advisors Use It

* Keeps semester planning organized
* Reduces trial-and-error course selection
* Highlights courses that unlock future options
* Makes advising conversations more efficient

---

## Project Structure (Simple Guide)

* `backend/` — Server logic and recommendation engine
* `frontend/` — Web interface students and advisors use
* `scripts/` — Helper scripts for local development
* `tests/` — Automated backend and frontend tests
* `infra/` — Deployment and hosting configuration
* `mds/` — Planning documents and release notes
* `eval/` — Evaluation assets for recommendation quality

---

# Local Setup Guide

## Prerequisites

Install the following:

* Python 3.11+
* Node.js 18+
* npm (comes with Node.js)

---

## Step 1 — Open a Terminal in the Project Root

You should be in the folder that contains:

* `README.md`
* `requirements.txt`
* the `frontend/` folder

---

## Step 2 — First-Time Setup

### macOS / Linux

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt

cd frontend
npm install
cd ..
```

### Windows (PowerShell)

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt

cd frontend
npm install
cd ..
```

---

## Step 3 — Run MarqBot

```bash
python scripts/run_local.py
```

The script will automatically build the frontend if needed and start the backend server.

---

## Step 4 — Open in Your Browser

Go to:

```
http://localhost:5000
```

---

## Step 5 — Stop the App

Press:

```
Ctrl + C
```

in the terminal running MarqBot.

---

# Running Again Later

After the first setup, you typically only need:

### macOS / Linux

```bash
source .venv/bin/activate
python scripts/run_local.py
```

### Windows (PowerShell)

```powershell
.\.venv\Scripts\Activate.ps1
python scripts/run_local.py
```

---

# Quick Troubleshooting

* **`python` not found**
  Reinstall Python and make sure “Add Python to PATH” is checked.

* **`npm` not found**
  Install Node.js (LTS), then reopen your terminal.

* **Port 5000 already in use**
  Close the other application using port 5000 and rerun.

* **Frontend dependency issues**
  Run:

  ```bash
  cd frontend
  npm install
  ```

---

# Basic Usage Tutorial

1. Open MarqBot in your browser
2. Select your major (and track, if applicable)
3. Enter completed and in-progress courses
4. Review recommended courses
5. Use “Can I Take This Next Semester?” to check a specific class
6. Adjust inputs and compare outcomes

---

# Who This Is For

* Business students planning upcoming semesters
* Academic advisors guiding degree progression
* Program teams reviewing recommendation behavior

---

# Important Note

MarqBot is a planning tool, not an official registration system.
Final enrollment decisions should always follow official university advising and registration policies.

---
