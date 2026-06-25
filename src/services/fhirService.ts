/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Patient, PatientStatus } from '../types';
import { Timestamp } from 'firebase/firestore';

export interface EpicAuthData {
  access_token: string;
  patient: string;
  scope: string;
  token_type: string;
  expires_in: number;
}

interface WriteBackOptions {
  confirmedByUser: boolean;
  actorId?: string;
  reason?: string;
}

type FhirAuditAction = 'read_patient' | 'read_encounter' | 'write_back_blocked' | 'write_back_attempted' | 'write_back_succeeded' | 'write_back_failed';

const DEFAULT_FHIR_BASE_URL = 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4';
const WRITE_SCOPE = 'patient/Communication.write';
const SAFE_WRITE_STATUSES = new Set<PatientStatus>([
  'New',
  'Staff',
  'Work-up',
  'ED Observation',
  'Likely Discharge',
  'Likely Admit',
  'Discharge',
  'Admit',
]);

const getClientEnv = (key: string): string | undefined => {
  const env = import.meta.env as Record<string, string | undefined>;
  return env[key];
};

const maskIdentifier = (identifier?: string): string => {
  if (!identifier) return 'unknown';
  return `...${identifier.slice(-4)}`;
};

const auditFhirEvent = (action: FhirAuditAction, details: Record<string, unknown>) => {
  // Do not log names, MRNs, DOB, note text, bearer tokens, or raw FHIR payloads.
  console.info(JSON.stringify({
    type: 'FHIR_AUDIT',
    action,
    at: new Date().toISOString(),
    ...details,
  }));
};

const hasScope = (authData: EpicAuthData, requiredScope: string): boolean =>
  authData.scope?.split(/\s+/).includes(requiredScope) ?? false;

export class FhirService {
  private static baseUrl = getClientEnv('VITE_EPIC_FHIR_BASE_URL') || DEFAULT_FHIR_BASE_URL;
  private static demoMode = getClientEnv('VITE_FHIR_INTEGRATION_MODE') !== 'production';
  private static writeBackEnabled = getClientEnv('VITE_FHIR_WRITE_BACK_ENABLED') === 'true';

  static async fetchPatientData(authData: EpicAuthData): Promise<Partial<Patient>> {
    const { access_token, patient: patientId } = authData;
    
    auditFhirEvent('read_patient', {
      patientRef: maskIdentifier(patientId),
      tokenHandling: this.demoMode ? 'demo_client_bearer_token' : 'production_server_session_expected',
    });
    
    // 1. Fetch Patient Resource (Name, Age, Sex). Keep the raw FHIR payload transient.
    const patientResponse = await fetch(`${this.baseUrl}/Patient/${patientId}`, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/fhir+json'
      }
    });

    if (!patientResponse.ok) {
      throw new Error(`Failed to fetch patient data: ${patientResponse.statusText}`);
    }

    const patientResource = await patientResponse.json();
    
    // 2. Fetch Active Encounter (Room Number)
    let room = '?';
    try {
      auditFhirEvent('read_encounter', { patientRef: maskIdentifier(patientId) });
      const encounterResponse = await fetch(`${this.baseUrl}/Encounter?patient=${patientId}&status=in-progress`, {
        headers: { 'Authorization': `Bearer ${access_token}`, 'Accept': 'application/fhir+json' }
      });
      if (encounterResponse.ok) {
        const encounterData = await encounterResponse.json();
        const latestEncounter = encounterData.entry?.[0]?.resource;
        if (latestEncounter?.location?.[0]?.location?.display) {
          room = latestEncounter.location[0].location.display;
        }
      }
    } catch (e) { console.warn('Could not fetch room info'); }

    // Map FHIR to PEM FlowMaster Patient type using minimum-necessary identifiers.
    const name = patientResource.name?.[0];
    const firstName = name?.given?.[0] || 'Unknown';
    const lastNameInitial = name?.family ? `${name.family[0]}.` : '';
    const initials = `${firstName} ${lastNameInitial}`.trim();

    // Calculate Age. Do not persist DOB by default.
    const birthDate = new Date(patientResource.birthDate);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    return {
      initials,
      age: Number.isFinite(age) ? age.toString() : 'Unknown',
      sex: patientResource.gender === 'male' ? 'M' : (patientResource.gender === 'female' ? 'F' : 'Other'),
      room,
      chiefComplaint: 'Epic Import',
      status: 'New' as PatientStatus,
      fellowSeen: false,
      attendingSeen: false,
      assignedTeam: [],
      epicId: patientId,
      // Demo mode only keeps the sandbox token on the patient object for current UI behavior.
      // Production must replace this with server-side encrypted token/session storage.
      epicToken: this.demoMode ? access_token : undefined,
      tasks: { labs: 'off', imaging: 'off', meds: 'off', consult: 'off' },
      dischargeTasks: { instructions: 'off', rx: 'off', followUp: 'off', notes: 'off' },
      workflowFlags: {
        readyForAttending: false,
        familyUpdated: false,
        awaitingDispo: false,
        readyForDischargePaperwork: false,
        boarding: false
      },
      operationalNotes: `Imported from Epic on ${new Date().toLocaleString()}. FHIR ID: ${maskIdentifier(patientId)}`,
      lastAssessmentAt: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
  }

  static async updatePatientStatus(patient: Patient, newStatus: string, options?: WriteBackOptions): Promise<void> {
    const patientRef = maskIdentifier(patient.epicId);
    const blocked = (reason: string) => {
      auditFhirEvent('write_back_blocked', { patientRef, status: newStatus, reason });
    };

    if (!this.writeBackEnabled) return blocked('FHIR_WRITE_BACK_ENABLED is not true');
    if (!options?.confirmedByUser) return blocked('missing explicit user confirmation');
    if (!options.actorId) return blocked('missing attributable actor');
    if (!patient.epicId || !patient.epicToken) return blocked('missing patient context or token');
    if (!SAFE_WRITE_STATUSES.has(newStatus as PatientStatus)) return blocked('unsupported status value');
    if (!hasScope({ access_token: patient.epicToken, patient: patient.epicId, scope: getClientEnv('VITE_SMART_ALLOWED_SCOPES') || '', token_type: 'Bearer', expires_in: 0 }, WRITE_SCOPE)) {
      return blocked(`missing ${WRITE_SCOPE} scope`);
    }

    auditFhirEvent('write_back_attempted', {
      patientRef,
      status: newStatus,
      actorId: options.actorId,
      reason: options.reason || 'status_update',
    });

    const communication = {
      resourceType: 'Communication',
      status: 'completed',
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/communication-category',
          code: 'notification'
        }],
        text: 'PEM FlowMaster workflow update'
      }],
      subject: { reference: `Patient/${patient.epicId}` },
      sent: new Date().toISOString(),
      payload: [{
        // No patient name, MRN, DOB, free text note, or other PHI in the payload by default.
        contentString: `PEM FlowMaster workflow status changed to ${newStatus}.`
      }]
    };

    const response = await fetch(`${this.baseUrl}/Communication`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${patient.epicToken}`,
        'Content-Type': 'application/fhir+json',
        'Accept': 'application/fhir+json'
      },
      body: JSON.stringify(communication)
    });

    if (!response.ok) {
      auditFhirEvent('write_back_failed', { patientRef, status: newStatus, httpStatus: response.status });
      console.error(`Failed to sync status to Epic: ${response.statusText}`);
    } else {
      auditFhirEvent('write_back_succeeded', { patientRef, status: newStatus });
      console.log(`Successfully synced status [${newStatus}] to Epic for Patient ${patientRef}`);
    }
  }
}
