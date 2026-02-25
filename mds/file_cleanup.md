# File Cleanup Rules (Safe + Behavior-Preserving)

Goal: reduce clutter without breaking the product.

## Non-negotiable rules
- Do NOT delete files unless you can prove they are unused.
- "Unused" means:
  - Not referenced by runtime code
  - Not referenced by tests
  - Not referenced by build/CI scripts
  - Not referenced by documentation
- If uncertain: move to `/archive/` (or add a comment) instead of deleting.

## Always-safe deletions (generated artifacts)
These should never be committed and are safe to delete locally:
- `.pytest_cache/`
- `__pycache__/` (anywhere)
- `.DS_Store`
- `.next/`, `out/` (Next build outputs)
- `dist/`, `build/` (when regenerated)
- `*.log`, `*.tmp`

## Repo hygiene
### .gitignore
Ensure these are ignored:
- `.pytest_cache/`
- `**/__pycache__/`
- `.next/`
- `out/`
- `dist/`
- `build/`
- `.env*` (as appropriate)

## Workflow
1) Inventory
- List top-level folders and identify source vs generated directories.
- Identify “likely junk”: backups, duplicates, unused images, legacy scripts.

2) Reference checks
For any candidate file:
- Search for imports/references across repo
- Search in config/CI scripts
- Search in docs

3) Categorize
- Delete-safe-now (high confidence)
- Needs confirmation (medium confidence)
- Keep (active / referenced)

4) Make changes
- Delete only “safe-now”
- For “needs confirmation”: move to `/archive/` or leave a TODO note

5) Verify
- Run build/tests/lint (whatever exists)
- Ensure app works as before

## Output format for cleanup PRs
- List deleted files + why
- List archived files + why
- Any follow-ups