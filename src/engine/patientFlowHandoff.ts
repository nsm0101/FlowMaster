import type { DecisionStep, Pathway, PathwayNode, PatientFlowState } from '../types/flowmaster';

const unique = (items: string[]) => Array.from(new Set(items.filter(Boolean)));
const firstOrFallback = (items: string[], fallback: string) => items.find(Boolean) ?? fallback;

const buildWarningFlags = (pathway: Pathway, history: DecisionStep[], currentNode: PathwayNode) => unique([
  pathway.warning,
  ...history.flatMap((step) => step.flags),
  ...(currentNode.type === 'terminal' ? [] : currentNode.options?.flatMap((option) => option.flags ?? []) ?? [])
]);

/**
 * Converts pathway decision outputs into the operational patient-flow model.
 *
 * This is intentionally a handoff layer: pathway nodes remain the clinical source of truth,
 * while this normalized state can later be updated by Epic events, manual workflow changes,
 * or other operational integrations without changing pathway logic.
 */
export const createPatientFlowState = (
  pathway: Pathway,
  currentNode: PathwayNode,
  history: DecisionStep[]
): PatientFlowState => {
  const lastDecision = history[history.length - 1];
  const accumulatedActions = unique([...history.flatMap((step) => step.actions), ...(currentNode.actions ?? [])]);
  const cantMissDiagnoses = unique([
    ...(currentNode.cantMiss ?? []),
    ...history.flatMap((step) => pathway.nodes[step.nodeId]?.cantMiss ?? [])
  ]);
  const reassessmentCheckpoints = unique(currentNode.reassess ?? []);
  const dispositionReadinessItems = unique(currentNode.dispositionCriteria ?? []);
  const warningUrgencyFlags = buildWarningFlags(pathway, history, currentNode);

  return {
    source: 'pathway-decision',
    pathwayId: pathway.id,
    pathwayTitle: pathway.title,
    currentNodeId: currentNode.id,
    currentNodeTitle: currentNode.title,
    lastDecisionLabel: lastDecision?.answer,
    recommendedNextAction: firstOrFallback(accumulatedActions, currentNode.prompt),
    cantMissDiagnoses,
    reassessmentCheckpoints,
    dispositionReadinessItems,
    warningUrgencyFlags,
    updatedAt: new Date().toISOString()
  };
};
