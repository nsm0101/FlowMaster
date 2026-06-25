import type { DecisionStep, EngineSnapshot, Pathway, PathwayNode, PatientContext } from '../types/flowmaster';

export const getAgeInDays = (patient: PatientContext) => {
  if (patient.unit === 'days') return patient.age;
  if (patient.unit === 'months') return patient.age * 30.4;
  return patient.age * 365;
};

export const getAgeBand = (patient: PatientContext) => {
  const days = getAgeInDays(patient);
  const months = patient.unit === 'years' ? patient.age * 12 : patient.unit === 'months' ? patient.age : patient.age / 30.4;
  if (days <= 28) return '0–28 days';
  if (days <= 60) return '29–60 days';
  if (days <= 90) return '61–90 days';
  if (months <= 36) return '3–36 months';
  if (months < 144) return 'child';
  return 'adolescent';
};

const unique = (items: string[]) => Array.from(new Set(items.filter(Boolean)));

export const getNode = (pathway: Pathway, nodeId: string): PathwayNode => {
  return pathway.nodes[nodeId] ?? pathway.nodes[pathway.startNodeId];
};

export const makeDecisionStep = (pathway: Pathway, node: PathwayNode, label: string, nextNodeId: string, flags: string[] = [], actions: string[] = []): DecisionStep => ({
  pathwayId: pathway.id,
  nodeId: node.id,
  nodeTitle: node.title,
  answer: label,
  nextNodeId,
  at: new Date().toLocaleTimeString(),
  flags,
  actions
});

export const createSnapshot = (pathway: Pathway, currentNode: PathwayNode, patient: PatientContext, history: DecisionStep[]): EngineSnapshot => {
  const activeActions = unique([...history.flatMap((step) => step.actions), ...(currentNode.actions ?? [])]);
  const activeFlags = unique(history.flatMap((step) => step.flags));
  const cantMiss = unique([...(currentNode.cantMiss ?? []), ...history.flatMap((step) => pathway.nodes[step.nodeId]?.cantMiss ?? [])]);
  const attendingTriggers = unique([
    patient.appearance === 'unstable' ? 'Unstable appearance' : '',
    patient.appearance === 'toxic' ? 'Toxic appearance' : '',
    patient.spo2 !== undefined && patient.spo2 < 92 ? 'Hypoxemia' : '',
    ...history.filter((step) => step.flags.length > 0).map((step) => `${step.nodeTitle}: ${step.flags.join(', ')}`)
  ]);

  return {
    ageBand: getAgeBand(patient),
    activeActions,
    activeFlags,
    cantMiss,
    attendingTriggers
  };
};

export const matchPathways = (pathways: Pathway[], complaint: string) => {
  const text = complaint.trim().toLowerCase();
  if (!text) return pathways;
  return pathways.filter((pathway) =>
    pathway.chiefComplaints.some((item) => item.toLowerCase().includes(text) || text.includes(item.toLowerCase())) ||
    pathway.tags.some((tag) => text.includes(tag.toLowerCase())) ||
    pathway.title.toLowerCase().includes(text)
  );
};
