# Backend Technical README

## What this folder is

This is the thinking part of the app.

It decides what counts, what is blocked, and what should come next.

## What it does

- reads course and requirement data
- checks prerequisites
- tracks degree progress
- builds course recommendations
- sends data to the frontend

## Main files

- `server.py`
  Main API file.

- `data_loader.py`
  Loads the CSV data.

- `allocator.py`
  Decides what completed courses count toward.

- `eligibility.py`
  Decides what courses are allowed now.

- `semester_recommender.py`
  Picks and ranks recommendations.

- `prereq_parser.py`
  Reads prerequisite rules.

## Main routes

- `/programs`
  Majors and tracks.

- `/recommend`
  Semester recommendations.

- `/can-take`
  Checks one course.

- `/validate-prereqs`
  Checks prerequisite behavior.

## Simple mental model

If the frontend is the screen, the backend is the rulebook.

This folder is where the important decisions happen.

## Common commands

- `python -m pytest tests/backend -q`
  Run backend tests.

- `python -m pytest tests/backend/test_dead_end_fast.py -q`
  Run the fast planner safety test.
