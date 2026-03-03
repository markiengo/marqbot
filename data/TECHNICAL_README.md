# Data Technical README

## What this folder is

This folder is the app's source of truth.

It tells the app what courses exist and how the degree rules are organized.

## What it does

- stores the course list
- stores prerequisite rules
- stores offering terms
- stores requirement buckets
- stores course-to-bucket mappings

## Main files

- `courses.csv`
  Master course list.

- `course_prereqs.csv`
  Prerequisite rules.

- `course_offerings.csv`
  When classes are usually offered.

- `parent_buckets.csv`
  Big requirement groups.

- `child_buckets.csv`
  Smaller requirement buckets.

- `master_bucket_courses.csv`
  Map from courses to requirement buckets.

- `double_count_policy.csv`
  Rules for when one class can count twice.

## Simple mental model

If this data is wrong, the app can give a wrong answer even when the code is fine.

## When to check this folder

- a course is missing
- a requirement count looks wrong
- a class is in the wrong bucket
- a prerequisite looks wrong
- a class appears in the wrong term
