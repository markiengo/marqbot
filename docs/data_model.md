# MarqBot Data Model

All runtime data lives in `data/` as UTF-8-BOM CSVs.

## Entity-Relationship Diagram

```mermaid
erDiagram
    courses {
        string course_code PK
        string course_name
        int credits
        int level
        bool active
        string elective_pool_tag
        string notes
        string description
    }

    parent_buckets {
        string parent_bucket_id PK
        string parent_bucket_label
        string type "major | track | universal"
        string parent_major FK "self-ref for tracks"
        bool active
        bool requires_primary_major
        string double_count_family_id
    }

    child_buckets {
        string parent_bucket_id FK
        string child_bucket_id PK
        string child_bucket_label
        string requirement_mode "required | choose_n | credits_pool"
        float courses_required
        float credits_required
        float min_level
        string notes
    }

    master_bucket_courses {
        string parent_bucket_id FK
        string child_bucket_id FK
        string course_code FK
        string notes
    }

    course_prereqs {
        string course_code FK
        string prerequisites "hard prereqs"
        string prereq_warnings "soft warnings"
        string concurrent_with
        float min_standing "1.0-4.0 undergrad"
        string notes
        string warning_text
    }

    course_offerings {
        string course_code FK
        bool Spring_2025
        bool Summer_2025
        bool Fall_2025
    }

    double_count_policy {
        string program_id FK
        string sub_bucket_id_a FK
        string sub_bucket_id_b FK
        bool allow_double_count
        string reason
    }

    parent_buckets ||--o{ child_buckets : "owns"
    parent_buckets ||--o| parent_buckets : "track references parent major"
    child_buckets ||--o{ master_bucket_courses : "maps"
    courses ||--o{ master_bucket_courses : "belongs to"
    courses ||--o| course_prereqs : "has rules"
    courses ||--o| course_offerings : "has schedule"
    parent_buckets ||--o{ double_count_policy : "governs overlap"
    child_buckets ||--o{ double_count_policy : "overlap pair"
```

## Key Concepts

**Program types** (`parent_buckets.type`)
| Type | Example | Behavior |
|------|---------|----------|
| `major` | Finance, Accounting | Selectable by student. Tier 2 priority. |
| `track` | Corporate Banking, CFA | Scoped to a parent major via `parent_major`. Tier 3 priority. |
| `universal` | BCC Core, MCC Foundation | Auto-included for all students. Tier 1 priority. |

**Requirement modes** (`child_buckets.requirement_mode`)
| Mode | Rule |
|------|------|
| `required` | All mapped courses must be completed |
| `choose_n` | Pick N courses from the mapped set (`courses_required`) |
| `credits_pool` | Accumulate N credits from tagged courses (`credits_required`) |

**Double-count resolution** (highest wins)
1. Explicit sub-bucket pair row in `double_count_policy`
2. Family default: same `double_count_family_id` = deny; different family = allow
