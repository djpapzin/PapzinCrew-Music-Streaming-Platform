# Paperclip Phase 1 Read-Back Summary Contract

Date: 2026-03-27
Scope: Phase 1 only, mapped to tracker card `#204`

## Purpose

This contract defines how Task Tracker progress is summarized back into Paperclip business language.

Paperclip should receive a concise company-level view, not raw execution state.

## Contract Summary

The read-back layer consumes Task Tracker updates and produces a business-safe summary for Paperclip.

It must:
- summarize initiative progress without duplicating the task board
- preserve traceability to tracker cards
- surface blockers, risks, and next milestones
- keep summary data one-way from Task Tracker into Paperclip
- avoid task-level edits or state mutations

## Required Input

The summary layer should read:
- tracker task status
- tracker review state
- tracker blocker state
- tracker linked goal/initiative metadata
- tracker owner role
- tracker milestone notes
- tracker budget and storage guardrails

## Required Output Fields

A Paperclip-facing summary must include:
- `goal_id`
- `initiative_id`
- `initiative_title`
- `business_status_summary`
- `current_tracker_phase`
- `blocker_summary`
- `next_milestone`
- `risk_flag`
- `budget_flag`
- `storage_flag`
- `linked_tracker_cards`
- `last_updated`
- `audit_ref`

## Summary Rules

### 1) Business language only
Paperclip summaries should describe progress in business terms.

Good:
- "Mobile publish-state clarity is in review"
- "Support triage classification is blocked on approval"
- "Curation workflow is ready for implementation"

Avoid:
- raw internal API payloads
- execution-only fields that do not help business review
- status noise that does not change a decision

### 2) One-way sync
The read-back layer must not write status changes back into Task Tracker.

Rules:
- no task edits
- no status mutation
- no hidden reclassification
- no direct ownership transfer from Paperclip to tracker

### 3) Surface only decision-relevant flags
The summary should surface only flags that help Papzin make a business decision.

Examples:
- `risk_flag = low | medium | high`
- `budget_flag = within_guardrail | near_limit | over_limit`
- `storage_flag = healthy | warning | constrained`

### 4) Include linked cards
Every summary must show the tracker cards that back the initiative.

That keeps the business view auditable and traceable.

## Summary Shape Example

```json
{
  "goal_id": "goal_paperclip_papzincrew_001",
  "initiative_id": "init_paperclip_phase1_mobile_publish_clarity",
  "initiative_title": "Mobile publish-state clarity",
  "business_status_summary": "In review after schema and adapter contracts were drafted.",
  "current_tracker_phase": "review",
  "blocker_summary": "Awaiting review of adapter and summary contracts.",
  "next_milestone": "Approve Phase 1 contracts and begin implementation of the tracker-first adapter.",
  "risk_flag": "low",
  "budget_flag": "within_guardrail",
  "storage_flag": "healthy",
  "linked_tracker_cards": ["#202", "#203", "#204"],
  "last_updated": "2026-03-27T19:42:00Z",
  "audit_ref": "paperclip-phase1-rollout-2026-03-27"
}
```

## Storage and Budget Handling

Paperclip summaries should include storage and budget health when relevant.

Rules:
- If EC2 runtime disk is near threshold, surface `storage_flag = constrained`.
- If durable assets are still off-host and host disk is healthy, surface `storage_flag = healthy`.
- If budget guardrails are close to a limit, surface `budget_flag = near_limit`.
- If guardrails are exceeded, surface `budget_flag = over_limit` and mark the initiative accordingly.

## What the Read-Back Layer Must Not Do

- mutate tracker statuses
- create a second execution board
- replace Task Tracker as source of truth
- send customer-facing messages
- trigger production deploys
- silently invent new business meanings for tracker statuses

## Allowed Phase 1 Summary Views

The summary layer should support business views for:
- Papzin / CEO view
- Product view
- CTO / engineering governance view
- Growth / marketing view
- Content / curation view
- Support / ops view

Each view should show the same underlying initiative, but with language adapted to the role.

## Acceptance Criteria

The read-back contract is good enough when:
- a tracker initiative can be summarized into a Paperclip business update
- the summary includes blockers, next milestone, and linked tracker cards
- the summary does not mutate tracker state
- storage and budget flags are visible when relevant
- the output is concise enough for company-level review

## Next Step

After this contract, Phase 1 has all three core artifacts:
- `#202` schema
- `#203` adapter contract
- `#204` read-back summary contract

That is sufficient for implementation planning and a later code bridge.
