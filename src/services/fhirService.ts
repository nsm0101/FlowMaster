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

export class FhirService {
  private static baseUrl = "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4";

  static async fetchPatientData(authData: EpicAuthData): Promise<Partial<Patient>> {
    const { access_token, patient: patientId } = authData;
    
    console.log(`[AUDIT] FHIR Data Access: Patient ${patientId} fetched by user at ${new Date().toISOString()}`);
    
    // 1. Fetch Patient Resource (Name, Age, Sex)
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
    let room = "?";
    try {
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
    } catch (e) { console.warn("Could not fetch room info"); }

    // Map FHIR to PEM FlowMaster Patient type
    const name = patientResource.name?.[0];
    const firstName = name?.given?.[0] || 'Unknown';
    const lastNameInitial = name?.family ? `${name.family[0]}.` : '';
    const initials = `${firstName} ${lastNameInitial}`.trim();

    // Calculate Age
    const birthDate = new Date(patientResource.birthDate);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    return {
      initials,
      age: age.toString(),
      sex: patientResource.gender === 'male' ? 'M' : (patientResource.gender === 'female' ? 'F' : 'Other'),
      room,
      chiefComplaint: "Epic Import",
      status: 'New' as PatientStatus,
      fellowSeen: false,
      attendingSeen: false,
      assignedTeam: [],
      epicId: patientId,
      epicToken: access_token,
      tasks: { labs: 'off', imaging: 'off', meds: 'off', consult: 'off' },
      dischargeTasks: { instructions: 'off', rx: 'off', followUp: 'off', notes: 'off' },
      workflowFlags: {
        readyForAttending: false,
        familyUpdated: false,
        awaitingDispo: false,
        readyForDischargePaperwork: false,
        boarding: false
      },
      operationalNotes: `Imported from Epic on ${new Date().toLocaleString()}. FHIR ID: ${patientId}`,
      lastAssessmentAt: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
  }

  static async updatePatientStatus(patient: Patient, newStatus: string): Promise<void> {
    if (!patient.epicId || !patient.epicToken) return;

    console.log(`[AUDIT] FHIR Data Update: Patient ${patient.epicId} status changed to ${newStatus} at ${new Date().toISOString()}`);

    const communication = {
      resourceType: "Communication",
      status: "completed",
      category: [{
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/communication-category",
          code: "notification"
        }],
        text: "App Status Update"
      }],
      subject: { reference: `Patient/${patient.epicId}` },
      sent: new Date().toISOString(),
      payload: [{
        contentString: `PEM FlowMaster Status Update: Patient status set to [${newStatus}]`
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
      console.error(`Failed to sync status to Epic: ${response.statusText}`);
    } else {
      console.log(`Successfully synced status [${newStatus}] to Epic for Patient ${patient.epicId}`);
    }
  }
}
