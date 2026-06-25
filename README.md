# PEM FlowMaster

Pediatric Emergency Medicine clinical pathway navigator.

This is the separated development repository for PEM FlowMaster. Once stable, the production build can be embedded into the CloseDose repository under `public/flowmaster/` and served from `https://closedose.com/flowmaster`.

## Run locally

```bash
npm install
npm run dev
```

## Build and validation

```bash
npm run typecheck
npm test
npm run build
```

Keep automated validation lightweight while the manual MVP workflow stabilizes. Current coverage focuses on pathway matching, age-band boundaries, attention-queue ranking, and timer/snooze behavior.

## MVP smoke-test checklist

Use this checklist for quick manual confidence checks after pathway, queue, or timer changes:

- Start the app with `npm run dev` and confirm the patient board loads without console errors.
- Add a new patient with a chief complaint that should match a starter pathway, then confirm the expected pathway appears.
- Verify age boundaries by trying 28 days, 29 days, 61 days, 4 months, 4 years, and 12 years in the pathway context.
- Mark a patient as ready for attending and confirm they rise in the attention queue ahead of routine work-up patients.
- Reset a patient's assessment timer and confirm the visual timer returns to the normal state.
- Snooze or defer a timer-driven reminder, if enabled in the current MVP build, and confirm it does not outrank unsnoozed due patients.
- Toggle discharge/admit/observation task states and confirm no unrelated patient card state changes.

## Starter pathways

- Fever by age
- Respiratory distress
- Abdominal pain / vomiting
- Seizure
- Head injury
- Limp / refusal to walk

## Product intent

PEM FlowMaster is intended to function as an ED-facing clinical pathway navigator: chief complaint + age/risk context → immediate danger screen → can’t-miss diagnoses → branch-specific workup → reassessment checkpoints → disposition readiness.
