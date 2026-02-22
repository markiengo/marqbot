# MarqBot Data Model (v1.6)

## Visual ERD (Mermaid)
```mermaid
erDiagram
    PROGRAMS ||--o{ BUCKETS : owns
    PROGRAMS ||--o{ SUB_BUCKETS : owns
    PROGRAMS ||--o{ COURSES_ALL_BUCKETS : scopes
    PROGRAMS ||--o{ DOUBLE_COUNT_POLICY : scopes

    BUCKETS ||--o{ SUB_BUCKETS : contains
    SUB_BUCKETS ||--o{ COURSES_ALL_BUCKETS : maps
    COURSES ||--o{ COURSES_ALL_BUCKETS : assigned_to
    COURSES ||--o| COURSE_PREREQS : has
    COURSES ||--o| COURSE_OFFERINGS : has
    COURSES ||--o{ COURSE_EQUIVALENCIES : grouped_in

    PROGRAMS {
        string program_id
        string program_label
        string kind
        string parent_major_id
        boolean active
        boolean requires_primary_major
        boolean applies_to_all
    }

    BUCKETS {
        string program_id
        string bucket_id
        string bucket_label
        int priority
        string track_required
        boolean active
    }

    SUB_BUCKETS {
        string program_id
        string bucket_id
        string sub_bucket_id
        string sub_bucket_label
        int courses_required
        int credits_required
        int min_level
        string role
        int priority
    }

    COURSES_ALL_BUCKETS {
        string program_id
        string sub_bucket_id
        string course_code
        string notes
    }

    COURSES {
        string course_code
        string course_name
        int credits
        int level
        boolean offered_fall
        boolean offered_spring
        boolean offered_summer
        string offering_confidence
        int offering_freq_last3
    }

    COURSE_PREREQS {
        string course_code
        string prerequisites
        string prereq_warnings
        string concurrent_with
        string min_standing
    }

    COURSE_OFFERINGS {
        string course_code
        boolean semester_col_1
        boolean semester_col_2
        boolean semester_col_3
    }

    COURSE_EQUIVALENCIES {
        string equiv_group_id
        string course_code
        string course_name
        string program_scope
        boolean active
    }

    DOUBLE_COUNT_POLICY {
        string program_id
        string sub_bucket_id_a
        string sub_bucket_id_b
        boolean allow_double_count
        string reason
    }
```

## Marquette Style Notes
- Primary color: `#003366` (Marquette navy)
- Accent color: `#FFCC00` (Marquette gold)
- Use navy for headers and relationship labels; use gold for highlights/callouts in rendered docs.
- Keep neutral backgrounds and high-contrast text for print/export readability.

## Relationship Notes
- `BCC_CORE` and `MCC_CORE` are modeled as universal programs (`applies_to_all=true`) and are auto-included at runtime.
- `courses_all_buckets` remains structurally unchanged in v1.6 for stability.
- `double_count_policy` now stores only sub-bucket pair exceptions by program scope.
- `course_offerings` uses dynamic literal semester headers in the workbook (for example `Fall 2025`); the ERD shows generic `semester_col_*` placeholders for Mermaid compatibility.
