# PREtendingMD / PEM FlowMaster Production Roadmap

## Product thesis

PREtendingMD should be the emergency department's real-time care-advancement assistant: a companion to the Epic trackboard that helps attendings and teams run the list, understand each patient's active plan, and reduce avoidable dead time between results, reassessments, decisions, and disposition.

The app should not replace the ED trackboard or the EMR. The trackboard remains the operational source of truth for rooming, status, bed flow, and shared departmental awareness. PREtendingMD should sit beside it as the cognitive workflow layer that answers:

- Which patients need provider attention now?
- What is the next care-advancing action?
- What is waiting on the system versus waiting on the provider?
- Which patients are approaching disposition but still have blockers?
- Who has been unintentionally idle after a result, treatment, consultant reply, or reassessment interval?

## Guiding design principles

1. **Companion, not replacement.** Mirror trackboard status language and room order so adoption feels familiar.
2. **Next action first.** Every patient card should surface one dominant next action and one reason it matters.
3. **Separate time from progress.** ED length of stay, time since last review, and clinical progress are related but not interchangeable.
4. **Make dead time visible.** The app's highest-value signal is the time between new actionable information and the next care decision.
5. **Avoid alert fatigue.** Use snooze, expected-delay states, and ownership labels so long waits are not all treated as provider failures.
6. **Structured when possible, transparent when inferred.** Imported Epic events should drive signals; free-text comments can assist but should be labeled as inferred.
7. **Minimal typing.** Manual entry should be a bridge for MVP only. Production adoption depends on Epic context, roster, orders, results, and event ingestion.
8. **Mobile for action, desktop for orchestration.** Mobile should answer “what do I need to do next?” Desktop should support running the full list.

## Highest-value clinical workflow concepts

### 1. Attention queue

The attention queue should be the primary safety and flow surface. It should rank patients by actionability, not simply by elapsed time.

Suggested buckets:

- **Needs provider now:** resulted diagnostic item, expired reassessment timer, consultant recommendation available, failed PO challenge, concerning vital trend.
- **Approaching disposition:** workup largely complete with remaining discharge/admit/obs checklist items.
- **Waiting but owned:** expected delay with an owner and snooze expiration.
- **System delay:** imaging queue, bed assignment, transport, consultant pending, social work, interpreter, pharmacy.
- **Boarding / admitted:** no active ED-provider action unless reassessment, meds, vitals, or family update is due.

### 2. Roadmap view

Use the Roadmap as a horizontal progress view, not as the main trackboard replacement.

Recommended phases:

1. Presentation / first contact
2. Initial assessment and orders
3. Workup / treatment in motion
4. Reassessment checkpoint
5. Disposition decision
6. Discharge / admit / ED observation readiness
7. Boarding / bed assigned / transfer of care

Each patient should show:

- trackboard status color stripe,
- room and chief complaint,
- provider/team owner,
- total ED time,
- time since last provider review,
- current blocker,
- next action,
- disposition target,
- snooze/expected-delay reason when applicable.

### 3. Running-the-list mode

Attendings often run the list top-to-bottom by room order. PREtendingMD should support a dedicated mode for this workflow:

- room-sorted patient rows,
- keyboard shortcuts on desktop,
- swipe/quick actions on mobile,
- one patient expanded at a time,
- “mark reviewed” that resets provider-review timer,
- “set next checkpoint” during list review,
- persistent unresolved blockers after list review.

The goal is a shared mental model after rounds:

- Patient A: waiting on CT, reassess when final.
- Patient B: likely DC, needs PO challenge and attending reassess.
- Patient C: admit accepted, family updated, bed pending.
- Patient D: forgotten risk, labs resulted 45 minutes ago with no plan update.

## Desktop experience recommendations

Desktop should optimize for team orchestration and full-department situational awareness.

### Layout

- **Left rail:** provider/team filters, care area, acuity, status, chief complaint pathway filters.
- **Center:** room-ordered running list or Roadmap view.
- **Right rail:** attention queue, bottlenecks, recently resulted items, dispo-ready patients.
- **Top bar:** current census, patients assigned to team, pending dispo count, overdue reassessment count, boarding count, metric trend.

### Patient row/card

Each row should be scan-friendly:

```text
Room | Patient initials/age | Complaint | ED time | Phase | Next action | Blocker | Owner | Dispo target
```

Recommended visual hierarchy:

1. Room and patient identifier.
2. Next action.
3. Blocker/why not moving.
4. Timer/urgency.
5. Task chips.
6. Full details only on expansion.

### Keyboard and mouse affordances

- `j/k` or arrow keys: move through list.
- `r`: mark reviewed/reassessed.
- `s`: snooze selected patient.
- `d`: set disposition target.
- `n`: add next action.
- `/`: search.
- Hover should show more detail; click should expand.

### Metrics panel

Show actionable operational metrics, not vanity metrics:

- median time from result-final to provider review,
- time from likely discharge to discharge order/paperwork,
- time from admit decision to handoff,
- patients with no provider review in threshold,
- consults pending beyond threshold,
- percent of patients with explicit next action.

## Mobile experience recommendations

Mobile should not attempt to reproduce the full trackboard. It should be an attending pocket cockpit.

### Mobile home

Use tabs or segmented control:

1. **Needs me** — actionable queue.
2. **My team** — provider/team patient list.
3. **Dispo** — likely DC/admit/obs patients.
4. **Boarding** — admitted/bed-pending patients needing periodic review.

### Mobile patient card

Keep cards concise:

- Room, initials, age, complaint.
- Trackboard status chip.
- Next action in bold.
- One blocker line.
- Timer badge.
- Quick buttons: Review, Snooze, Dispo, Call/Consult, Done.

### Mobile gestures

- Swipe right: mark reviewed.
- Swipe left: snooze.
- Long press: assign owner or next action.
- Tap task chip: cycle pending/complete/not needed.
- Bottom sheet: patient details, timeline, full plan.

### Mobile safety

- Require confirmation for write-back to Epic.
- Avoid displaying unnecessary PHI in notifications.
- Use initials/room/age by default unless authenticated and inside secure context.
- Auto-lock or blur content after inactivity.

## Epic / EMR integration strategy

### Integration phases

#### Phase 0: Manual MVP

- Manual roster or demo data.
- Manual next actions.
- Manual comment entry.
- Useful for product iteration, but not production-grade adoption.

#### Phase 1: SMART on FHIR embedded launch

Use SMART App Launch from Epic so the app receives user, patient, and encounter context where permitted. This is ideal for chart-context launch and single-patient workflow.

Likely useful FHIR resources:

- `Patient` for demographics.
- `Encounter` for ED encounter, class, location, and status.
- `Practitioner` / `PractitionerRole` for provider context.
- `Observation` for vitals and resulted lab values.
- `DiagnosticReport` for resulted lab/imaging reports.
- `ServiceRequest` for lab, imaging, and consult orders.
- `MedicationRequest` / `MedicationAdministration` for meds ordered/given.
- `Condition` for diagnoses/problem context where appropriate.
- `DocumentReference` for notes or reports when available and appropriate.
- `Communication` or `Task` where supported for messages, checklist tasks, or workflow events.

#### Phase 2: Team roster service

Single-patient SMART launch is not enough for running the ED list. For team workflow, build an approved backend integration that receives or queries the active ED roster.

Roster requirements:

- active ED patients by care area,
- room/bed,
- trackboard status,
- assigned providers/team,
- chief complaint,
- arrival time,
- current encounter ID,
- disposition state,
- comments or structured trackboard notes if exposed,
- bed assigned / boarding state.

Possible approaches, depending on institutional Epic configuration:

- Epic-approved FHIR search endpoints where data is exposed.
- Backend OAuth/client credentials for server-to-server workflows.
- HL7 v2 ADT/order/result feeds for operational event ingestion.
- Epic Interconnect or site-specific web services.
- Reporting database only for delayed analytics, not real-time care operations.

#### Phase 3: Event-driven flow engine

Move from periodic refresh to event-driven care advancement.

Events to ingest:

- patient arrives,
- room changes,
- provider assigned,
- order placed,
- lab resulted,
- imaging final/prelim available,
- medication administered,
- consult order placed,
- consultant note/recommendation available,
- discharge order placed,
- admit order placed,
- bed requested,
- bed assigned,
- discharge complete.

Each event should update a normalized patient state and produce a next-action recommendation only when clinically and operationally appropriate.

#### Phase 4: Controlled write-back

Only after trust and governance:

- write a standardized communication/note/task back to Epic,
- update a checklist item,
- send message to care team,
- write discrete flow comments if approved.

Write-back should always be auditable, attributable, reversible where possible, and visibly distinguished from automatically inferred state.

## Epic data availability considerations

Not every trackboard column is guaranteed to be exposed through standard FHIR. The Comments column may be a site-configured Epic ED trackboard field rather than a standard FHIR resource. Treat it as an integration discovery item.

Questions for Epic/IT:

1. What database item or Epic configuration backs the ED trackboard Comments column?
2. Is it exposed through FHIR, Interconnect, a custom web service, HL7, or another approved interface?
3. Can it be queried by encounter and timestamp?
4. Does it include author and last-updated time?
5. Can we receive events or only poll?
6. What are the rate limits and user-context constraints?
7. Can a provider-facing app access a care-team roster, or only chart-in-context patients?
8. What scopes and launch contexts are allowed for a third-party app?
9. What write-back, if any, is acceptable?
10. What audit artifacts does the hospital require?

## Flow engine concepts

### Patient state model

Normalize imported data into a compact model:

```ts
type FlowPhase =
  | 'new'
  | 'initial-assessment'
  | 'workup-treatment'
  | 'reassessment-due'
  | 'disposition-planning'
  | 'dispo-ready'
  | 'boarding'
  | 'closed';

type FlowBlockerType =
  | 'provider-action'
  | 'nursing-action'
  | 'lab-pending'
  | 'imaging-pending'
  | 'consult-pending'
  | 'medication-response'
  | 'po-challenge'
  | 'family-communication'
  | 'bed-flow'
  | 'social-work'
  | 'transport'
  | 'unknown';
```

### Next action object

```ts
type NextAction = {
  label: string;
  ownerRole: 'attending' | 'resident' | 'fellow' | 'nurse' | 'consultant' | 'system' | 'unknown';
  dueAt?: string;
  source: 'epic-event' | 'pathway' | 'manual' | 'trackboard-comment' | 'inference';
  confidence: 'confirmed' | 'likely' | 'needs-review';
  snoozedUntil?: string;
  snoozeReason?: string;
};
```

### Dead-time rules

Examples:

- Lab resulted + no provider review after threshold → reassessment due.
- Imaging final + no plan update → imaging review due.
- Zofran given + interval elapsed + no PO challenge documented → PO challenge due.
- Albuterol/neb given + interval elapsed + no respiratory reassessment → reassessment due.
- Likely discharge + missing instructions/Rx/follow-up/attending review → discharge blocker.
- Admit decision + no handoff/family update/bed request → admit blocker.
- Boarding + no active ED-provider task → muted operational delay.

Thresholds must be configurable by site, care area, chief complaint, and patient acuity.

## PEM-specific pathway opportunities

Prioritize pathways with frequent throughput delays and reassessment needs:

1. Abdominal pain/vomiting: labs, ultrasound/CT, serial exam, PO challenge, surgery consult, discharge criteria.
2. Respiratory distress/asthma/bronchiolitis: treatment response, oxygen/HFNC, feeding, reassessment intervals, admit criteria.
3. Fever by age: age-based workup, cultures, antibiotics, LP decision, discharge/admit criteria.
4. Head injury: observation interval, CT status, neuro reassessment, PO challenge, concussion instructions.
5. Seizure: return to baseline, glucose/labs, neuro consult, rescue med plan, discharge safety.
6. Limp/refusal to walk: x-ray/labs/US, analgesia response, weight-bearing reassessment, ortho consult.

For each pathway, define:

- usual workup milestones,
- reassessment intervals,
- cannot-miss diagnoses,
- disposition readiness checklist,
- expected bottlenecks,
- escalation triggers.

## PHI, HIPAA, and security posture

### Minimum necessary display

Default list views should use the smallest useful identifiers:

- room,
- initials or first name/last initial if permitted,
- age,
- chief complaint,
- provider/team,
- operational state.

Avoid showing full name, MRN, DOB, full note text, or sensitive diagnoses unless necessary for the workflow and user is authorized.

### Authentication and authorization

- Use Epic/enterprise SSO where possible.
- Enforce role-based access.
- Tie roster visibility to care team, department, shift, or approved operational role.
- Avoid shared generic accounts.
- Support automatic session timeout and re-authentication.

### Audit logging

Audit:

- user login,
- patient/encounter viewed,
- imported data accessed,
- next action changed,
- snooze set/cleared,
- write-back attempted/succeeded/failed,
- export/download attempts,
- administrative configuration changes.

### Data storage minimization

To control risk and backend cost:

- store normalized operational state, not full chart replicas;
- keep raw FHIR payloads transient unless required for debugging and approved;
- short retention for active ED workflow data;
- longer retention only for de-identified/aggregated metrics;
- encrypt at rest and in transit;
- separate PHI data from analytics events;
- use tenant/site isolation if deployed across institutions.

### Production security controls

- TLS everywhere.
- Managed secrets vault.
- Strict CORS and CSP.
- No PHI in client-side logs.
- No PHI in analytics tools without a BAA and explicit approval.
- Server-side audit trail.
- Rate limiting and abuse detection.
- Backups and disaster recovery plan.
- Incident response plan.
- BAA with hosting and monitoring vendors if ePHI is stored or processed.

## Cost-conscious backend architecture

Recommended production architecture:

- Static frontend on a low-cost CDN.
- Small API backend for auth/session/normalization.
- Managed relational database for active operational state.
- Event queue for Epic/HL7/FHIR event ingestion.
- Redis or managed cache for live roster snapshots if needed.
- Object storage only for non-PHI artifacts or tightly controlled logs.
- De-identified metrics warehouse separated from operational PHI.

Avoid expensive early decisions:

- Do not store full FHIR bundles long-term by default.
- Do not run LLM processing on PHI until governance, BAA, and audit requirements are settled.
- Do not use screenshot scraping of Epic.
- Do not make manual comments the primary integration plan.

## Adoption strategy

The product will be adopted if it makes a busy attending faster within the first shift.

### Pilot success criteria

- Decreased time from final result to provider reassessment.
- Decreased time from likely discharge to discharge completion.
- Increased percentage of patients with documented next action.
- Fewer patients idle beyond reassessment threshold.
- Improved sign-out/list-running clarity.
- Positive provider perception: “I know what needs me now.”

### MVP demo script

1. Team starts shift with roster loaded.
2. Attending runs list by room.
3. Each patient receives a next action and owner.
4. Lab/imaging events update patients automatically.
5. Attention queue surfaces patients needing action.
6. Provider snoozes expected delays.
7. Dispo-ready patients rise to top.
8. End-of-shift handoff shows unresolved blockers.

## Immediate product next steps

1. Replace free-text demo parsing with a richer patient-flow prototype: roster, cards, next action, owner, blocker, timers, snooze, dispo target.
2. Add a desktop running-the-list view and mobile needs-me view.
3. Define the normalized patient flow state model before adding more UI.
4. Document Epic integration discovery questions and map each desired feature to possible FHIR/HL7/Interconnect sources.
5. Build a mock event simulator for labs resulted, imaging final, med administered, and bed assigned events.
6. Add de-identified metrics calculation for dead-time intervals.
7. Prepare a security and HIPAA architecture brief for institutional review.

## North star

PREtendingMD should make it easy for a pediatric ED attending to look at the department and immediately know:

- who is new,
- who is waiting,
- who is ready,
- who is stuck,
- who owns the next step,
- and what action will move each child safely toward disposition.
