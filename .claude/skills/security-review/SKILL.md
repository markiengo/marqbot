---
name: security-review
description: Security code review for MarqBot. Identifies exploitable vulnerabilities with confidence-based reporting. Use when reviewing security-sensitive changes, before deployment, or when asked to audit for security issues.
---

# Security Review

Systematic security review for the MarqBot codebase. Follow this methodology exactly.

## 1) Confidence system

Only report findings you can back with evidence. Three levels:

- **HIGH** — Attacker-controlled input reaches a dangerous sink with no mitigation in the path. Report these.
- **MEDIUM** — Suspicious pattern but input source is unclear or partially validated. Note these briefly.
- **LOW** — Theoretical risk with no realistic attack path in this codebase. Skip these entirely.

Only HIGH-confidence findings go in the final report. MEDIUM findings get a one-line mention. LOW findings are not reported.

## 2) Scope

Default: review files changed since the last clean commit (`git diff --name-only`).
Full-repo review only on explicit request.

## 3) MarqBot attack surface

MarqBot is a Flask backend + static Next.js export. No user accounts, no authentication, no database. Understand what is and isn't an attack surface here:

### Real attack surface
- **Flask route handlers** (`backend/server.py`): `/api/recommend`, `/api/can-take`, `/api/courses`, `/api/programs` accept JSON POST bodies with user-controlled input (course lists, major selections, standing values)
- **Input validation** (`backend/validators.py`, `backend/normalizer.py`): user-supplied course codes, program IDs, and standing values flow into recommendation logic
- **CSV parsing** (`backend/data_loader.py`): reads `data/*.csv` at startup with `encoding="utf-8-sig"` — injection risk if CSV files are ever user-uploadable (currently they are not)
- **Static file serving**: Flask serves `frontend/out/` in production — path traversal if misconfigured
- **Environment variables**: `DATA_PATH`, `PORT`, `FLASK_DEBUG`, `BCC_DECAY_ENABLED` — check for debug mode in production, unsafe defaults
- **Dependencies**: `requirements.txt` and `package.json` — known CVEs in pinned versions
- **GitHub Actions workflows** (`.github/workflows/`): secret exposure, injection via PR titles/branch names in workflow expressions

### Not an attack surface (do not flag)
- Frontend is a static export — no server-side rendering, no API keys in client code, no auth tokens
- CSV data files are developer-maintained, not user-uploaded
- No database, no SQL, no ORM
- No user sessions, cookies, or authentication
- No file uploads
- No email sending or external API calls in request paths
- `quips.csv` and `quipBank.generated.ts` are compile-time artifacts, not runtime user input

## 4) Do not flag

These are not findings in this codebase:
- Missing CSRF protection (no state-changing authenticated actions exist)
- Missing rate limiting on read-only endpoints (acceptable for Render Starter scale)
- Missing Content-Security-Policy headers on the static export (valid hardening but S3 at best, not a finding)
- `FLASK_DEBUG` being available as an env var (it exists — only flag if it defaults to `True` in production code)
- Theoretical ReDoS in prereq parsing (input is developer-maintained CSV data, not user strings)
- Missing input length limits on course lists (recommendation engine handles bounded input naturally)
- Type coercion warnings in Python (e.g., `int()` on validated input)
- Test files, example data, documentation

## 5) Review process

Follow this order:

### Step 1: Understand context
Read the changed files. Identify which are backend routes, frontend components, data files, or infrastructure. Don't flag anything yet.

### Step 2: Trace user input
For each backend route handler, trace the path from request input to where it's used:
- What fields come from the user?
- Are they validated before use?
- Do they reach any dangerous operations (file I/O, shell commands, `eval`, `pickle`, dynamic imports)?

### Step 3: Check framework protections
Before flagging, verify whether the framework already mitigates it:
- Flask's `jsonify()` auto-escapes HTML in JSON responses
- Next.js static export has no server-side injection surface
- Python's `csv.reader()` doesn't execute code from CSV cells

### Step 4: Check for dangerous patterns
Search changed files for these — they always warrant investigation:
- `eval()`, `exec()`, `__import__()`, `subprocess`, `os.system`, `os.popen`
- `pickle.loads()`, `yaml.load()` without `SafeLoader`
- `open()` with user-controlled paths (path traversal)
- `flask.send_file()` or `send_from_directory()` with user-controlled paths
- `FLASK_DEBUG=True` or `debug=True` in production startup
- Hardcoded secrets, API keys, passwords in tracked files
- `innerHTML`, `dangerouslySetInnerHTML` with user-controlled content
- Unescaped template interpolation in workflow files (`${{ github.event.pull_request.title }}`)

### Step 5: Check dependencies
If `requirements.txt` or `package.json` changed:
- Note any new dependencies
- Flag known-vulnerable versions if you're aware of them
- Flag wildcard or unpinned versions

### Step 6: Verify exploitability
For each candidate finding, answer:
- Can an external attacker actually control this input?
- Is there validation or sanitization in the path?
- What's the realistic impact if exploited?

If you can't describe a concrete attack, it's not HIGH confidence.

## 6) Severity classification

- **Critical** — Remote code execution, arbitrary file read/write, command injection
- **High** — SSRF, path traversal, secret exposure in logs or responses, debug mode in production
- **Medium** — Information disclosure (stack traces, internal paths), missing security headers on API responses
- **Low** — Verbose error messages, missing best-practice headers

## 7) Output format

```
## Security Review

**Scope**: [changed files / full repo]
**Files reviewed**: [count]

### Findings

#### [CRITICAL/HIGH/MEDIUM/LOW] — [Short title]
- **Location**: `file:line`
- **Confidence**: HIGH
- **Issue**: [What's wrong]
- **Impact**: [What an attacker can do]
- **Evidence**: [The specific code path or pattern]
- **Remediation**: [How to fix it]

### Notes (MEDIUM confidence)
- [One-line description per item]

### No issues found in
- [List areas reviewed that were clean]

### Dependency check
- [New or changed dependencies, any known issues]
```

If there are no findings, say that clearly:
```
## Security Review — Clean
No exploitable vulnerabilities found in [N] changed files.
Reviewed: [list of files]
```

## 8) Relationship to other review tools

This skill focuses on **exploitable security vulnerabilities only**.

- `/simplify` handles code reuse, quality, and efficiency — not security
- `docs/code_audit.md` handles correctness, domain bugs, and performance — overlaps slightly on "security" in its S0 tier but focuses on recommendation logic bugs, not injection/exposure patterns
- Use all three together for a complete review: `/security-review` for vulnerabilities, `/simplify` for code quality, `code_audit.md` for domain correctness
