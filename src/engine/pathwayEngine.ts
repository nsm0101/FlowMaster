import type { DecisionStep, EngineSnapshot, Pathway, PathwayNode, PatientContext } from '../types/flowmaster';

export const getAgeInDays = (patient: PatientContext) => {
  if (patient.unit === 'days') return patient.age;
  if (patient.unit === 'weeks') return patient.age * 7;
  if (patient.unit === 'months') return patient.age * 30.4;
  return patient.age * 365;
};

export const getAgeBand = (patient: PatientContext) => {
  const days = getAgeInDays(patient);
  const months = patient.unit === 'years'
    ? patient.age * 12
    : patient.unit === 'months'
      ? patient.age
      : patient.unit === 'weeks'
        ? (patient.age * 7) / 30.4
        : patient.age / 30.4;
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

export type TimerLevel = 'normal' | 'due' | 'overdue' | 'snoozed';

export type TimerStateInput = {
  lastAssessmentAtMs: number;
  nowMs?: number;
  dueAfterMinutes?: number;
  overdueAfterMinutes?: number;
  snoozedUntilMs?: number;
};

export type TimerState = {
  elapsedMinutes: number;
  level: TimerLevel;
  isDue: boolean;
  isOverdue: boolean;
  isSnoozed: boolean;
  remainingSnoozeMinutes: number;
};

export const getTimerState = ({
  lastAssessmentAtMs,
  nowMs = Date.now(),
  dueAfterMinutes = 90,
  overdueAfterMinutes = 180,
  snoozedUntilMs
}: TimerStateInput): TimerState => {
  const elapsedMinutes = Math.max(0, Math.floor((nowMs - lastAssessmentAtMs) / 60000));
  const remainingSnoozeMinutes = snoozedUntilMs && snoozedUntilMs > nowMs ? Math.ceil((snoozedUntilMs - nowMs) / 60000) : 0;
  const isSnoozed = remainingSnoozeMinutes > 0;
  const isOverdue = elapsedMinutes >= overdueAfterMinutes;
  const isDue = elapsedMinutes >= dueAfterMinutes;

  return {
    elapsedMinutes,
    level: isSnoozed ? 'snoozed' : isOverdue ? 'overdue' : isDue ? 'due' : 'normal',
    isDue,
    isOverdue,
    isSnoozed,
    remainingSnoozeMinutes
  };
};

export type AttentionQueuePatient = {
  id: string;
  status: string;
  lastAssessmentAtMs: number;
  createdAtMs: number;
  isPinned?: boolean;
  isCompleted?: boolean;
  workflowFlags?: Partial<Record<'readyForAttending' | 'awaitingDispo' | 'boarding' | 'familyUpdated' | 'readyForDischargePaperwork', boolean>>;
  snoozedUntilMs?: number;
};

export type RankedAttentionPatient<T extends AttentionQueuePatient = AttentionQueuePatient> = {
  patient: T;
  score: number;
  reasons: string[];
  timer: TimerState;
};

export const rankAttentionQueue = <T extends AttentionQueuePatient>(patients: T[], nowMs = Date.now()): RankedAttentionPatient<T>[] => {
  return patients
    .map((patient) => {
      const timer = getTimerState({ lastAssessmentAtMs: patient.lastAssessmentAtMs, nowMs, snoozedUntilMs: patient.snoozedUntilMs });
      const reasons: string[] = [];
      let score = 0;

      if (patient.isCompleted) {
        score -= 1000;
        reasons.push('completed');
      }
      if (patient.isPinned) {
        score += 100;
        reasons.push('pinned');
      }
      if (patient.status === 'New') {
        score += 80;
        reasons.push('new patient');
      }
      if (patient.workflowFlags?.readyForAttending) {
        score += 70;
        reasons.push('ready for attending');
      }
      if (patient.workflowFlags?.awaitingDispo) {
        score += 45;
        reasons.push('awaiting disposition');
      }
      if (patient.workflowFlags?.boarding) {
        score += 30;
        reasons.push('boarding');
      }
      if (timer.isOverdue) {
        score += 60;
        reasons.push('assessment timer overdue');
      } else if (timer.isDue) {
        score += 35;
        reasons.push('assessment timer due');
      }
      if (timer.isSnoozed) {
        score -= 50;
        reasons.push('snoozed');
      }

      return { patient, score, reasons, timer };
    })
    .sort((a, b) => {
      if (a.patient.isCompleted !== b.patient.isCompleted) return a.patient.isCompleted ? 1 : -1;
      if (b.score !== a.score) return b.score - a.score;
      if (a.patient.lastAssessmentAtMs !== b.patient.lastAssessmentAtMs) return a.patient.lastAssessmentAtMs - b.patient.lastAssessmentAtMs;
      return b.patient.createdAtMs - a.patient.createdAtMs;
    });
};
