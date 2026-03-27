# Paperclip Phase 1 Business Schema

Date: 2026-03-27
Scope: Phase 1 only

## Purpose

This schema defines the minimum Paperclip objects needed to turn company-level ideas into Papzin & Crew execution work without creating a second task board.

Paperclip owns strategy, governance, approvals, and audit history.
Task Tracker owns execution state.
PapzinAI/OpenClaw owns the worker pipeline.

## Core Entities

### 1) `goal`
Represents a company-level outcome.

Required fields:
- `goal_id` — stable identifier
- `title` — short human-readable goal
- `description` — plain-English explanation
- `owner_role` — business owner role in Paperclip
- `priority` — `low | normal | high | urgent`
- `status` — `draft | approved | active | paused | complete`
- `budget_guardrail` — max allowed spend / operational limit
- `created_at`
- `updated_at`
- `audit_ref` — link to decision history or note

### 2) `initiative`
Represents a scoped company action under one goal.

Required fields:
- `initiative_id`
- `goal_id`
- `title`
- `description`
- `owner_role`
- `approval_level` — e.g. `advisory | standard | gated | executive`
- `risk_level` — `low | medium | high`
- `budget_guardrail`
- `paperclip_status` — `proposed | approved | active | blocked | done`
- `tracker_link` — pointer to one or more Task Tracker cards
- `source_links` — docs, notes, or references used to justify the initiative
- `created_at`
- `updated_at`
- `audit_ref`

### 3) `owner_role`
Represents a business/governance responsibility in Paperclip.

Required fields:
- `role_id`
- `name`
- `lane` — one of Paperclip company roles or PapzinAI execution roles
- `responsibility_summary`
- `approval_power`
- `budget_authority`

Suggested Phase 1 Paperclip roles:
- CEO / board
- Product / CPO
- CTO / engineering governance
- Growth / marketing
- Content / curation
- Support / ops

### 4) `approval_level`
Defines how much permission an initiative needs before it can move into tracker intake.

Values:
- `advisory`
- `standard`
- `gated`
- `executive`

### 5) `budget_guardrail`
Defines the spending or resource ceiling for a goal or initiative.

Required fields:
- `currency`
- `max_amount`
- `period`
- `notes`
- `storage_policy`

`storage_policy` must explicitly state whether durable assets are off-host and whether EC2 disk is runtime-only.

## Linkage Rules

The required chain is:

`goal -> initiative -> tracker task(s)`

Rules:
- A goal may contain multiple initiatives.
- An initiative may map to one or more Task Tracker cards.
- Every tracker card created from Paperclip must point back to exactly one goal and one initiative.
- Paperclip must not own or mutate tracker status.
- Task Tracker is the source of truth for execution state.

## Phase 1 Required Metadata on Tracker Intake

When Paperclip proposes tracker work, the adapter must pass:
- `tracker_title`
- `tracker_description`
- `goal_id`
- `initiative_id`
- `owner_role`
- `execution_lane`
- `risk_level`
- `approval_level`
- `source_links`
- `budget_guardrail`
- `storage_policy`

## EC2 Storage Guardrail

Paperclip rollout planning must treat EC2 disk as runtime-only.

Rules:
- Durable media, backups, and long-lived artifacts stay off-host.
- EC2 storage is for temp files, runtime caches, and log rotation only.
- Local disk usage needs thresholds and cleanup rules.
- If host storage gets tight, fallback storage must be explicit and reversible.

## Phase 1 Initiative Templates

### Mobile upload / publish clarity
- Goal: make the pre-publish state obvious on mobile.
- Owner role: Product / CPO
- Approval level: standard
- Risk: low
- Budget guardrail: small UI work only, no infra expansion

### First-artist onboarding
- Goal: reduce friction for first-time contributors.
- Owner role: Growth / marketing
- Approval level: standard
- Risk: medium
- Budget guardrail: no production data changes without approval

### Playlist / curation workflow
- Goal: improve content organization and discovery.
- Owner role: Content / curation
- Approval level: gated
- Risk: medium
- Budget guardrail: keep storage and content changes auditable

### Support triage classification
- Goal: route support issues to the right lane quickly.
- Owner role: Support / ops
- Approval level: advisory
- Risk: low
- Budget guardrail: no direct customer-facing action without review

## Minimal Data Shapes

### Goal
```json
{
  "goal_id": "goal_paperclip_papzincrew_001",
  "title": "Improve Papzin & Crew onboarding and release flow",
  "description": "Make it easier for DJs and users to understand what happens before publish and how to move from upload to release.",
  "owner_role": "Product / CPO",
  "priority": "high",
  "status": "approved",
  "budget_guardrail": {
    "currency": "ZAR",
    "max_amount": 0,
    "period": "phase-1",
    "storage_policy": "durable assets off-host; EC2 runtime-only"
  }
}
```

### Initiative
```json
{
  "initiative_id": "init_paperclip_phase1_mobile_publish_clarity",
  "goal_id": "goal_paperclip_papzincrew_001",
  "title": "Mobile publish-state clarity",
  "description": "Clarify when a mix is selected, processed, and ready before Publish.",
  "owner_role": "Product / CPO",
  "approval_level": "standard",
  "risk_level": "low",
  "paperclip_status": "approved",
  "tracker_link": ["#3"],
  "source_links": ["docs/paperclip-phase-1-execution-packet.md"],
  "budget_guardrail": {
    "currency": "ZAR",
    "max_amount": 0,
    "period": "phase-1",
    "storage_policy": "durable assets off-host; EC2 runtime-only"
  }
}
```

## Non-Goals for Phase 1

- No direct deploy control
- No direct DB mutation from Paperclip
- No customer messaging without approval
- No second task board
- No Phase 2 heartbeat automation
- No broad cross-project expansion before the Papzin & Crew pilot is stable

## Acceptance Criteria

Phase 1 schema is good enough when:
- every goal can point to at least one initiative
- every initiative can point to tracker work
- every tracker card can trace back to a Paperclip goal and initiative
- approval and budget guardrails are explicit
- EC2 storage is handled as runtime-only with a cleanup policy

## Notes

This schema is intentionally minimal. It is only meant to support the first tracker-first bridge and the first Papzin & Crew pilot lane.
