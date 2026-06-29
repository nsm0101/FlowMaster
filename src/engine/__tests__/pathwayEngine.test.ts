import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getAgeBand,
  getTimerState,
  matchPathways,
  rankAttentionQueue,
  type AttentionQueuePatient
} from '../pathwayEngine';
import type { Pathway, PatientContext } from '../../types/flowmaster';

const patient = (age: number, unit: PatientContext['unit']): PatientContext => ({
  complaint: 'fever',
  age,
  unit,
  gender: 'male',
  appearance: 'well',
  notes: ''
});

const pathway = (id: string, overrides: Partial<Pathway> = {}): Pathway => ({
  id,
  title: id,
  version: 'test',
  chiefComplaints: [],
  tags: [],
  acuity: 'routine',
  warning: '',
  startNodeId: 'start',
  nodes: {
    start: {
      id: 'start',
      type: 'decision',
      title: 'Start',
      prompt: 'Start'
    }
  },
  ...overrides
});

describe('age-band and pathway matching', () => {
  it('keeps MVP age-band boundaries explicit', () => {
    assert.equal(getAgeBand(patient(28, 'days')), '0–28 days');
    assert.equal(getAgeBand(patient(29, 'days')), '29–60 days');
    assert.equal(getAgeBand(patient(61, 'days')), '61–90 days');
    assert.equal(getAgeBand(patient(4, 'months')), '3–36 months');
    assert.equal(getAgeBand(patient(4, 'years')), 'child');
    assert.equal(getAgeBand(patient(12, 'years')), 'adolescent');
  });

  it('matches pathways by complaint, tag, or title and returns all pathways for blank input', () => {
    const pathways = [
      pathway('fever', { title: 'Fever by age', chiefComplaints: ['fever'], tags: ['infant'] }),
      pathway('respiratory', { title: 'Respiratory distress', chiefComplaints: ['shortness of breath'], tags: ['wheeze'] })
    ];

    assert.deepEqual(matchPathways(pathways, '').map((item) => item.id), ['fever', 'respiratory']);
    assert.deepEqual(matchPathways(pathways, 'febrile infant').map((item) => item.id), ['fever']);
    assert.deepEqual(matchPathways(pathways, 'wheeze').map((item) => item.id), ['respiratory']);
    assert.deepEqual(matchPathways(pathways, 'respiratory').map((item) => item.id), ['respiratory']);
  });
});

describe('attention queue ranking', () => {
  const basePatient = (overrides: Partial<AttentionQueuePatient>): AttentionQueuePatient => ({
    id: 'base',
    status: 'Work-up',
    lastAssessmentAtMs: 0,
    createdAtMs: 0,
    workflowFlags: {},
    ...overrides
  });

  it('prioritizes active high-risk and stale patients while leaving completed patients last', () => {
    const ranked = rankAttentionQueue([
      basePatient({ id: 'routine', lastAssessmentAtMs: 50 }),
      basePatient({ id: 'attending', workflowFlags: { readyForAttending: true }, lastAssessmentAtMs: 20 }),
      basePatient({ id: 'stale', lastAssessmentAtMs: 1 }),
      basePatient({ id: 'completed', isCompleted: true, status: 'New', workflowFlags: { readyForAttending: true }, lastAssessmentAtMs: 0 })
    ], 200 * 60 * 1000);

    assert.deepEqual(ranked.map((item) => item.patient.id), ['attending', 'stale', 'routine', 'completed']);
    assert.ok(ranked[0].reasons.includes('ready for attending'));
    assert.ok(ranked[1].reasons.includes('assessment timer overdue'));
  });
});

describe('timer and snooze logic', () => {
  it('reports normal, due, overdue, and snoozed timer states', () => {
    assert.equal(getTimerState({ lastAssessmentAtMs: 0, nowMs: 30 * 60 * 1000 }).level, 'normal');
    assert.equal(getTimerState({ lastAssessmentAtMs: 0, nowMs: 95 * 60 * 1000 }).level, 'due');
    assert.equal(getTimerState({ lastAssessmentAtMs: 0, nowMs: 181 * 60 * 1000 }).level, 'overdue');

    const snoozed = getTimerState({
      lastAssessmentAtMs: 0,
      nowMs: 181 * 60 * 1000,
      snoozedUntilMs: 190 * 60 * 1000
    });
    assert.equal(snoozed.level, 'snoozed');
    assert.equal(snoozed.isSnoozed, true);
  });
});
