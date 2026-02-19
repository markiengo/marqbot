# Data schema recommendation for course-to-bucket mapping

## Recommendation
Use a **normalized mapping table** for course-to-bucket relationships, rather than wide columns.

Preferred sheet:

- `bucket_course_map` (or `course_bucket_map` if you want a renamed variant)

Columns:

- `track_id`
- `course_code`
- `bucket_id`
- `can_double_count` (optional)
- `is_required` (optional)
- `constraints` (optional)

Example:

| track_id  | course_code | bucket_id     |
|-----------|-------------|---------------|
| FIN_MAJOR | FINA 3001   | CORE          |
| FIN_MAJOR | FINA 3001   | FIN_CHOOSE_1  |
| FIN_MAJOR | FINA 4001   | FIN_CHOOSE_2  |

## Why normalized is better long-term

1. No arbitrary cap on number of buckets per course.
2. Fits relationship-table semantics naturally.
3. Avoids repeated unpivot/transformation logic in loader code.
4. Easier to support multiple tracks/majors over time.

## Wide format tradeoff (if retained)

Wide sheets such as:

- `course_code`, `bucket1`, `bucket2`, `bucket3`, ...

are acceptable for temporary/manual-entry convenience but introduce:

- schema churn when you exceed configured columns,
- additional loader complexity,
- more validation edge cases.

If wide format is kept short-term, backend should normalize it at load time and treat normalized map as canonical internally.

## Prereq and buckets alignment with current direction

- Keep prereq logic focused on `prereq_hard` + `prereq_level`.
- Keep `buckets` as requirement definitions.
- Keep a normalized course↔bucket mapping sheet as the relationship layer.

This separation gives clear ownership:

- courses = course metadata,
- buckets = requirement containers,
- map = many-to-many assignment.
