# MarqBot Data Model (v1.8.3)

## Canonical Workbook ERD (Mermaid)
```mermaid
erDiagram
    PARENT_BUCKETS ||--o{ CHILD_BUCKETS : owns
    CHILD_BUCKETS ||--o{ MASTER_BUCKET_COURSES : maps
    COURSES ||--o{ MASTER_BUCKET_COURSES : satisfies
    COURSES ||--|| COURSE_PREREQS : has_rules
    COURSES ||--|| COURSE_OFFERINGS : has_offerings
    PARENT_BUCKETS ||--o{ PARENT_BUCKETS : parent_major_ref

    PARENT_BUCKETS {
        string parent_bucket_id PK
        string parent_bucket_label
        string type
        string parent_major
        boolean active
        boolean requires_primary_major
        string double_count_family_id
    }

    CHILD_BUCKETS {
        string parent_bucket_id FK
        string child_bucket_id PK_part
        string child_bucket_label
        string requirement_mode
        int courses_required
        int credits_required
        int min_level
        string notes
    }

    MASTER_BUCKET_COURSES {
        string parent_bucket_id FK
        string child_bucket_id FK
        string course_code FK
        string notes
    }

    COURSES {
        string course_code PK
        string course_name
        int credits
        int level
        boolean active
        string notes
        string elective_pool_tag
    }

    COURSE_PREREQS {
        string course_code PK_FK
        string prerequisites
        string prereq_warnings
        string concurrent_with
        int min_standing
        string notes
        string warning_text
    }

    COURSE_OFFERINGS {
        string course_code PK_FK
        boolean spring_2025
        boolean summer_2025
        boolean fall_2025
    }

    DOUBLE_COUNT_POLICY {
        string program_id
        string sub_bucket_id_a
        string sub_bucket_id_b
        boolean allow_double_count
        string reason
    }
```

## Runtime Flow (Mermaid)
```mermaid
flowchart TD
    A[Workbook Sheets] --> B[data_loader normalization]
    B --> C[parent_buckets_df + child_buckets_df]
    B --> D[buckets_df + course_bucket_map_df]
    B --> E[courses_df + prereq_map + offerings]
    E --> F[eligibility candidate filter]
    D --> F
    C --> G[double-count family policy resolution]
    F --> H[allocator deterministic assignment]
    G --> H
    H --> I[semester_recommender ranking and packing]
    I --> J[/recommend response]
    C --> K[/programs catalog response]
```

## Audit Snapshot (Workbook)
- Workbook: `marquette_courses_full.xlsx`
- Sheets audited: `courses`, `parent_buckets`, `child_buckets`, `master_bucket_courses`, `course_prereqs`, `course_offerings`, `double_count_policy`
- Row counts:
  - `courses`: 198
  - `parent_buckets`: 15
  - `child_buckets`: 47
  - `master_bucket_courses`: 289
  - `course_prereqs`: 198
  - `course_offerings`: 198
  - `double_count_policy`: 0
- Integrity checks passed:
  - no primary-key duplicates in `courses`, `course_prereqs`, `course_offerings`, `parent_buckets`
  - no duplicate composite rows in `child_buckets` or `master_bucket_courses`
  - no FK breaks (`master_bucket_courses` -> `parent_buckets`, `child_buckets`, `courses`)
  - full coverage: every `courses.course_code` exists in both `course_prereqs` and `course_offerings`
  - valid enums for `parent_buckets.type` and `child_buckets.requirement_mode`
  - no explicit mappings in elective/credits-pool buckets (dynamic elective model intact)
  - no mapped 5000+ courses

## Notable Data Notes
- 8 courses have `credits = 0` (internship/work-period rows), which appears intentional.
- 38 catalog courses are not mapped in `master_bucket_courses` (expected for non-tracked or optional catalog entries).
- `double_count_policy` exists but is currently empty and still uses legacy columns.
