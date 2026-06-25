import type { DecisionStep, Pathway, PathwayNode } from '../types/flowmaster';

export type PatientFlowSource = 'pathway-decision' | 'epic-event' | 'manual-update';

export type PatientFlowField<T> = {
  value: T;
  source: PatientFlowSource;
  updatedAt: string;
};

export type PatientFlowState = {
  patientId?: string;
  pathwayId?: string;
  pathwayTitle?: string;
  currentNodeId?: string;
  currentNodeTitle?: string;
  lastDecisionLabel?: string;
  recommendedNextAction: PatientFlowField<string>;
  cantMissDiagnoses: PatientFlowField<string[]>;
  reassessmentCheckpoint: PatientFlowField<string[]>;
  dispositionReadinessItem: PatientFlowField<string[]>;
  warningUrgencyFlag: PatientFlowField<string[]>;
};

export type PatientFlowPatch = Partial<Pick<PatientFlowState,
  'patientId' |
  'pathwayId' |
  'pathwayTitle' |
  'currentNodeId' |
  'currentNodeTitle' |
  'lastDecisionLabel' |
  'recommendedNextAction' |
  'cantMissDiagnoses' |
  'reassessmentCheckpoint' |
  'dispositionReadinessItem' |
  'warningUrgencyFlag'
>>;

const unique = (items: string[]) => Array.from(new Set(items.filter(Boolean)));

const asField = <T>(value: T, source: PatientFlowSource, updatedAt: string): PatientFlowField<T> => ({
  value,
  source,
  updatedAt
});

const firstOrFallback = (items: string[], fallback: string) => items.find(Boolean) ?? fallback;

const warningFlagsFor = (pathway: Pathway, history: DecisionStep[], currentNode: PathwayNode) => unique([
  pathway.warning,
  ...history.flatMap((step) => step.flags),
  ...(currentNode.options?.flatMap((option) => option.flags ?? []) ?? [])
]);

/**
 * Maps pathway decision outputs into the operational patient-flow model.
 * Pathway nodes stay clinical; this state is the operational handoff surface that
 * Epic events or manual workflow updates can patch later without editing pathways.
 */
export const patientFlowFromPathwayDecision = (
  pathway: Pathway,
  currentNode: PathwayNode,
  history: DecisionStep[],
  updatedAt = new Date().toISOString()
): PatientFlowState => {
  const lastDecision = history[history.length - 1];
  const actions = unique([...history.flatMap((step) => step.actions), ...(currentNode.actions ?? [])]);
  const cantMiss = unique([
    ...(currentNode.cantMiss ?? []),
    ...history.flatMap((step) => pathway.nodes[step.nodeId]?.cantMiss ?? [])
  ]);

  return {
    pathwayId: pathway.id,
    pathwayTitle: pathway.title,
    currentNodeId: currentNode.id,
    currentNodeTitle: currentNode.title,
    lastDecisionLabel: lastDecision?.answer,
    recommendedNextAction: asField(firstOrFallback(actions, currentNode.prompt), 'pathway-decision', updatedAt),
    cantMissDiagnoses: asField(cantMiss, 'pathway-decision', updatedAt),
    reassessmentCheckpoint: asField(unique(currentNode.reassess ?? []), 'pathway-decision', updatedAt),
    dispositionReadinessItem: asField(unique(currentNode.dispositionCriteria ?? []), 'pathway-decision', updatedAt),
    warningUrgencyFlag: asField(warningFlagsFor(pathway, history, currentNode), 'pathway-decision', updatedAt)
  };
};

export const updatePatientFlowState = (current: PatientFlowState, patch: PatientFlowPatch): PatientFlowState => ({
  ...current,
  ...patch
});
