# Paperclip Phase 1 Adapter Contract

Date: 2026-03-27
Scope: Phase 1 only, mapped to tracker card `#203`

## Purpose

This contract defines how Paperclip initiatives are converted into Task Tracker work without creating a second task board.

Paperclip proposes. Task Tracker records execution. PapzinAI/OpenClaw performs the work.

## Contract Summary

The adapter accepts a validated Paperclip initiative and emits one or more tracker-ready intake payloads.

It must:
- preserve traceability from goal -> initiative -> tracker task
- include only business-safe metadata
- avoid mutating live execution state beyond initial intake
- reject incomplete or under-specified proposals
- keep Task Tracker as the execution source of truth

## Required Input Fields

The adapter expects an initiative object with at least:
- `goal_id`
- `initiative_id`
- `title`
- `description`
- `owner_role`
- `approval_level`
- `risk_level`
- `budget_guardrail`
- `storage_policy`
- `source_links`
- `paperclip_status`
- `target_lane`

If any of these are missing, the adapter must reject the request.

## Validation Rules

The adapter must reject an initiative when:
- `goal_id` is missing
- `initiative_id` is missing
- `owner_role` is missing
- `approval_level` is missing
- `paperclip_status` is not approved for intake
- the proposed scope tries to own task status directly
- the proposal does not fit one of the allowed Phase 1 Papzin & Crew lanes

Allowed Phase 1 lanes:
- mobile upload / publish clarity
- first-artist onboarding
- playlist / curation workflow
- support triage classification

## Output Shape

A valid initiative becomes one or more Task Tracker intake payloads.

Required output fields:
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
- `requires_consent`
- `status`
- `created_by_type`

## Output Rules

### 1) Status
The adapter may only create tracker cards in the initial intake state.

Phase 1 default:
- `status = todo`

### 2) Consent and execution flags
The adapter sets consent/execution flags based on the approval state.

Suggested rule:
- `advisory` or `standard` and already approved for intake -> `requires_consent = false`, `auto_executable = true`
- `gated` or `executive` -> `requires_consent = true`, `auto_executable = false` until human approval is confirmed

### 3) Traceability
Every created tracker task must carry:
- the Paperclip goal reference
- the Paperclip initiative reference
- the source links used to justify intake
- the owner role responsible for business context

### 4) No dual ownership
The adapter must never:
- mutate tracker status after intake
- create a second authoritative work board
- overwrite Task Tracker state from Paperclip
- perform deploys, DB mutations, or customer messaging

## Tracker Payload Example

```json
{
  "title": "Papzin & Crew: clarify pre-upload state before Publish on mobile",
  "description": "Mobile publish-state clarity initiative from Paperclip. Keep the selected/processing/ready states obvious before Publish. Goal: improve onboarding and release flow.",
  "status": "todo",
  "priority": "high",
  "category": "planning",
  "requires_consent": false,
  "created_by_type": "agent",
  "details": {
    "goal_id": "goal_paperclip_papzincrew_001",
    "initiative_id": "init_paperclip_phase1_mobile_publish_clarity",
    "owner_role": "Product / CPO",
    "execution_lane": "Papzin & Crew Improvements",
    "risk_level": "low",
    "approval_level": "standard",
    "source_links": ["docs/paperclip-phase-1-execution-packet.md", "docs/paperclip-phase-1-business-schema.md"],
    "budget_guardrail": {
      "currency": "ZAR",
      "max_amount": 0,
      "period": "phase-1"
    },
    "storage_policy": "durable assets off-host; EC2 runtime-only"
  }
}
```

## Transformation Rules

### Paperclip initiative -> tracker task

1. Read the initiative and confirm it is approved.
2. Validate the goal and initiative linkage.
3. Select the execution lane.
4. Build the tracker intake payload.
5. Push the payload to Task Tracker.
6. Store the resulting tracker ID back on the initiative link record.

### Multiple tasks per initiative

If one initiative needs multiple tracker cards:
- create a parent intake record in Paperclip
- create each tracker task with the same `goal_id` and `initiative_id`
- keep the tracker cards individually traceable
- avoid splitting work so fine that ownership becomes noisy

## EC2 Storage Handling

The adapter must explicitly pass through the storage policy so rollout work does not assume EC2 disk is durable storage.

Rules:
- durable media, backups, and long-lived artifacts stay off-host
- EC2 storage is runtime-only for temp files, caches, and log rotation
- if host storage becomes constrained, the adapter should fail closed rather than silently storing durable artifacts locally

## Safety and Rejection Cases

The adapter must refuse a request when:
- the proposal is still speculative and not approved
- the proposal lacks a stable goal/initiative reference
- the proposal attempts to bypass Task Tracker
- the proposal requests direct production ownership
- the proposal tries to use Paperclip as a second execution board

## Acceptance Criteria

The adapter contract is good enough when:
- a Paperclip initiative can become a tracker payload with traceable metadata
- every tracker payload can be traced back to one Paperclip goal and one initiative
- the adapter cannot change live tracker status after intake
- EC2 storage limits are explicit in the payload or metadata
- the contract is clear enough for implementation in the next coding step

## Next Step

After this contract, the next artifact is the tracker read-back summary contract for `#204`.
