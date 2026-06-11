# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]

**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]

**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]

**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]

**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]

**Project Type**: [e.g., library/cli/web-service/mobile-app/compiler/desktop-app or NEEDS CLARIFICATION]

**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]

**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]

**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

**Affected Surfaces**: [public site, internal app, client portal, Supabase database, Edge Functions, Storage, automations/webhooks, external integrations, or N/A]

**Security/Tenant Scope**: [roles, organization/client boundaries, RLS/storage policies, secrets, service-role usage, or NEEDS CLARIFICATION]

**Business Rule Owner**: [frontend UI, hook/lib, Supabase migration/RLS, Edge Function, webhook, automation, or NEEDS CLARIFICATION]

**Observability/Rollback**: [audit logs, operational logs, migration rollback, controlled failure mode, or N/A]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Security and Least Privilege

- [ ] Public, internal, and client-portal surfaces remain separated by route,
      role, and backend authorization.
- [ ] No secrets, service-role keys, OpenAI/WhatsApp/Open Finance/Acessorias
      credentials, or integration tokens are exposed to client code or logs.
- [ ] Privileged operations validate JWT, organization, role, client access,
      action intent, and input shape before using service-role access.

### Tenant Isolation and Data Segregation

- [ ] New or changed operational data is organization-aware.
- [ ] Client portal flows enforce client-level access through `client_users`
      or a documented legacy fallback.
- [ ] RLS, storage policies, and signed URL scope are addressed for affected
      tables/files.

### Backend-Owned Business Rules

- [ ] Authorization, synchronization, deduplication, automation, completion,
      document classification, financial state, obligation state, and external
      integration rules live in the responsible backend layer.
- [ ] Any frontend-only rule is non-sensitive, justified, and backed by backend
      validation where data integrity or access control matters.

### Scalable Frontend and Data Access

- [ ] Shared/repeated remote state uses TanStack Query or a justified existing
      pattern.
- [ ] Independent requests start early and use `Promise.all` where safe.
- [ ] High-volume lists, filters, tables, and derived state use pagination,
      server filtering, indexing, `Map`/`Set`, virtualization, or another
      concrete scaling strategy.
- [ ] Public routes avoid importing internal-only workflows or heavy
      dependencies.

### Auditability, Reliability, and Operability

- [ ] Operational state changes have audit/logging coverage sufficient to
      identify actor, organization, client, action, and integration/automation.
- [ ] Integration and webhook failures fail closed for sensitive actions and
      return controlled UI errors.
- [ ] Validation commands are identified: `npm run lint`, `npm run test`,
      `npm run build`, or `npm run verify:deploy`.
- [ ] Migrations that alter RLS, constraints, tenant scope, or critical tables
      include rollout and rollback considerations.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
