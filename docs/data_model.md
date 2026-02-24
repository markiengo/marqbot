# MarqBot Data Model (v1.7.11)

## Canonical Workbook ERD (Mermaid)
```mermaid
erDiagram
    PARENT_BUCKETS ||--o{ CHILD_BUCKETS : owns
    CHILD_BUCKETS ||--o{ MASTER_BUCKET_COURSES : maps
    COURSES ||--o{ MASTER_BUCKET_COURSES : satisfies
    COURSES ||--o| COURSE_PREREQS : has
    COURSES ||--o| COURSE_OFFERINGS : has
    PARENT_BUCKETS ||--o{ DOUBLE_COUNT_POLICY : scopes

    PARENT_BUCKETS {
        string parent_bucket_id
        string parent_bucket_label
        string type
        string parent_major
        boolean active
        boolean requires_primary_major
    }

    CHILD_BUCKETS {
        string parent_bucket_id
        string child_bucket_id
        string child_bucket_label
        string requirement_mode
        int courses_required
        int credits_required
        int min_level
        string notes
    }

    MASTER_BUCKET_COURSES {
        string parent_bucket_id
        string child_bucket_id
        string course_code
        string notes
    }

    COURSES {
        string course_code
        string course_name
        int credits
        int level
        string prereq_hard
        string prereq_soft
        string warning_text
        string elective_pool_tag
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

    DOUBLE_COUNT_POLICY {
        string program_id
        string node_type_a
        string node_id_a
        string node_type_b
        string node_id_b
        boolean allow_double_count
        string reason
    }
```

## Runtime Model Flow (Mermaid)
```mermaid
flowchart TD
    A[Workbook Sheets] --> B[data_loader normalization]
    B --> C[Runtime buckets_df]
    B --> D[Runtime course_bucket_map_df]
    B --> E[courses_df + prereq_map]
    E --> F[eligibility candidate filter]
    C --> F
    D --> F
    F --> G[semester_recommender ranking]
    C --> H[allocator progress assignment]
    D --> H
    G --> I[/recommend response]
    H --> I
    H --> J[/programs progress overlays]
```

## Model Notes
- `parent_buckets.type='universal'` rows are auto-included when `active=true` (for example `BCC_CORE`, `MCC_CORE`).
- Tracks stay selectable as independent parent buckets, but `parent_major` links them to allowed major selection in UI and API.
- `requirement_mode` drives bucket behavior:
  - `required`: fixed specific courses
  - `choose_n`: choose-count lists
  - `credits_pool`: credit-based pools
- Dynamic business electives are intentionally not hard-mapped in `master_bucket_courses`:
  - runtime synthesis uses `courses.elective_pool_tag == "biz_elective"`
  - only for elective-like child IDs matching `ELEC|BUS_ELEC|ELECTIVE`
  - bucket `min_level` is enforced
- Same-family no-double-count remains default. Cross-family remains default allow. Explicit `double_count_policy` rows override defaults.
- Same-family routing prefers non-elective children (`required`, `choose_n`) before `credits_pool` children to avoid elective leakage.
- `course_equivalencies` is currently out of active governance and not part of the canonical planning model in this release line.
