/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  where, 
  Timestamp, 
  setDoc,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { Patient, TeamMember, MedCommCall, Shift } from './types';
import { Layout } from './components/Layout';
import { Login } from './components/Login';
import { PatientBoard } from './components/PatientBoard';
import { MedCommList } from './components/MedCommList';
import { MedCommForm } from './components/MedCommForm';
import { TeamSetup } from './components/TeamSetup';
import { ShiftSelector } from './components/ShiftSelector';
import { Settings } from './components/Settings';
import { Plus, Loader2, AlertCircle } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'board' | 'medcomm' | 'team' | 'settings'>('board');
  
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [activeShiftId, setActiveShiftId] = useState<string | null>(localStorage.getItem('activeShiftId'));
  
  const [patients, setPatients] = useState<Patient[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [medCommCalls, setMedCommCalls] = useState<MedCommCall[]>([]);
  
  const [showMedCommForm, setShowMedCommForm] = useState(false);
  const [editingMedCommCall, setEditingMedCommCall] = useState<MedCommCall | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [colorBlindMode, setColorBlindMode] = useState<boolean>(localStorage.getItem('colorBlindMode') === 'true');
  const [compactMode, setCompactMode] = useState<boolean>(localStorage.getItem('compactMode') === 'true');
  const [twoColumnMode, setTwoColumnMode] = useState<boolean>(localStorage.getItem('twoColumnMode') === 'true');

  useEffect(() => {
    localStorage.setItem('colorBlindMode', colorBlindMode.toString());
  }, [colorBlindMode]);

  useEffect(() => {
    localStorage.setItem('compactMode', compactMode.toString());
  }, [compactMode]);

  useEffect(() => {
    localStorage.setItem('twoColumnMode', twoColumnMode.toString());
  }, [twoColumnMode]);

  // Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Shifts Listener
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'shifts'), orderBy('startTime', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const s = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shift));
      setShifts(s);
      if (!activeShiftId && s.length > 0) {
        setActiveShiftId(s[0].id);
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Active Shift Data Listeners
  useEffect(() => {
    if (!user || !activeShiftId) {
      setPatients([]);
      setTeamMembers([]);
      setMedCommCalls([]);
      return;
    }

    localStorage.setItem('activeShiftId', activeShiftId);

    const unsubPatients = onSnapshot(collection(db, `shifts/${activeShiftId}/patients`), (snapshot) => {
      setPatients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)));
    });

    const unsubTeam = onSnapshot(collection(db, `shifts/${activeShiftId}/teamMembers`), (snapshot) => {
      setTeamMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamMember)));
    });

    const unsubMedComm = onSnapshot(collection(db, `shifts/${activeShiftId}/medCommCalls`), (snapshot) => {
      setMedCommCalls(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MedCommCall)));
    });

    return () => {
      unsubPatients();
      unsubTeam();
      unsubMedComm();
    };
  }, [user, activeShiftId]);

  const handleLogout = () => signOut(auth);

  const createShift = async (name: string) => {
    if (!user) return;
    const newShift = {
      name,
      startTime: Timestamp.now(),
      isActive: true,
      createdBy: user.uid
    };
    const docRef = await addDoc(collection(db, 'shifts'), newShift);
    setActiveShiftId(docRef.id);
  };

  const addPatient = async () => {
    if (!activeShiftId) return;
    const newPatient: Partial<Patient> = {
      initials: 'NEW',
      age: '0',
      sex: 'M',
      room: '?',
      chiefComplaint: 'New Patient',
      status: 'New',
      seenState: 'To Be Seen',
      assignedTeam: [],
      tasks: { labs: 'off', imaging: 'off', meds: 'off', consult: 'off' },
      dischargeTasks: { instructions: 'off', rx: 'off', followUp: 'off', notes: 'off' },
      workflowFlags: {
        readyForAttending: false,
        familyUpdated: false,
        awaitingDispo: false,
        readyForDischargePaperwork: false,
        boarding: false
      },
      operationalNotes: '',
      lastAssessmentAt: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    await addDoc(collection(db, `shifts/${activeShiftId}/patients`), newPatient);
  };

  const updatePatient = async (id: string, updates: Partial<Patient>) => {
    if (!activeShiftId) return;
    await updateDoc(doc(db, `shifts/${activeShiftId}/patients`, id), {
      ...updates,
      updatedAt: Timestamp.now()
    });
  };

  const deletePatient = async (id: string) => {
    if (!activeShiftId) return;
    await deleteDoc(doc(db, `shifts/${activeShiftId}/patients`, id));
  };

  const completePatient = async (id: string) => {
    if (!activeShiftId) return;
    const patient = patients.find(p => p.id === id);
    if (!patient) return;
    
    await updateDoc(doc(db, `shifts/${activeShiftId}/patients`, id), {
      isCompleted: !patient.isCompleted,
      updatedAt: Timestamp.now()
    });
  };

  const resetPatientTimer = async (id: string) => {
    if (!activeShiftId) return;
    await updateDoc(doc(db, `shifts/${activeShiftId}/patients`, id), {
      lastAssessmentAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
  };

  const addTeamMember = async (member: Partial<TeamMember>) => {
    if (!activeShiftId) return;
    await addDoc(collection(db, `shifts/${activeShiftId}/teamMembers`), member);
  };

  const removeTeamMember = async (id: string) => {
    if (!activeShiftId) return;
    await deleteDoc(doc(db, `shifts/${activeShiftId}/teamMembers`, id));
  };

  const addMedCommCall = async (call: Partial<MedCommCall>) => {
    if (!activeShiftId) return;
    await addDoc(collection(db, `shifts/${activeShiftId}/medCommCalls`), {
      ...call,
      callTime: Timestamp.now(),
      createdAt: Timestamp.now()
    });
    setShowMedCommForm(false);
  };

  const updateMedCommCall = async (id: string, updates: Partial<MedCommCall>) => {
    if (!activeShiftId) return;
    await updateDoc(doc(db, `shifts/${activeShiftId}/medCommCalls`, id), {
      ...updates,
      updatedAt: Timestamp.now()
    });
  };

  const updateMedCommStatus = async (id: string, status: MedCommCall['status']) => {
    if (!activeShiftId) return;
    await updateDoc(doc(db, `shifts/${activeShiftId}/medCommCalls`, id), { status });
  };

  const deleteMedCommCall = async (id: string) => {
    if (!activeShiftId) return;
    await deleteDoc(doc(db, `shifts/${activeShiftId}/medCommCalls`, id));
  };

  const convertToPatient = async (call: MedCommCall) => {
    if (!activeShiftId) return;
    const newPatient: Partial<Patient> = {
      initials: call.initials,
      age: call.age,
      room: 'TBD',
      chiefComplaint: call.chiefComplaint || 'MedComm Transfer',
      status: 'New',
      seenState: 'To Be Seen',
      assignedTeam: [],
      tasks: { labs: 'off', imaging: 'off', meds: 'off', consult: 'off' },
      dischargeTasks: { instructions: 'off', rx: 'off', followUp: 'off', notes: 'off' },
      workflowFlags: {
        readyForAttending: false,
        familyUpdated: false,
        awaitingDispo: false,
        readyForDischargePaperwork: false,
        boarding: false
      },
      operationalNotes: `MedComm: ${call.notes}${call.traumaActivation && call.traumaActivation !== 'none' ? ` | TRAUMA ${call.traumaActivation}` : ''}${call.consultantsToNotify ? ` | Notify: ${call.consultantsToNotify}` : ''}`,
      lastAssessmentAt: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    const patientRef = await addDoc(collection(db, `shifts/${activeShiftId}/patients`), newPatient);
    await updateDoc(doc(db, `shifts/${activeShiftId}/medCommCalls`, call.id), { 
      convertedToPatientId: patientRef.id,
      status: 'arrived'
    });
    setActiveTab('board');
  };

  const seedDemoData = async () => {
    if (!activeShiftId) return;
    setIsActionLoading(true);
    try {
      const batch = writeBatch(db);
      
      // Add Team Members
      const team = [
        { firstName: 'Sarah', lastName: 'Miller', initials: 'SM', role: 'attending' },
        { firstName: 'James', lastName: 'Chen', initials: 'JC', role: 'fellow' },
        { firstName: 'Elena', lastName: 'Rodriguez', initials: 'ER', role: 'resident' },
        { firstName: 'Kevin', lastName: 'Park', initials: 'KP', role: 'student' }
      ];
      
      for (const m of team) {
        const ref = doc(collection(db, `shifts/${activeShiftId}/teamMembers`));
        batch.set(ref, m);
      }

      // Add Patients
      const patientsData = [
        { initials: 'JD', age: '4', room: '12', status: 'Work-up', seenState: 'Seen by Fellow', tasks: { labs: 'pending', imaging: 'ordered', meds: 'off', consult: 'off' } },
        { initials: 'MK', age: '12', room: '05', status: 'New', seenState: 'To Be Seen', tasks: { labs: 'off', imaging: 'off', meds: 'off', consult: 'off' } },
        { initials: 'RL', age: '8', room: '18', status: 'Likely Discharge', seenState: 'Seen by Attending', tasks: { labs: 'complete', imaging: 'complete', meds: 'complete', consult: 'off' } }
      ];

      for (const p of patientsData) {
        const ref = doc(collection(db, `shifts/${activeShiftId}/patients`));
        batch.set(ref, {
          ...p,
          assignedTeam: [],
          workflowFlags: { readyForAttending: false, familyUpdated: true, awaitingDispo: false, readyForDischargePaperwork: false, boarding: false },
          operationalNotes: 'Demo patient seeded.',
          lastAssessmentAt: Timestamp.now(),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      }

      await batch.commit();
    } finally {
      setIsActionLoading(false);
    }
  };

  const clearShiftData = async () => {
    if (!activeShiftId) return;
    setIsActionLoading(true);
    try {
      const collections = ['patients', 'teamMembers', 'medCommCalls'];
      for (const coll of collections) {
        const q = collection(db, `shifts/${activeShiftId}/${coll}`);
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <Loader2 size={48} className="text-blue-600 animate-spin" />
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Initializing Workflow...</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Layout 
      user={user} 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        {/* Shift Selector always visible at top of settings or if no shift active */}
        {(activeTab === 'settings' || !activeShiftId) && (
          <ShiftSelector 
            shifts={shifts} 
            activeShiftId={activeShiftId} 
            onSelect={setActiveShiftId} 
            onCreate={createShift} 
          />
        )}

        {!activeShiftId ? (
          <div className="py-20 text-center space-y-4">
            <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600 mx-auto">
              <Plus size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-gray-900 tracking-tight">No Active Shift</h3>
              <p className="text-sm text-gray-400 font-medium max-w-xs mx-auto">
                Create a new shift or select an existing one from the list above to start managing patients.
              </p>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'board' && (
              <PatientBoard 
                patients={patients} 
                teamMembers={teamMembers}
                onUpdatePatient={updatePatient}
                onDeletePatient={deletePatient}
                onCompletePatient={completePatient}
                onResetTimer={resetPatientTimer}
                onAddPatient={addPatient}
                colorBlindMode={colorBlindMode}
                compactMode={compactMode}
                twoColumnMode={twoColumnMode}
              />
            )}

            {activeTab === 'medcomm' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-gray-900 tracking-tight">MedComm Calls</h2>
                  <button 
                    onClick={() => {
                      setEditingMedCommCall(null);
                      setShowMedCommForm(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-md"
                  >
                    <Plus size={18} /> New Call
                  </button>
                </div>

                {showMedCommForm ? (
                  <MedCommForm 
                    initialData={editingMedCommCall || undefined}
                    onSubmit={async (callData) => {
                      if (editingMedCommCall) {
                        await updateMedCommCall(editingMedCommCall.id, callData);
                      } else {
                        await addMedCommCall(callData);
                      }
                      setShowMedCommForm(false);
                      setEditingMedCommCall(null);
                    }} 
                    onCancel={() => {
                      setShowMedCommForm(false);
                      setEditingMedCommCall(null);
                    }} 
                  />
                ) : (
                  <MedCommList 
                    calls={medCommCalls} 
                    onConvertToPatient={convertToPatient}
                    onUpdateStatus={updateMedCommStatus}
                    onDelete={deleteMedCommCall}
                    onEdit={(call) => {
                      setEditingMedCommCall(call);
                      setShowMedCommForm(true);
                    }}
                  />
                )}
              </div>
            )}

            {activeTab === 'team' && (
              <TeamSetup 
                teamMembers={teamMembers} 
                onAdd={addTeamMember} 
                onRemove={removeTeamMember} 
              />
            )}

            {activeTab === 'settings' && (
              <Settings 
                onSeedData={seedDemoData} 
                onClearData={clearShiftData} 
                isLoading={isActionLoading}
                colorBlindMode={colorBlindMode}
                onToggleColorBlindMode={setColorBlindMode}
                compactMode={compactMode}
                onToggleCompactMode={setCompactMode}
                twoColumnMode={twoColumnMode}
                onToggleTwoColumnMode={setTwoColumnMode}
                onLogout={handleLogout}
                user={user}
                teamMembers={teamMembers}
                onAddTeamMember={addTeamMember}
                onRemoveTeamMember={removeTeamMember}
                shifts={shifts}
                activeShiftId={activeShiftId}
                onSelectShift={setActiveShiftId}
                onCreateShift={createShift}
              />
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
