# Saved Feature Redo Plan (v2.2.0)

## Goal
Replace the current browser-local saved-plans implementation with a durable, account-backed saved feature that is fast to browse, safe to mutate, resilient across devices/tabs, and explicit about snapshot freshness.

This plan is based on:
- Current repo behavior in `frontend/src/lib/savedPlans.ts`, `frontend/src/hooks/useSavedPlans.ts`, and `frontend/src/components/saved/SavedPlansPage.tsx`
- Current Web platform guidance on `localStorage`, storage quotas, and IndexedDB
- Current accessibility guidance for modal dialogs
- Current API guidance around pagination and idempotent writes
- Current HTTP guidance around cache validation and conditional updates
- Current API security guidance for object-level authorization
- Current UX guidance for destructive actions and undo

## Why redo it
The current implementation works as a local prototype, but it has structural limits:

1. Storage is synchronous and browser-local.
   `window.localStorage` is blocking, tab-scoped for update flow, and not suitable for large records or cross-device persistence.

2. The saved record stores too much volatile data.
   `SavedPlanRecord` embeds the full `RecommendationResponse`, which is expensive to store, hard to version, and tightly coupled to planner response shape.

3. Freshness is too naive.
   `fresh | stale | missing` is currently derived only from `resultsInputHash === inputHash`, which does not capture catalog version changes, rules-engine changes, or planner algorithm revisions.

4. The saved screen is detail-heavy but library-light.
   The page is optimized for opening one plan modal, not for scanning, finding, organizing, or safely acting on many plans.

5. Delete and restore flows are weak.
   The card hover delete is easy to trigger, and there is no trash/undo model.

6. There is no backend source of truth.
   That prevents sync, auditability, server-side migration, usage analytics, permissions, and conflict handling.

## Research takeaways

### Frontend
1. `localStorage` is synchronous and can throw on write.
   Implication: do not keep the saved feature on large JSON payloads in `localStorage`; use backend persistence as primary and IndexedDB only as an offline cache.

2. Browser storage is quota-limited and eviction behavior varies by browser.
   Implication: storing full recommendation payloads plus derived UI state in local storage is fragile at scale.

3. IndexedDB is designed for larger structured client-side data than `localStorage`.
   Implication: if we support offline-first viewing or draft saves, use IndexedDB for cached snapshots and sync queues, not `localStorage`.

4. Modal dialogs require strict focus management and should be used sparingly for dense tasks.
   Implication: a full-screen or routed detail view is a better default than a modal for plan inspection/editing.

5. Empty states should explain value and point to the next action.
   Implication: `/saved` should distinguish between first-use empty state, filtered-empty state, offline state, and error state.

### Backend
1. List endpoints should page results and expose a stable cursor or ordering contract.
   Implication: `/saved-plans` should default to cursor pagination ordered by `updated_at desc`.

2. Write endpoints benefit from idempotency on create flows.
   Implication: creating a saved plan from the planner should accept an idempotency key to prevent duplicate saves on retries/double-clicks.

3. Conditional updates are the safest way to prevent silent overwrite in concurrent edits.
   Implication: update/archive/delete should use a version field or `etag`/`if-match` style concurrency token.

4. Server-side records should separate canonical inputs from derived snapshots.
   Implication: inputs are the durable truth; recommendation snapshots are cached artifacts that can be regenerated.

5. Conditional request headers solve two different problems:
   `If-Match` helps prevent lost updates on writes, and `If-None-Match` helps avoid re-downloading unchanged resources on reads.
   Implication: saved-plan detail and list endpoints should expose `ETag` values and support conditional requests where useful.

6. Object-level authorization is mandatory for user-owned saved resources.
   Implication: every `GET /saved-plans/:id`, `PATCH`, `DELETE`, `refresh`, and `resume` path must verify ownership server-side, not just trust the supplied ID.

### Security and data integrity
1. Client-side storage should not be treated as trusted.
   Implication: imported local saved plans, IndexedDB cache entries, and any browser-stored drafts must be validated like external input.

2. Sensitive or user-specific planning data should be minimized in browser persistence.
   Implication: if local cache exists at all, keep it to non-sensitive summaries or encrypted/short-lived artifacts where possible, and clear it on logout/account switch.

3. Saved-plan APIs are exposed to classic user-owned-resource risks.
   Implication: row-level ownership checks, audit logs for destructive actions, and test coverage for cross-user access are part of the feature, not optional hardening.

### UX behavior
1. Interruptive dialogs should be used sparingly.
   Implication: browsing, viewing details, and most management actions belong in routed screens or inline surfaces, not stacked modals.

2. Destructive actions are often better handled with reversible undo than pre-emptive warnings.
   Implication: archive + undo toast is a better primary flow than immediate hard delete behind a hover icon and confirm modal.

3. Complex tasks that involve multiple edits before commit should use full-page or full-screen task flows.
   Implication: any future inline saved-plan editing should be route-based and draftable, not nested inside a modal.

## Implications for Marqbot
These are repo-specific inferences from the research plus the current codebase:

1. Saved plans should become a library of named planner snapshots, not a dump of the last recommendation payload.

2. The canonical saved object should be small, versioned, and backend-owned:
   user intent, planner inputs, display metadata, freshness metadata, and optional derived snapshot summary.

3. Full semester recommendations should be treated as a snapshot artifact:
   useful to render immediately, disposable when stale, and regenerable from canonical inputs.

4. The saved surface should optimize for three primary jobs:
   find a plan, understand whether it is still trustworthy, and resume work safely.

5. "Edit in Planner" should remain, but direct mutation inside the saved screen should be limited at first.
   The library should not become a second planner with duplicated business rules.

## Target product behavior

### Primary user flows
1. Save current plan from Planner.
   User names the plan, optionally adds notes/tags, and gets immediate confirmation.

2. Browse saved plans.
   User sees a searchable, filterable library with sort options, freshness state, and lightweight summary cards.

3. Open plan detail.
   User lands on a dedicated detail page with snapshot summary, semester preview, notes, and actions.

4. Resume in Planner.
   User loads canonical inputs plus the latest valid snapshot into planner state.

5. Refresh stale plan.
   User re-runs recommendations against current rules/catalog and stores a new snapshot version.

6. Archive or restore.
   Delete becomes soft-delete first. Permanent delete is secondary.

### UX rules
1. Replace the detail modal with route-based detail pages.
   Use `/saved` for the library and `/saved/[id]` for detail. This removes modal complexity and improves deep-linking, back-button behavior, and accessibility.

2. Keep cards summary-first.
   Each card should show:
   - Name
   - Updated time
   - Major/track summary
   - Snapshot freshness
   - Snapshot age
   - Optional tag chips

3. Move destructive actions out of hover-only affordances.
   Primary card click opens detail. Delete/archive lives in a visible actions menu with undo or soft-delete.

4. Make freshness explainable.
   Replace opaque `Fresh / Needs re-run / No recs` with states backed by reasons:
   - Current
   - Inputs changed
   - Catalog changed
   - Planner rules changed
   - Snapshot missing

5. Distinguish library empty states.
   - No saved plans yet
   - No results for current search/filter
   - Offline and no cached data
   - Failed to load

6. Avoid inline full-plan editing on the saved screen in v1 of the redo.
   The detail page should support metadata edits and "resume in planner"; semester editing stays in Planner.

## Target data model

### Canonical record
```ts
type SavedPlan = {
  id: string;
  userId: string;
  name: string;
  notes: string | null;
  tags: string[];
  status: "active" | "archived";
  plannerInputs: SavedPlanInputs;
  plannerInputHash: string;
  latestSnapshotId: string | null;
  latestSnapshotFreshness: "current" | "inputs_changed" | "catalog_changed" | "rules_changed" | "missing";
  latestSnapshotReason: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};
```

### Snapshot artifact
```ts
type SavedPlanSnapshot = {
  id: string;
  savedPlanId: string;
  recommendationData: RecommendationResponse;
  inputHashAtGeneration: string;
  catalogVersion: string;
  plannerVersion: string;
  generatedAt: string;
};
```

### Why split them
1. Canonical records stay small and stable.
2. Snapshots can be regenerated, expired, and versioned independently.
3. The list page can render from compact summary fields without pulling the full semester payload every time.

## Backend plan

### API surface
1. `GET /api/saved-plans`
   Cursor-paginated list with filters: `status`, `q`, `freshness`, `updated_before`.

2. `POST /api/saved-plans`
   Create canonical record plus optional initial snapshot.
   Require idempotency key.

3. `GET /api/saved-plans/:id`
   Returns record plus summary fields and optionally latest snapshot.

4. `PATCH /api/saved-plans/:id`
   Metadata update only in first phase: name, notes, tags, status.
   Require version token.

5. `POST /api/saved-plans/:id/refresh`
   Re-run planner against canonical inputs and write a new snapshot.

6. `POST /api/saved-plans/:id/resume`
   Optional helper endpoint if we want a normalized planner bootstrap payload from the server.

7. `DELETE /api/saved-plans/:id`
   Soft-delete or archive behavior, not immediate hard delete.

8. `GET /api/saved-plans/:id/snapshot`
   Optional separate endpoint if snapshot payload size makes the detail response too heavy.

### Backend rules
1. Planner inputs are canonical; snapshots are derived.
2. The list endpoint must not ship full semester payloads by default.
3. Updates must reject stale version tokens to prevent last-write-wins data loss.
4. Snapshot generation should record `catalogVersion` and `plannerVersion`.
5. Refresh should be asynchronous if generation latency is material.
   If generation is fast now, keep it synchronous first but design the schema so jobs can be added later.
6. Every object lookup must enforce user ownership or tenant scoping.
7. Detail/list responses should expose `ETag`; writes should require `If-Match` or an equivalent version token.
8. Large snapshot payloads should be cacheable and revalidatable with `If-None-Match`.
9. Archive and restore should be auditable.

### Persistence concerns
1. Add server-side limits for name length, notes length, and tag count.
2. Store only what is needed to reconstruct planner state.
3. Index by `user_id`, `status`, and `updated_at`.
4. Plan for snapshot retention:
   keep latest only at first, or latest + previous one if diff/rollback becomes important.
5. Decide whether snapshots are hard-deleted, retained for a grace period, or retained for audit/debug after archive.
6. Add explicit schema/version fields so backend migrations do not silently corrupt old snapshots.

## Frontend plan

### Information architecture
1. `/saved`
   Library view with search, filters, sort, pagination/load-more, and empty/error states.

2. `/saved/[id]`
   Detail page with metadata, freshness explanation, semester preview, and actions:
   Resume in Planner, Refresh snapshot, Archive, Rename, Update notes.

3. Planner save flow
   Save modal becomes a small, focused create flow:
   name, optional notes, optional tags, and success toast.

### State management
1. Replace `useSavedPlans()` local storage CRUD with API-backed data hooks.
2. Add explicit request states:
   `idle | loading | refreshing | saving | deleting | error`.
3. Keep a small client cache and revalidate after mutations.
4. If offline support matters, add IndexedDB cache for read-through snapshots and queued refresh/save attempts.
5. Treat all local cache as advisory.
   If cached detail conflicts with server version, server wins and the client should show a refresh/conflict state instead of silently merging.

### Library UX
1. Default sort: `updated_at desc`.
2. Filters:
   - Status
   - Freshness
   - Major/track
   - Tags
3. Search:
   name + notes + tags
4. Batch actions are not needed initially.
5. Show archive instead of hard delete in the primary surface.
6. Use explicit action menus on cards; no hover-only destructive controls.
7. Show result counts and filter-empty states separately from first-use empty state.

### Detail UX
1. Show plan header with name, updated time, status, freshness, and reason.
2. Show a concise summary block before semester details.
3. Render latest snapshot only if available.
4. If snapshot is stale, keep it viewable but visually downgraded and explain why.
5. Resume in Planner should be a first-class action.
6. Refresh should keep the user on the detail page and update in place.
7. Archive should remove the item optimistically from active views and offer undo.
8. If the plan changed elsewhere, show a clear conflict message and force reload before metadata edits continue.

## Migration plan

### Phase 0: stop making the current model larger
1. Freeze new feature work on top of `localStorage` saved plans.
2. Do not add more fields to `SavedPlanRecord` beyond what is needed to bridge migration.

### Phase 1: introduce backend model and endpoints
1. Add saved-plan tables/models.
2. Add list/detail/create/update/archive/refresh endpoints.
3. Add freshness computation using:
   - planner input hash
   - catalog version
   - planner version
4. Add ownership checks, conditional updates, and cache validators from the start.

### Phase 2: frontend library rewrite
1. Replace `SavedPlansPage` modal-driven flow with route-based library/detail flow.
2. Replace hover delete with explicit actions menu.
3. Add search, filter, sort, and paginated loading.

### Phase 3: local migration bridge
1. On first authenticated load, detect existing `localStorage` plans.
2. Offer one-time import.
3. Import canonical inputs first, then upload snapshots if present and valid.
4. Mark imported records with `source = local_import` internally for debugging/migration metrics.

### Phase 4: remove localStorage as primary store
1. Keep local cache only for offline/bootstrap if needed.
2. Remove create/update/delete source-of-truth logic from `frontend/src/lib/savedPlans.ts`.

## File-level implementation map

### Backend
1. Add saved-plan persistence and handlers in backend API modules.
2. Add schema/version fields to planner output metadata so freshness can detect catalog/rules changes.
3. Add tests for pagination, idempotent create, stale update rejection, archive flow, refresh flow, and cross-user authorization failures.
4. Add `ETag`/conditional request coverage for detail and update endpoints.

### Frontend
1. Replace [savedPlans.ts](C:/Users/marki/OneDrive/harvey%20mode/coolsies/marqbot/frontend/src/lib/savedPlans.ts) local CRUD with API client utilities plus optional cache helpers.
2. Replace [useSavedPlans.ts](C:/Users/marki/OneDrive/harvey%20mode/coolsies/marqbot/frontend/src/hooks/useSavedPlans.ts) with network-backed hooks.
3. Replace [SavedPlansPage.tsx](C:/Users/marki/OneDrive/harvey%20mode/coolsies/marqbot/frontend/src/components/saved/SavedPlansPage.tsx) with a library screen optimized for browse/search/filter.
4. Add routed detail page under `frontend/src/app/saved/[id]/page.tsx`.
5. Update save modal to call backend create and surface duplicate/network errors clearly.
6. Update types in [types.ts](C:/Users/marki/OneDrive/harvey%20mode/coolsies/marqbot/frontend/src/lib/types.ts) to separate canonical saved-plan records from snapshot payloads.

## Risks and decisions
1. Auth dependency.
   A real saved feature is user-scoped. If auth is not ready, the redo either blocks or becomes a temporary anonymous backend/session store.

2. Snapshot generation cost.
   If `/recommend` is expensive, refresh may need a job queue and polling state sooner than expected.

3. Migration complexity.
   Existing local records may contain malformed or oversized payloads. Import must be best-effort, not all-or-nothing.

4. Privacy and data handling.
   Saved plans may encode academic history and intent. Server retention, access control, and export/delete policies need to be explicit.

5. Planner coupling.
   If planner response shape keeps changing, snapshot schema needs a version boundary or mapper layer to avoid repeated saved-feature breakage.

6. Cache complexity.
   Adding IndexedDB plus API revalidation can easily become over-engineered. If offline is not a product requirement, keep client caching shallow.

7. Undo semantics.
   Archive-with-undo is better UX, but requires a real archived state and delayed/permanent-delete policy instead of a thin frontend trick.

## Acceptance criteria
1. A user can save, browse, search, open, archive, restore, and resume plans across sessions and devices.
2. The library page does not require downloading every full recommendation payload.
3. A saved plan clearly states whether its snapshot is trustworthy and why.
4. Concurrent edits do not silently overwrite each other.
5. The detail view is deep-linkable and accessible without modal-only interaction.
6. Existing local plans can be imported once with clear success/failure reporting.
7. Saved-plan endpoints reject cross-user access and stale write attempts with explicit, test-covered behavior.

## Execution order
1. Finalize backend data contract and freshness rules.
2. Implement backend persistence and tests.
3. Rewrite frontend types and data hooks against the new contract.
4. Ship route-based library and detail pages.
5. Add import-from-local flow.
6. Remove `localStorage` as the primary store.

## Sources
1. MDN Web Docs, `Window: localStorage property`: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
2. MDN Web Docs, Storage quotas and eviction criteria: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
3. MDN Web Docs, IndexedDB API: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
4. WAI-ARIA Authoring Practices Guide, Dialog (Modal) Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
5. Carbon Design System, Empty states pattern: https://carbondesignsystem.com/patterns/empty-states-pattern/
6. Stripe API docs, Idempotent requests: https://docs.stripe.com/api/idempotent_requests
7. GitHub REST API docs, Using pagination in the REST API: https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api
8. MDN Web Docs, Web Storage API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API
9. web.dev, Best Practices for Persisting Application State with IndexedDB: https://web.dev/articles/indexeddb-best-practices-app-state
10. MDN Web Docs, If-Match header: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Match
11. MDN Web Docs, If-None-Match header: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/If-None-Match
12. OWASP API Security Top 10 2023, API1 Broken Object Level Authorization: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/
13. Material Design, Dialogs: https://m1.material.io/components/dialogs.html
14. elementary Human Interface Guidelines, Always Provide an Undo: https://docs.elementary.io/hig/user-workflow/always-provide-an-undo

## Notes
The specific Marqbot data model, route split, and migration strategy are inferences built from the sources above plus the current repo structure. The sources support the underlying constraints and patterns; they do not prescribe this exact product shape.
