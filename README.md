# PEM FlowMaster

Pediatric Emergency Medicine clinical pathway navigator.

This is the separated development repository for PEM FlowMaster. Once stable, the production build can be embedded into the CloseDose repository under `public/flowmaster/` and served from `https://closedose.com/flowmaster`.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Starter pathways

- Fever by age
- Respiratory distress
- Abdominal pain / vomiting
- Seizure
- Head injury
- Limp / refusal to walk

## Product intent

PEM FlowMaster is intended to function as an ED-facing clinical pathway navigator: chief complaint + age/risk context → immediate danger screen → can’t-miss diagnoses → branch-specific workup → reassessment checkpoints → disposition readiness.
