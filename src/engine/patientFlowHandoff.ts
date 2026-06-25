import type { DecisionStep, Pathway, PathwayNode, PatientFlowState } from '../types/flowmaster';

const unique = (items: string[]) => Array.from(new Set(items.filter(Boolean)));

const firstOrFallback = (items: string[] | undefined, fallback: string) => items?.find(Boolean) ?? fallback;

export const createPatientFlowState = (
  pathway: Pathway,
  currentNode: PathwayNode,
  history: DecisionStep[]
): PatientFlowState => {
  const historicalNodes = history.map((step) => pathway.nodes[step.nodeId]).filter(Boolean);
  const historicalActions = history.flatMap((step) => step.actions);
  const currentActions = currentNode.actions ?? [];
  const warningUrgencyFlags = unique(history.flatMap((step) => step.flags));
  const cantMissDiagnoses = unique([
    ...(currentNode.cantMiss ?? []),
    ...historicalNodes.flatMap((node) => node.cantMiss ?? []),
  ]);
  const reassessmentCheckpoints = unique([
    ...(currentNode.reassess ?? []),
    ...historicalNodes.flatMap((node) => node.reassess ?? []),
  ]);
  const dispositionReadinessItems = unique([
    ...(currentNode.dispositionCriteria ?? []),
    ...historicalNodes.flatMap((node) => node.dispositionCriteria ?? []),
  ]);

  return {
    source: 'pathway',
    pathwayId: pathway.id,
    pathwayTitle: pathway.title,
    currentNodeId: currentNode.id,
    currentNodeTitle: currentNode.title,
    recommendedNextAction: firstOrFallback(
      [...currentActions, ...historicalActions],
      currentNode.prompt || 'Continue pathway-guided assessment'
    ),
    cantMissDiagnoses,
    reassessmentCheckpoints,
    dispositionReadinessItems,
    warningUrgencyFlags,
    updatedAt: new Date().toISOString(),
  };
};
