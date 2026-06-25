export type AgeUnit = 'days' | 'months' | 'years';
export type Appearance = 'well' | 'ill' | 'toxic' | 'unstable';
export type Acuity = 'routine' | 'urgent' | 'emergent' | 'critical';
export type NodeType = 'decision' | 'checkpoint' | 'result' | 'disposition' | 'terminal';

export type SourceLabel = 'manual' | 'pathway' | 'epic-event' | 'trackboard-comment' | 'inference';

export type SourceConfidence = 'confirmed' | 'likely' | 'needs-review';

export type PatientIdentity = {
  patientId: string;
  encounterId: string;
  initials: string;
  mrnHash?: string;
  epicPatientId?: string;
  epicEncounterId?: string;
};

export type EncounterIdentity = {
  encounterId: string;
  arrivalAt?: string;
  careArea?: string;
  trackingStatus?: string;
  locationSource?: SourceLabel;
};

export type PatientAge = {
  value: number;
  unit: AgeUnit;
  label?: string;
};

export type FlowStatus =
  | 'new'
  | 'active'
  | 'waiting'
  | 'needs-provider'
  | 'dispo-ready'
  | 'boarding'
  | 'closed';

export type FlowPhase =
  | 'new'
  | 'initial-assessment'
  | 'workup-treatment'
  | 'reassessment-due'
  | 'disposition-planning'
  | 'dispo-ready'
  | 'boarding'
  | 'closed';

export type OwnerRole = 'attending' | 'resident' | 'fellow' | 'nurse' | 'consultant' | 'system' | 'unknown';

export type FlowOwner = {
  role: OwnerRole;
  id?: string;
  displayName?: string;
  teamId?: string;
  source: SourceLabel;
};

export type FlowBlockerType =
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

export type FlowBlocker = {
  type: FlowBlockerType;
  label: string;
  startedAt?: string;
  owner?: FlowOwner;
  source: SourceLabel;
  confidence: SourceConfidence;
};

export type DispositionTarget =
  | 'undecided'
  | 'discharge'
  | 'admit'
  | 'ed-observation'
  | 'transfer'
  | 'left-before-complete'
  | 'not-applicable';

export type ExpectedDelay = {
  reason: string;
  expiresAt: string;
  source: SourceLabel;
  createdAt?: string;
  createdBy?: FlowOwner;
};

export type ReviewTimestamps = {
  lastProviderReviewAt?: string;
  lastReassessmentAt?: string;
  nextReassessmentDueAt?: string;
  lastResultedEventAt?: string;
  lastPlanUpdatedAt?: string;
};

export type NextAction = {
  label: string;
  ownerRole: OwnerRole;
  owner?: FlowOwner;
  dueAt?: string;
  source: SourceLabel;
  confidence: SourceConfidence;
  snoozedUntil?: string;
  snoozeReason?: string;
};

export type NormalizedPatientFlowState = {
  identity: PatientIdentity;
  encounter: EncounterIdentity;
  room: string;
  chiefComplaint: string;
  age: PatientAge;
  acuity: Acuity;
  status: FlowStatus;
  phase: FlowPhase;
  nextAction?: NextAction;
  owner?: FlowOwner;
  blocker?: FlowBlocker;
  dispositionTarget: DispositionTarget;
  review: ReviewTimestamps;
  expectedDelay?: ExpectedDelay;
  sourceLabels: SourceLabel[];
  updatedAt: string;
};

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
