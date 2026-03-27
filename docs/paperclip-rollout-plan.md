# Paperclip Rollout Plan for Papzin & Crew

Date: 2026-03-27
Status: Draft v1

## 1) Why this exists

Paperclip is the company-level orchestration layer. PapzinAI/OpenClaw are the worker and operations engine. Task Tracker remains the execution source of truth.

This rollout plan defines how to use Paperclip to help Papzin & Crew without creating two competing control planes.

## 2) Core split

### Paperclip owns
- company goals
- org roles and reporting lines
- strategic initiatives
- budgets and cost guardrails
- approvals / governance
- heartbeat supervision at the company level
- audit trails and decision history

### PapzinAI / OpenClaw owns
- planning
- research
- implementation
- review
- automation execution
- agent orchestration for the actual work

### Task Tracker owns
- task state
- readiness
- consent gates
- execution history
- completion state
- what is actively todo / in-progress / review / done

### EC2 host storage owns
- runtime-only files
- short-lived caches and temp artifacts
- logs that are safe to rotate
- small local working data when off-host storage is unavailable

EC2 disk must be treated as a limited operational resource, not the primary store for Papzin & Crew media, backups, or long-term artifacts. Durable assets should stay in B2/Postgres/off-host storage, and the rollout should include explicit disk-usage thresholds, log rotation, cleanup jobs, and fallback rules for when host storage runs low.

## 3) Rollout principles

1. **One source of truth per layer**
   - Paperclip = strategy and governance
   - Task Tracker = execution truth
   - PapzinAI = worker engine

2. **No dual ownership of task status**
   - Paperclip can propose work.
   - Task Tracker records execution.
   - PapzinAI agents do the work.

3. **No direct production control from Paperclip in v1**
   - No direct DB changes
   - No direct deploy decisions
   - No customer-facing actions without approval

4. **Everything should be auditable**
   - Goals should trace to initiatives
   - Initiatives should trace to tracker tasks
   - Task progress should trace back to the business goal

## 4) Proposed org model for Papzin & Crew

### Strategy / governance roles in Paperclip
- CEO / board
- Product / CPO
- CTO / engineering governance
- Growth / marketing
- Content / curation
- Support / ops

### Execution roles in PapzinAI
- Lead
- Planner
- Researcher
- Builder
- Reviewer
- later: Builder Assist / specialist workers

Paperclip decides **what matters**.
PapzinAI decides **how to execute it**.

## 5) v1 rollout phases

### Phase 0 — Alignment
Goal: make the relationship explicit before adding more automation.

Deliverables:
- Paperclip role mapping for Papzin & Crew
- initial company goals list
- initial initiative map
- budget / approval model draft
- explicit anti-confusion rules

### Phase 1 — Tracker-first bridge
Goal: let Paperclip proposals become tracker work safely.

Deliverables:
- thin adapter that converts Paperclip initiatives into Task Tracker tasks
- read-back summaries from tracker to Paperclip
- goal → initiative → task linkage
- status sync in one direction only

### Phase 2 — Governance and heartbeats
Goal: supervise work without micromanaging it.

Deliverables:
- scheduled heartbeats for company-level reporting
- budget thresholds and stop conditions
- approval gates for risky actions
- immutable audit trail for key decisions

### Phase 3 — Pilot lane
Goal: prove the model on one contained Papzin & Crew area.

Best pilot candidates:
- upload / publish flow clarity on mobile
- large-file UX and performance
- onboarding first artists
- playlist / curation workflow
- support triage classification

Recommended first pilot: **upload / publish clarity on mobile** because it is visible, measurable, and already tied to current Papzin & Crew work.

### Phase 4 — Expand
Goal: extend Paperclip’s business coordination role once the pilot is stable.

Possible expansions:
- artist onboarding
- curation / playlist planning
- growth experiments
- support triage
- marketing campaign coordination
- budgeted initiative tracking

## 6) Safe handoff model

### Start here
Paperclip should not directly own task state.

Instead:
1. Paperclip proposes a business initiative.
2. PapzinAI / Task Tracker turns it into execution tasks.
3. PapzinAI agents work the tasks.
4. Tracker updates become the ground truth.
5. Paperclip receives summarized progress back.

### Later, if stable
- Paperclip may submit structured task-intake requests
- Paperclip may trigger approved planning flows
- Paperclip may receive automatic summaries

But even then:
- do not give Paperclip direct control over execution status
- do not let it become a second task board

## 7) What Paperclip should not do in v1

- own task status directly
- deploy code directly
- mutate production data directly
- send customer-facing messages without approval
- make budget-spending decisions without guardrails
- bypass Task Tracker as the source of truth

## 8) Success criteria for the first rollout

We know the rollout is working when:
- a Paperclip goal can be defined cleanly
- the goal can be broken into initiatives
- initiatives can be converted into tracker tasks
- PapzinAI can execute the tasks
- Paperclip can show a business-level summary
- there is no confusion about who owns state

## 9) Immediate next steps

1. Keep tracker cards **#202–#204** as the initial Paperclip planning slice.
2. Define the exact Paperclip data model for goals, org roles, budgets, and approvals.
3. Implement the tracker-first adapter bridge.
4. Pilot the system on one Papzin & Crew lane.
5. Add a short heartbeat/report format so Paperclip can supervise without taking over execution.

## 10) Bottom line

Paperclip is the **company**, PapzinAI is the **worker engine**, and Task Tracker is the **execution truth**.

That is the structure to keep as we roll Paperclip into Papzin & Crew.
