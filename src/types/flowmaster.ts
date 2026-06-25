export type AgeUnit = 'days' | 'months' | 'years';
export type Appearance = 'well' | 'ill' | 'toxic' | 'unstable';
export type Acuity = 'routine' | 'urgent' | 'emergent' | 'critical';
export type NodeType = 'decision' | 'checkpoint' | 'result' | 'disposition' | 'terminal';

export type PatientContext = {
  complaint: string;
  age: number;
  unit: AgeUnit;
  weightKg?: number;
  appearance: Appearance;
  temperatureC?: number;
  heartRate?: number;
  respiratoryRate?: number;
  systolicBp?: number;
  spo2?: number;
  notes: string;
};

export type PathwayOption = {
  label: string;
  next: string;
  flags?: string[];
  actions?: string[];
  requireAttendingNotification?: boolean;
};

export type PathwayNode = {
  id: string;
  type: NodeType;
  title: string;
  prompt: string;
  actions?: string[];
  cantMiss?: string[];
  reassess?: string[];
  dispositionCriteria?: string[];
  options?: PathwayOption[];
};

export type Pathway = {
  id: string;
  title: string;
  version: string;
  chiefComplaints: string[];
  tags: string[];
  acuity: Acuity;
  warning: string;
  startNodeId: string;
  nodes: Record<string, PathwayNode>;
};

export type DecisionStep = {
  pathwayId: string;
  nodeId: string;
  nodeTitle: string;
  answer: string;
  nextNodeId: string;
  at: string;
  flags: string[];
  actions: string[];
};

export type EngineSnapshot = {
  ageBand: string;
  activeActions: string[];
  activeFlags: string[];
  cantMiss: string[];
  attendingTriggers: string[];
};

export type PatientFlowState = {
  source: 'pathway-decision' | 'epic-event' | 'manual-update';
  pathwayId?: string;
  pathwayTitle?: string;
  currentNodeId?: string;
  currentNodeTitle?: string;
  lastDecisionLabel?: string;
  recommendedNextAction: string;
  cantMissDiagnoses: string[];
  reassessmentCheckpoints: string[];
  dispositionReadinessItems: string[];
  warningUrgencyFlags: string[];
  updatedAt: string;
};
