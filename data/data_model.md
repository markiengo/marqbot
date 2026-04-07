# MarqBot Data Model

MarqBot's checked-in catalog inputs live in `data/` as UTF-8-BOM CSVs. The planner also reads checked-in operational config from `config/`. Together, the loader and recommender build these runtime layers:
- a course catalog overlay (`courses.csv` + split prereqs + offerings metadata)
- a parent/child requirement graph (`parent_buckets.csv` + `child_buckets.csv` + `master_bucket_courses.csv`)
- an equivalency overlay (`course_equivalencies.csv`) used for prereq satisfaction, recommendation dedup filtering, required-bucket remaining collapse, and no-double-credit blocking
- a ranking override layer (`config/ranking_overrides.json`) used for deterministic bucket-priority boosts

## Runtime Assembly

```mermaid
flowchart TD
    classDef blue fill:#dbeafe,stroke:#2563eb,color:#1e3a5f
    classDef green fill:#dcfce7,stroke:#16a34a,color:#14532d
    classDef orange fill:#ffedd5,stroke:#ea580c,color:#7c2d12
    classDef purple fill:#f3e8ff,stroke:#9333ea,color:#581c87
    classDef yellow fill:#fef3c7,stroke:#d97706,color:#78350f

    subgraph CSV["📂 CSV Files (data/)"]
        direction LR
        C["courses.csv\n~5000 courses"]
        HP["course_hard_prereqs.csv\nprereq expressions"]
        SP["course_soft_prereqs.csv\nwarnings & tags"]
        PB["parent_buckets.csv\nmajors, tracks, minors"]
        CB["child_buckets.csv\nrequirement slots"]
        MBC["master_bucket_courses.csv\ncourse ↔ bucket mapping"]
    end

    subgraph BUILD["⚙️ Load & Build"]
        direction LR
        RC["Course Catalog\ncourses + prereqs"]
        BG["Requirement Graph\nparent → child → courses"]
        DYN["Elective Synthesis\nbiz_elective → credits_pool"]
    end

    subgraph CONFIG["🧭 Config (config/)"]
        CFG["ranking_overrides.json\nbucket priority boosts"]
    end

    subgraph ENGINE["🎯 Engine"]
        ENG["Allocator → Eligibility → Recommender"]
    end

    C & HP & SP --> RC
    PB & CB & MBC --> BG
    C & CB --> DYN --> BG
    CFG --> ENG
    RC & BG --> ENG

    class C,HP,SP blue
    class PB,CB,MBC orange
    class RC,BG,DYN green
    class ENG purple
    class CFG yellow
```

## Entity Relationships

```mermaid
erDiagram
    COURSES {
        string course_code PK "e.g. FINA 3001"
        string course_name
        string credits "3 or 1-3"
        int level "1000-6000"
        string elective_pool_tag "biz_elective or blank"
    }

    PARENT_BUCKETS {
        string parent_bucket_id PK "e.g. FIN_MAJOR"
        string parent_bucket_label "e.g. Finance"
        string type "major / track / minor / universal"
        string parent_major FK "track's parent major"
        string required_major "must declare to use"
    }

    CHILD_BUCKETS {
        string child_bucket_id PK "e.g. fin-req-core"
        string parent_bucket_id FK
        string child_bucket_label "e.g. Finance Core"
        string requirement_mode "required / choose_n / credits_pool"
        float courses_required "how many courses"
        float credits_required "how many credits"
    }

    MASTER_BUCKET_COURSES {
        string child_bucket_id FK
        string course_code FK
    }

    HARD_PREREQS {
        string course_code FK
        string hard_prereq "e.g. ACCO 1031 and FINA 3001"
        string concurrent_with "same-term companions"
        float min_standing "1=Fr 2=So 3=Jr 4=Sr"
    }

    SOFT_PREREQS {
        string course_code FK
        string soft_prereq "tags: major_restriction etc."
        string catalog_prereq_raw "full bulletin text"
    }

    POLICIES {
        string policy_id PK "e.g. COBA_06"
        string policy_name
        string scope_type "university / college / bucket"
        string scope_id
        string runtime_mode "block / warning / advisory / none"
        string implementation_status "runtime_ready / deferred / etc."
    }

    POLICIES_BUCKETS {
        string policy_id FK
        string parent_bucket_id FK "or group alias like ALL_COBA"
        string notes
    }

    POLICIES ||--o{ POLICIES_BUCKETS : "affects"
    PARENT_BUCKETS ||--o{ POLICIES_BUCKETS : "governed by"
    COURSES ||--o| HARD_PREREQS : "eligibility gates"
    COURSES ||--o| SOFT_PREREQS : "warnings"
    COURSES ||--o{ MASTER_BUCKET_COURSES : "mapped to"
    CHILD_BUCKETS ||--o{ MASTER_BUCKET_COURSES : "contains"
    PARENT_BUCKETS ||--o{ CHILD_BUCKETS : "has requirements"
    PARENT_BUCKETS ||--o| PARENT_BUCKETS : "track belongs to major"
```

## Core CSVs

### `courses.csv`

Base course catalog (5309 rows).

| Column | Meaning |
|--------|---------|
| `course_code` | Primary key. e.g. `FINA 3001`. |
| `course_name` | Human-readable course title. |
| `credits` | Credit value. Usually an integer like `3`, but can be a range like `1-3`. |
| `level` | Numeric course level (1000–6000). Derived from the first digit of the course number. |
| `active` | Whether the course is active in the current catalog. |
| `notes` | Freeform notes. |
| `elective_pool_tag` | Tag for dynamic elective synthesis. Currently only `biz_elective` is used. Blank for most courses. |
| `description` | Catalog description text. |

### `parent_buckets.csv`

Top-level program envelopes (41 rows): majors, tracks, minors, and universal requirement groups.

| Column | Meaning |
|--------|---------|
| `parent_bucket_id` | Primary key. e.g. `FIN_MAJOR`, `BCC_CORE`, `MCC_FOUNDATION`. |
| `parent_bucket_label` | Display name. e.g. `Finance`, `Business Common Core`. |
| `type` | Program type: `major`, `track`, `minor`, or `universal`. |
| `parent_major` | For tracks: the parent major this track belongs to. Blank for non-tracks. |
| `active` | Whether this program is active and selectable. |
| `requires_primary_major` | If true, this program can only be selected alongside a primary major. |
| `double_count_family_id` | Family grouping for double-count policy. Buckets in the same family don't double-count by default. |
| `required_major` | Optional major that must be declared to use this program. |
| `is_default` | If true, this is the default major selection when none is chosen. |
| `college_alias` | Optional college classification used for program-context rules such as business-only BCC loading and non-business program support. |

### `child_buckets.csv`

Individual requirement slots inside each parent (100 rows).

| Column | Meaning |
|--------|---------|
| `parent_bucket_id` | FK to `parent_buckets.csv`. Which program this requirement belongs to. |
| `child_bucket_id` | Primary key. e.g. `fina-req-core`, `bcc-required`. |
| `child_bucket_label` | Display name. e.g. `Finance Core Requirements`. |
| `requirement_mode` | How the bucket is satisfied: `required` (all courses), `choose_n` (pick N), or `credits_pool` (accumulate credits). |
| `courses_required` | Number of courses needed. Used by `required` and `choose_n` modes. |
| `credits_required` | Number of credits needed. Used by `credits_pool` mode. |
| `min_level` | Minimum course level for this bucket. e.g. `3000` means only 3000+ courses count. Blank = no minimum. |
| `notes` | Freeform notes. |

### `master_bucket_courses.csv`

Explicit course-to-child-bucket membership (1623 rows). This is the checked-in mapping that says "this course can count toward this requirement."

| Column | Meaning |
|--------|---------|
| `parent_bucket_id` | FK to `parent_buckets.csv`. |
| `child_bucket_id` | FK to `child_buckets.csv`. |
| `course_code` | FK to `courses.csv`. |
| `notes` | Freeform notes. |

### `course_hard_prereqs.csv`

Hard eligibility gates (5309 rows). One row per course. Only parseable, enforceable prerequisites.

| Column | Meaning |
|--------|---------|
| `course_code` | FK to `courses.csv`. Owning course. |
| `hard_prereq` | Parseable prerequisite expression consumed by `prereq_parser`. e.g. `ACCO 1031 and FINA 3001`. `none` if the course has no hard prereq. |
| `concurrent_with` | Same-term companion courses. e.g. `MATH 1451`. |
| `min_standing` | Numeric standing gate. `1`=Freshman, `2`=Sophomore, `3`=Junior, `4`=Senior. Blank = no gate. |

### `course_soft_prereqs.csv`

Soft warnings, raw prerequisite text, and audit detail columns (5309 rows). One row per course.

| Column | Meaning |
|--------|---------|
| `course_code` | FK to `courses.csv`. Owning course. |
| `soft_prereq` | Semicolon-delimited tag list used by runtime warnings and manual review. |
| `catalog_prereq_raw` | Full bulletin prerequisite line, verbatim. |
| `notes` | Human-readable audit context retained from parsing. |

See **Soft detail columns** section below for the full list of `soft_prereq_*` columns.

### `course_offerings.csv`

Seasonal offering history (547 rows). **Currently disabled** — all courses are treated as offered every term.

| Column | Meaning |
|--------|---------|
| `course_code` | FK to `courses.csv`. |
| `Spring 2025` | Whether the course was offered in Spring 2025. |
| `Summer 2025` | Whether the course was offered in Summer 2025. |
| `Fall 2025` | Whether the course was offered in Fall 2025. |

### `course_equivalencies.csv`

Equivalency groups (283 rows) stored in wide format with one row per group.

| Column | Meaning |
|--------|---------|
| `id` | Group identifier. |
| `course_1`, `course_2`, `course_3` | Member course codes for the group. |
| `type` | Equivalency relationship: `equivalent`, `honors`, `grad`, `cross_listed`, or `no_double_count`. |
| `parent_bucket` | Optional parent-bucket scope. Scoped `equivalent` rows apply only to matching program selections when deduplicating recommendations and collapsing remaining required courses. |
| `child_bucket` | Optional child-bucket scope for bucket expansion rules. |

### `policies.csv`

Normalized registry of 76 Marquette academic policies.

| Column | Meaning |
|--------|---------|
| `policy_id` | Primary key. e.g. `COBA_06`, `CRED_01`, `STAND_01`. |
| `policy_name` | Human-readable name. e.g. `Maximum Business Majors`. |
| `scope_type` | Scope level: `university`, `college`, or `bucket`. |
| `scope_id` | Which scope this policy applies to. e.g. `marquette`, `business`, `BCC_CORE`. |
| `policy_category` | Category grouping: `standing`, `credit_load`, `graduation`, `declaration`, `repeat`, `transfer`, `mcc`, `coba`, `cas`, `engineering`, `double_count`, `runtime`. |
| `runtime_mode` | How the engine handles it: `block`, `warning`, `advisory`, `none`, or `rank_penalty`. |
| `implementation_status` | Current build state: `runtime_ready`, `planned`, `deferred`, `advisory_only`, or `out_of_scope`. |
| `requires_student_state` | What student data is needed to enforce this. e.g. `credits_earned`, `gpa`, `grades`. Blank if none. |
| `applies_to_program_ids` | Comma-separated program IDs this policy applies to, or blank for all. |
| `rule_summary` | One-line plain-English description of the rule. |
| `source_url` | Marquette Bulletin URL where this policy is documented. |
| `notes` | Implementation notes, edge cases, or reasoning. |

### `policies_buckets.csv`

Policy-to-bucket join table (177 rows). Maps each policy to the parent buckets it affects.

| Column | Meaning |
|--------|---------|
| `policy_id` | FK to `policies.csv`. |
| `parent_bucket_id` | FK to `parent_buckets.csv`, or a group alias like `ALL`, `ALL_COBA`, `ALL_CAS`, `ALL_ENGR`. |
| `notes` | Freeform notes about why this mapping exists. |

### `quips.csv`

Rotating UI quips (904 rows) used in the frontend.

| Column | Meaning |
|--------|---------|
| `pool_type` | Which quip pool this belongs to. e.g. `progress`, `semester`. |
| `pool_id` | Sub-pool identifier within the pool type. |
| `slot` | Slot number within the sub-pool. |
| `target` | Target value or condition for triggering this quip. |
| `weight` | Relative weight for random selection. |
| `text` | The quip text displayed to the user. |

## Operational Config

| File | Role |
|------|------|
| `config/ranking_overrides.json` | Checked-in deterministic ranking adjustments for manual tier adjustments. Same CSVs + same overrides + same inputs = same planner output. |

## Parent/Child Program Model

**Program types** (`parent_buckets.type`)

| Type | Example | Behavior |
|------|---------|----------|
| `major` | Finance, Accounting | Selectable primary or secondary program, depending on flags. |
| `track` | Corporate Banking, CFA | Scoped to a parent major via `parent_major` and often gated by `required_major`. |
| `minor` | Business Administration minor | Optional secondary program. |
| `universal` | BCC Core, MCC Foundation | Auto-included for all students. |

**Program gating/defaults** (`parent_buckets.required_major`, `parent_buckets.is_default`, `parent_buckets.requires_primary_major`)

| Field | Meaning |
|------|---------|
| `required_major` | Optional parent major that must be declared to use this program. |
| `is_default` | Default major when the user has not chosen one yet. |
| `requires_primary_major` | Program can only exist alongside a primary major, not as a standalone primary selection. |

**Requirement modes** (`child_buckets.requirement_mode`)

| Mode | Rule |
|------|------|
| `required` | All mapped courses must be completed. |
| `choose_n` | Pick `courses_required` courses from the mapped set. |
| `credits_pool` | Accumulate `credits_required` credits from eligible mapped or synthesized courses. |

**Overlap default**

- child buckets in the same `double_count_family_id` do not double-count by default
- child buckets in different families do double-count by default
- the removed `double_count_policy.csv` was the optional explicit override sheet for exceptions; it is not part of the checked-in data model right now

## Prerequisite Split

**Soft detail columns** in `course_soft_prereqs.csv`

| Column | Captures |
|--------|----------|
| `soft_prereq_major_restriction` | Major or minor restriction text. |
| `soft_prereq_instructor_consent` | Instructor, department chair, or program director consent text. |
| `soft_prereq_admitted_program` | Admission-to-program language. |
| `soft_prereq_college_restriction` | College-enrollment restrictions. |
| `soft_prereq_program_progress_requirement` | Completed credits or progress-in-program thresholds. |
| `soft_prereq_standing_requirement` | Standing phrases such as sophomore, junior, or senior standing. |
| `soft_prereq_placement_required` | Placement-based restrictions. |
| `soft_prereq_minimum_grade` | Minimum grade language. |
| `soft_prereq_minimum_gpa` | GPA language. |
| `soft_prereq_may_be_concurrent` | Explicit concurrent-course phrasing. |
| `soft_prereq_other_requirements` | Remaining non-hard prerequisite text worth preserving. |
| `soft_prereq_complex_hard_prereq` | Raw text when hard prerequisite logic was too complex to encode safely. |

## Excluded From Hard Prereq Graph

The split model intentionally keeps these out of `hard_prereq`:
- cross-listing clauses
- no-credit-together clauses
- major credit-cap notes
- previous/subsequent enrollment notes
- note-style advisories that mention course codes but do not gate eligibility

Those clauses remain in `catalog_prereq_raw`, `notes`, or soft detail columns.

## Dynamic Elective Synthesis

At load time, courses tagged with `courses.elective_pool_tag = biz_elective` are added dynamically to qualifying elective-like `credits_pool` buckets. This is runtime-only supplementation; `master_bucket_courses.csv` remains the checked-in source of explicit mappings.

Current runtime rule: a business-elective pool only keeps courses that do not already map to some other active bucket in the student's current plan context. If a course already fills a specific BCC, major, track, or minor bucket for that student, MarqBot does not also reuse it as a generic business elective.

## Runtime Bucket Counting

- Non-elective buckets (`required`, `choose_n`) beat `credits_pool` elective pools in recommendation and eligibility views. If a course can fill both, MarqBot shows the non-elective side only.
- Completed-course allocation follows the same precedence. A course counted in a non-elective bucket does not also count in an elective pool at the same time.
- Overflow exception: if a non-elective slot is already full and another completed course could also satisfy it, MarqBot may spill the extra course into eligible elective pools instead of dropping it.
- Elective pools can still overlap with other elective pools when the pairwise bucket policy allows it.

## Course Equivalencies

Runtime behavior:
- `equivalent`, `honors`, and `grad` groups expand prereq satisfaction and bucket mappings.
- `equivalent` groups also suppress recommending one alias when another alias is already completed or in progress, and remove the canonical base course from required-bucket `remaining_courses` when an equivalent already satisfies that slot.
- `equivalent` and `no_double_count` groups also prevent conflicting aliases from being recommended together in the same semester.
- `cross_listed` expands bucket mappings without implying no-double-credit blocking.
- `no_double_count` blocks multiple members of the same group from filling credit twice.

## Runtime Compatibility Note

The checked-in data model no longer stores a combined `course_prereqs.csv` or a fixed `warning_text` column. Runtime compatibility fields may still exist internally, but they are derived from the split prerequisite inputs rather than stored as first-class CSV data.
