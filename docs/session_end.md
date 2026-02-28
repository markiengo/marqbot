# Session End: Document + Ship

Use this checklist at the end of every coding session. Keep updates user-friendly and non-technical.

## 1) Update docs
### changelog.md
- Add a new entry at the top.
- Include:
  - What changed (user-visible)
  - What was fixed
  - Anything removed/renamed (if applicable)
- Avoid internal implementation details.

### README.md 
Update README if you added:
- A new feature or workflow
- New setup steps / environment variables
- New commands (dev, test, build)
- New pages/flows that users should know exist
- Update the badges

### claude.md
- notice any decisions and rationale i made within the conversation/session
- read the current state of claude.md and decide if there are any thing to add
- update the doc

## 2) Commit locally
- Commit changes locally before pushing.
- Commit message rules:
  - 5–8 words
  - A user can understand it
  - Example format: verb + outcome

Examples:
- "Improve planner recommendations clarity"
- "Fix prerequisites display in planner"
- "Add progress modal for requirement buckets"
- Generic fallback: "Maintenance and small improvements"

## 3) Push to main
- Push to `main` only after:
  - Build passes
  - Tests pass (if tests exist)
  - Lint/format passes (if configured)
  - Exception: Do not push @todo.md 

## 4) Publish a release
- Create a release after push.
- Release notes rules:
  - Succinct
  - User-understandable
  - No deep technical details
  - 3–7 bullets maximum
  - Mention what users can do now

Release notes template:
- Added: <user-facing change>
- Fixed: <user-facing fix>
- Improved: <user-facing improvement>
- Note: <anything users should be aware of>

Final check:
- If a student reads this, they should understand it.