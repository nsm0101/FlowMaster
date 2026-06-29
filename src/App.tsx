/**
 * PEM FlowMaster - Pediatric Emergency Medicine Clinical Pathway Navigator
 * 
 * NOTE FOR NATIVE BUILD (iOS/Android):
 * If copying this code to a React Native / Expo project:
 * 1. Change the Lucide icon import from 'lucide-react' to 'lucide-react-native'.
 * 2. Install 'react-native-svg' and 'lucide-react-native' in your Expo project.
 * 3. The logic and layout structure will run natively out-of-the-box.
 */

import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  useWindowDimensions,
  SafeAreaView,
  Platform,
  StatusBar
} from 'react-native';
import {
  Search,
  AlertTriangle,
  ArrowLeft,
  RefreshCcw,
  BookOpen,
  Clock,
  Activity,
  CheckCircle,
  FileText,
  ShieldAlert,
  Heart,
  ChevronRight,
  User,
  Plus,
  Info,
  Layers,
  Map,
  Compass,
  FileSearch,
  CheckSquare,
  Sparkles,
  Stethoscope,
  Laptop,
  Smartphone
} from 'lucide-react';
import { getPathwayById, pathwayRegistry } from './pathways';
import { createSnapshot, getNode, makeDecisionStep, matchPathways } from './engine/pathwayEngine';
import { createPatientFlowState } from './engine/patientFlowHandoff';
import type { DecisionStep, PathwayNode, Pathway, PatientContext } from './types/flowmaster';

const initialPatientContext: PatientContext = {
  complaint: '',
  age: 1,
  unit: 'years',
  gender: 'male',
  appearance: 'well',
  weightKg: undefined,
  spo2: undefined,
  temperatureC: undefined,
  heartRate: undefined,
  respiratoryRate: undefined,
  notes: ''
};

// Normal vitals boundaries based on age group
const getNormalVitalsRange = (age: number, unit: AgeUnit) => {
  let years = age;
  if (unit === 'months') years = age / 12;
  if (unit === 'weeks') years = age / 52;
  if (unit === 'days') years = age / 365;

  if (years <= 0.08) { // < 1 month
    return { hr: [100, 180], rr: [30, 60], temp: [36.5, 37.9] };
  } else if (years <= 1) { // 1 month - 1 year
    return { hr: [100, 160], rr: [30, 50], temp: [36.5, 37.9] };
  } else if (years <= 3) { // 1-3 years
    return { hr: [90, 150], rr: [24, 40], temp: [36.5, 37.5] };
  } else if (years <= 5) { // 3-5 years
    return { hr: [80, 140], rr: [22, 34], temp: [36.5, 37.5] };
  } else if (years <= 12) { // 6-12 years
    return { hr: [70, 120], rr: [18, 30], temp: [36.5, 37.5] };
  } else { // > 12 years
    return { hr: [60, 100], rr: [12, 20], temp: [36.5, 37.5] };
  }
};

const getVitalStatus = (name: 'temp' | 'hr' | 'rr' | 'spo2', val: number, age: number, unit: AgeUnit) => {
  const normals = getNormalVitalsRange(age, unit);
  if (name === 'temp') {
    if (val >= 38.0) return { level: 'high', label: 'Fever (≥38°C)' };
    if (val < 36.0) return { level: 'low', label: 'Hypothermia (<36°C)' };
    return { level: 'normal', label: 'Normal' };
  }
  if (name === 'spo2') {
    if (val < 92) return { level: 'critical', label: 'Severe Hypoxia (<92%)' };
    if (val < 94) return { level: 'low', label: 'Hypoxia (<94%)' };
    return { level: 'normal', label: 'Normal' };
  }
  if (name === 'hr') {
    if (val > normals.hr[1]) return { level: 'high', label: `Tachycardia (>${normals.hr[1]})` };
    if (val < normals.hr[0]) return { level: 'low', label: `Bradycardia (<${normals.hr[0]})` };
    return { level: 'normal', label: 'Normal' };
  }
  if (name === 'rr') {
    if (val > normals.rr[1]) return { level: 'high', label: `Tachypnea (>${normals.rr[1]})` };
    if (val < normals.rr[0]) return { level: 'low', label: `Bradypnea (<${normals.rr[0]})` };
    return { level: 'normal', label: 'Normal' };
  }
  return { level: 'normal', label: 'Normal' };
};

// Pathway match scoring based on chief complaint and patient parameters
const scorePathway = (pathway: Pathway, patient: PatientContext, query: string) => {
  let score = 0;
  const q = query.trim().toLowerCase();
  const complaint = patient.complaint.trim().toLowerCase();
  
  // Keyword matches on search query
  if (q) {
    if (pathway.title.toLowerCase().includes(q)) score += 25;
    if (pathway.chiefComplaints.some(c => c.toLowerCase().includes(q) || q.includes(c.toLowerCase()))) score += 20;
    if (pathway.tags.some(t => t.toLowerCase().includes(q) || q.includes(t.toLowerCase()))) score += 15;
  }
  
  // Keyword matches on chief complaint
  if (complaint) {
    if (pathway.title.toLowerCase().includes(complaint)) score += 20;
    if (pathway.chiefComplaints.some(c => c.toLowerCase().includes(complaint) || complaint.includes(c.toLowerCase()))) score += 15;
    if (pathway.tags.some(t => t.toLowerCase().includes(complaint) || complaint.includes(t.toLowerCase()))) score += 10;
  }

  // Vital sign indicators & clinical appearance matches
  if (pathway.id === 'fever') {
    if (patient.temperatureC !== undefined && patient.temperatureC >= 38.0) score += 30;
    if (complaint.includes('fever') || complaint.includes('warm') || complaint.includes('hot') || complaint.includes('temp')) score += 20;
  }
  
  if (pathway.id === 'resp') {
    if (patient.spo2 !== undefined && patient.spo2 < 94) score += 30;
    const normals = getNormalVitalsRange(patient.age, patient.unit);
    if (patient.respiratoryRate !== undefined && patient.respiratoryRate > normals.rr[1]) score += 20;
    if (complaint.includes('cough') || complaint.includes('wheez') || complaint.includes('breath') || complaint.includes('asthma') || complaint.includes('stridor') || complaint.includes('resp')) score += 20;
  }
  
  if (pathway.id === 'abd') {
    if (complaint.includes('pain') || complaint.includes('belly') || complaint.includes('vomit') || complaint.includes('diarrh') || complaint.includes('nausea') || complaint.includes('stomach')) score += 20;
  }
  
  if (pathway.id === 'seizure') {
    if (complaint.includes('seiz') || complaint.includes('convuls') || complaint.includes('fit') || complaint.includes('shak')) score += 25;
    if (patient.appearance === 'unstable' || patient.appearance === 'toxic') score += 10;
  }
  
  if (pathway.id === 'head') {
    if (complaint.includes('head') || complaint.includes('fall') || complaint.includes('trauma') || complaint.includes('hit') || complaint.includes('concuss')) score += 25;
  }
  
  if (pathway.id === 'limp') {
    if (complaint.includes('limp') || complaint.includes('walk') || complaint.includes('pain') || complaint.includes('leg') || complaint.includes('joint') || complaint.includes('hip')) score += 25;
  }

  return score;
};

export default function App() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  // activeStep: 'profile' | 'navigate' | 'recommendations'
  const [activeStep, setActiveStep] = useState<'profile' | 'navigate' | 'recommendations'>('profile');

  // App Mode: 'guided' (step-by-step) vs 'reference' (full algorithm)
  const [appMode, setAppMode] = useState<'guided' | 'reference'>('guided');

  // Mobile Tab: 'navigator' | 'context' | 'safeguards'
  const [mobileTab, setMobileTab] = useState<'navigator' | 'context' | 'safeguards'>('navigator');

  // Patient Context
  const [patient, setPatient] = useState<PatientContext>(initialPatientContext);
  
  // Active Pathway
  const [pathwayId, setPathwayId] = useState<string>(pathwayRegistry[0].id);
  const pathway = useMemo(() => getPathwayById(pathwayId), [pathwayId]);

  // Pathway Search & suggestion scoring
  const [searchQuery, setSearchQuery] = useState('');
  
  const suggestedPathwaysList = useMemo(() => {
    return pathwayRegistry
      .map((item) => {
        const score = scorePathway(item, patient, searchQuery);
        return { ...item, score };
      })
      .sort((a, b) => b.score - a.score);
  }, [patient, searchQuery]);

  const matchedPathwaysList = useMemo(() => {
    return matchPathways(pathwayRegistry, searchQuery);
  }, [searchQuery]);

  // Decision State
  const [nodeId, setNodeId] = useState<string>(pathway.startNodeId);
  const [history, setHistory] = useState<DecisionStep[]>([]);
  const [completedActions, setCompletedActions] = useState<Record<string, boolean>>({});

  // Active node & calculations
  const currentNode = useMemo(() => getNode(pathway, nodeId), [pathway, nodeId]);
  const snapshot = useMemo(() => createSnapshot(pathway, currentNode, patient, history), [pathway, currentNode, patient, history]);
  const patientFlow = useMemo(() => createPatientFlowState(pathway, currentNode, history), [pathway, currentNode, history]);

  // UI state for showing/hiding advanced vitals
  const [showVitals, setShowVitals] = useState(false);

  // Switch pathways cleanly
  const selectPathway = (id: string) => {
    setPathwayId(id);
    const targetPathway = getPathwayById(id);
    setNodeId(targetPathway.startNodeId);
    setHistory([]);
    setCompletedActions({});
    if (!isDesktop) {
      setMobileTab('navigator');
    }
  };

  // Guided step decision handler
  const handleChooseOption = (option: any) => {
    const step = makeDecisionStep(pathway, currentNode, option.label, option.next, option.flags ?? [], option.actions ?? []);
    setHistory((prev) => [...prev, step]);
    setNodeId(option.next);
  };

  // Step backward handler
  const handleGoBack = () => {
    if (history.length === 0) return;
    const prior = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setNodeId(prior.nodeId);
  };

  // Reset algorithm path
  const handleResetPathway = () => {
    setNodeId(pathway.startNodeId);
    setHistory([]);
    setCompletedActions({});
  };

  // Toggle workup checklist item
  const toggleAction = (actionText: string) => {
    setCompletedActions((prev) => ({
      ...prev,
      [actionText]: !prev[actionText]
}));
  };

  // Calculate age description badge
  const ageDescription = `${patient.age} ${patient.unit}`;
  const resolvedAgeBand = snapshot.ageBand;

  // 1. Unified Stepper UI
  const renderStepper = () => {
    const steps = [
      { key: 'profile', label: '1. Presentation & Triage', icon: User },
      { key: 'navigate', label: '2. ED Evaluation & Decision', icon: Compass },
      { key: 'recommendations', label: '3. Treatment & Disposition', icon: FileText }
    ] as const;

    return (
      <View style={styles.stepperContainer}>
        {steps.map((step, idx) => {
          const isActive = activeStep === step.key;
          const isDone = 
            (step.key === 'profile' && pathwayId) ||
            (step.key === 'navigate' && activeStep === 'recommendations');
          const IconComponent = step.icon;

          return (
            <React.Fragment key={step.key}>
              {idx > 0 && <View style={styles.stepperLine} />}
              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  styles.stepperStep,
                  isActive && styles.stepperStepActive,
                  isDone && styles.stepperStepDone
                ]}
                disabled={step.key !== 'profile' && !pathwayId}
                onPress={() => setActiveStep(step.key)}
              >
                <View style={[
                  styles.stepperNumber,
                  isActive && styles.stepperNumberActive,
                  isDone && styles.stepperNumberDone
                ]}>
                  {isDone ? (
                    <CheckCircle size={12} color="#0F172A" />
                  ) : (
                    <Text style={[
                      styles.stepperNumberText,
                      isActive && styles.stepperNumberTextActive
                    ]}>{idx + 1}</Text>
                  )}
                </View>
                <Text style={[
                  styles.stepperLabel,
                  isActive && styles.stepperLabelActive,
                  isDone && styles.stepperLabelDone
                ]}>{step.label}</Text>
              </TouchableOpacity>
            </React.Fragment>
          );
        })}
      </View>
    );
  };

  // 2. Step 1: Patient Profile & Parameters Form
  const renderProfileInputs = () => {
    const tempStatus = patient.temperatureC !== undefined ? getVitalStatus('temp', patient.temperatureC, patient.age, patient.unit) : null;
    const spo2Status = patient.spo2 !== undefined ? getVitalStatus('spo2', patient.spo2, patient.age, patient.unit) : null;
    const hrStatus = patient.heartRate !== undefined ? getVitalStatus('hr', patient.heartRate, patient.age, patient.unit) : null;
    const rrStatus = patient.respiratoryRate !== undefined ? getVitalStatus('rr', patient.respiratoryRate, patient.age, patient.unit) : null;
    const normalVitals = getNormalVitalsRange(patient.age, patient.unit);

    const quickComplaints = [
      'Fever',
      'Cough',
      'Seizure',
      'Head Trauma',
      'Limp',
      'Abdominal Pain',
      'Vomiting',
      'Sore Throat'
    ];

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <User color="#14B8A6" size={18} />
          <Text style={styles.cardTitle}>Rapid Presentation Entry</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.panelScroll}>
          {/* Chief Complaint Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Chief Complaint / Presentation</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. fever, head trauma, limp..."
              placeholderTextColor="#475569"
              value={patient.complaint}
              onChangeText={(val) => {
                setPatient(prev => ({ ...prev, complaint: val }));
                setSearchQuery(val);
              }}
            />
            {/* Quick Complaint Tags */}
            <View style={styles.quickTagsContainer}>
              {quickComplaints.map((complaint) => (
                <TouchableOpacity
                  key={complaint}
                  activeOpacity={0.7}
                  style={[
                    styles.quickTagBtn,
                    patient.complaint.toLowerCase() === complaint.toLowerCase() && styles.quickTagBtnActive
                  ]}
                  onPress={() => {
                    setPatient(prev => ({ ...prev, complaint }));
                    setSearchQuery(complaint);
                  }}
                >
                  <Text style={[
                    styles.quickTagBtnText,
                    patient.complaint.toLowerCase() === complaint.toLowerCase() && styles.quickTagBtnTextActive
                  ]}>{complaint}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Age & Gender side-by-side */}
          <View style={styles.row}>
            {/* Age Value & Unit */}
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Age</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  style={[styles.textInput, { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]}
                  keyboardType="numeric"
                  value={patient.age.toString()}
                  onChangeText={(val) => setPatient(prev => ({ ...prev, age: Number(val) || 0 }))}
                />
                <View style={styles.ageUnitSelectContainer}>
                  {(['days', 'weeks', 'months', 'years'] as const).map((unit) => (
                    <TouchableOpacity
                      key={unit}
                      activeOpacity={0.7}
                      style={[
                        styles.ageUnitMiniBtn,
                        patient.unit === unit && styles.ageUnitMiniBtnActive
                      ]}
                      onPress={() => setPatient(prev => ({ ...prev, unit }))}
                    >
                      <Text style={[
                        styles.ageUnitMiniBtnText,
                        patient.unit === unit && styles.ageUnitMiniBtnTextActive
                      ]}>
                        {unit === 'days' ? 'D' : unit === 'weeks' ? 'W' : unit === 'months' ? 'M' : 'Y'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Gender Selection */}
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Gender</Text>
              <View style={styles.pickerRow}>
                {(['male', 'female', 'other'] as const).map((gender) => (
                  <TouchableOpacity
                    key={gender}
                    activeOpacity={0.7}
                    style={[
                      styles.pickerBtn,
                      patient.gender === gender && styles.pickerBtnActive,
                      { paddingVertical: 8 }
                    ]}
                    onPress={() => setPatient(prev => ({ ...prev, gender }))}
                  >
                    <Text style={[
                      styles.pickerBtnText,
                      patient.gender === gender && styles.pickerBtnTextActive,
                      { textTransform: 'capitalize' }
                    ]}>{gender}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Optional Vitals Expandable Accordion */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.vitalsAccordionHeader}
            onPress={() => setShowVitals(!showVitals)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Activity size={15} color="#14B8A6" />
              <Text style={styles.vitalsAccordionHeaderText}>Clinical Adjuncts & Vitals (Optional)</Text>
            </View>
            <ChevronRight 
              size={16} 
              color="#94A3B8" 
              style={{ transform: [{ rotate: showVitals ? '90deg' : '0deg' }] }} 
            />
          </TouchableOpacity>

          {showVitals && (
            <View style={styles.vitalsAccordionContent}>
              <View style={[styles.inputGroup, { marginTop: 10 }]}>
                <Text style={styles.label}>Clinical Appearance</Text>
                <View style={styles.pickerGrid}>
                  {(['well', 'ill', 'toxic', 'unstable'] as const).map((appearance) => {
                    const isActive = patient.appearance === appearance;
                    return (
                      <TouchableOpacity
                        key={appearance}
                        activeOpacity={0.7}
                        style={[
                          styles.pickerBtn,
                          styles.pickerGridBtn,
                          isActive && appearance === 'well' && styles.pickerBtnWellActive,
                          isActive && appearance === 'ill' && styles.pickerBtnIllActive,
                          isActive && appearance === 'toxic' && styles.pickerBtnToxicActive,
                          isActive && appearance === 'unstable' && styles.pickerBtnUnstableActive,
                        ]}
                        onPress={() => setPatient(prev => ({ ...prev, appearance }))}
                      >
                        <Text style={[
                          styles.pickerBtnText,
                          isActive && styles.pickerBtnTextActiveWhite
                        ]}>{appearance}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.row}>
                {/* Temp */}
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Temp (°C)</Text>
                    {tempStatus && tempStatus.level !== 'normal' && (
                      <View style={[styles.vitalBadge, tempStatus.level === 'high' ? styles.vitalBadgeRed : styles.vitalBadgeBlue]}>
                        <Text style={styles.vitalBadgeText}>{tempStatus.label}</Text>
                      </View>
                    )}
                  </View>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    placeholder="e.g. 37.2"
                    placeholderTextColor="#475569"
                    value={patient.temperatureC !== undefined ? patient.temperatureC.toString() : ''}
                    onChangeText={(val) => setPatient(prev => ({ ...prev, temperatureC: val ? Number(val) : undefined }))}
                  />
                </View>

                {/* SpO2 */}
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>SpO2 (%)</Text>
                    {spo2Status && spo2Status.level !== 'normal' && (
                      <View style={[styles.vitalBadge, styles.vitalBadgeRed]}>
                        <Text style={styles.vitalBadgeText}>{spo2Status.label}</Text>
                      </View>
                    )}
                  </View>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    placeholder="e.g. 98"
                    placeholderTextColor="#475569"
                    value={patient.spo2 !== undefined ? patient.spo2.toString() : ''}
                    onChangeText={(val) => setPatient(prev => ({ ...prev, spo2: val ? Number(val) : undefined }))}
                  />
                </View>
              </View>

              <View style={styles.row}>
                {/* HR */}
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>HR (bpm)</Text>
                    {hrStatus && hrStatus.level !== 'normal' && (
                      <View style={[styles.vitalBadge, styles.vitalBadgeOrange]}>
                        <Text style={styles.vitalBadgeText}>{hrStatus.label}</Text>
                      </View>
                    )}
                  </View>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    placeholder={`Normal: ${normalVitals.hr[0]}-${normalVitals.hr[1]}`}
                    placeholderTextColor="#475569"
                    value={patient.heartRate !== undefined ? patient.heartRate.toString() : ''}
                    onChangeText={(val) => setPatient(prev => ({ ...prev, heartRate: val ? Number(val) : undefined }))}
                  />
                </View>

                {/* RR */}
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>RR (breaths/min)</Text>
                    {rrStatus && rrStatus.level !== 'normal' && (
                      <View style={[styles.vitalBadge, styles.vitalBadgeOrange]}>
                        <Text style={styles.vitalBadgeText}>{rrStatus.label}</Text>
                      </View>
                    )}
                  </View>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    placeholder={`Normal: ${normalVitals.rr[0]}-${normalVitals.rr[1]}`}
                    placeholderTextColor="#475569"
                    value={patient.respiratoryRate !== undefined ? patient.respiratoryRate.toString() : ''}
                    onChangeText={(val) => setPatient(prev => ({ ...prev, respiratoryRate: val ? Number(val) : undefined }))}
                  />
                </View>
              </View>

              <View style={styles.row}>
                {/* Weight */}
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Weight (kg)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    placeholder="e.g. 15"
                    placeholderTextColor="#475569"
                    value={patient.weightKg !== undefined ? patient.weightKg.toString() : ''}
                    onChangeText={(val) => setPatient(prev => ({ ...prev, weightKg: val ? Number(val) : undefined }))}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Clinical Notes</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  multiline
                  numberOfLines={2}
                  placeholder="Enter additional findings..."
                  placeholderTextColor="#475569"
                  value={patient.notes}
                  onChangeText={(val) => setPatient(prev => ({ ...prev, notes: val }))}
                />
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  // 3. Step 1: Pathway Search and dynamic matches
  const renderSuggestedPathways = () => {
    // Determine suggested pathways (score > 10)
    const suggested = suggestedPathwaysList.filter(p => p.score >= 10);
    const others = suggestedPathwaysList.filter(p => p.score < 10);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Compass color="#14B8A6" size={18} />
          <Text style={styles.cardTitle}>Select Pathway</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.panelScroll}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Search Symptoms or Complaints</Text>
            <View style={styles.searchContainer}>
              <Search color="#94A3B8" size={16} style={styles.searchIcon} />
              <TextInput
                style={styles.searchField}
                placeholder="e.g. fever, vomiting, seizure..."
                placeholderTextColor="#64748B"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          {suggested.length > 0 && (
            <View style={styles.pathwaySection}>
              <View style={styles.pathwaySectionHeader}>
                <Sparkles size={13} color="#14B8A6" />
                <Text style={styles.pathwaySectionTitle}>SUGGESTED PATHWAYS</Text>
              </View>
              {suggested.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.7}
                  style={[
                    styles.pathwayItem,
                    item.id === pathway.id && styles.pathwayItemActive
                  ]}
                  onPress={() => selectPathway(item.id)}
                >
                  <View style={styles.pathwayHeaderRow}>
                    <Text style={[
                      styles.pathwayItemTitle,
                      item.id === pathway.id && styles.pathwayItemTitleActive
                    ]}>{item.title}</Text>
                    <View style={styles.matchScoreBadge}>
                      <Text style={styles.matchScoreBadgeText}>Match Score: {item.score}</Text>
                    </View>
                  </View>
                  <Text style={styles.pathwayItemDesc}>{item.chiefComplaints.join(' · ')}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.pathwaySection}>
            <Text style={styles.pathwaySectionTitle}>
              {suggested.length > 0 ? 'OTHER CLINICAL PATHWAYS' : 'AVAILABLE CLINICAL PATHWAYS'}
            </Text>
            {others.map((item) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.7}
                style={[
                  styles.pathwayItem,
                  item.id === pathway.id && styles.pathwayItemActive
                ]}
                onPress={() => selectPathway(item.id)}
              >
                <View style={styles.pathwayHeaderRow}>
                  <Text style={[
                    styles.pathwayItemTitle,
                    item.id === pathway.id && styles.pathwayItemTitleActive
                  ]}>{item.title}</Text>
                  <ChevronRight color={item.id === pathway.id ? '#14B8A6' : '#475569'} size={14} />
                </View>
                <Text style={styles.pathwayItemDesc}>{item.chiefComplaints.join(' · ')}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Selected Pathway Preview & Proceed Button */}
          {pathway && (
            <View style={styles.previewPanel}>
              <Text style={styles.previewEyebrow}>SELECTED PATHWAY</Text>
              <Text style={styles.previewTitle}>{pathway.title}</Text>
              <View style={{ flexDirection: 'row', marginVertical: 6, gap: 6 }}>
                <View style={[styles.miniAcuityBadge, pathway.acuity === 'emergent' ? styles.badgeEmergent : styles.badgeUrgent]}>
                  <Text style={styles.miniAcuityText}>{pathway.acuity}</Text>
                </View>
                <Text style={styles.previewVersion}>v{pathway.version}</Text>
              </View>
              <Text style={styles.previewWarning}>{pathway.warning}</Text>
              
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.startWizardBtn}
                onPress={() => setActiveStep('navigate')}
              >
                <Text style={styles.startWizardBtnText}>Proceed to Guided Navigator ➔</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  // 4. Compact Patient Summary Sidebar for Navigator Steps
  const renderPatientSummarySidebar = () => {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <User color="#14B8A6" size={18} />
          <Text style={styles.cardTitle}>Patient Context</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.panelScroll}>
          <View style={styles.summaryInfoRow}>
            <Text style={styles.summaryInfoLabel}>Age</Text>
            <Text style={styles.summaryInfoVal}>{patient.age} {patient.unit}</Text>
          </View>
          <View style={styles.summaryInfoRow}>
            <Text style={styles.summaryInfoLabel}>Appearance</Text>
            <Text style={[
              styles.summaryInfoVal, 
              patient.appearance === 'toxic' && styles.textRed,
              patient.appearance === 'unstable' && styles.textRed,
              patient.appearance === 'ill' && styles.textOrange,
              patient.appearance === 'well' && styles.textTeal,
              { fontWeight: '700' }
            ]}>{patient.appearance}</Text>
          </View>

          {/* Vitals Summary */}
          <View style={styles.divider} />
          <Text style={styles.sidebarSubheading}>Vital Signs</Text>
          
          {patient.temperatureC !== undefined ? (
            <View style={styles.summaryInfoRow}>
              <Text style={styles.summaryInfoLabel}>Temp</Text>
              <Text style={styles.summaryInfoVal}>{patient.temperatureC}°C</Text>
            </View>
          ) : null}
          {patient.spo2 !== undefined ? (
            <View style={styles.summaryInfoRow}>
              <Text style={styles.summaryInfoLabel}>SpO2</Text>
              <Text style={styles.summaryInfoVal}>{patient.spo2}%</Text>
            </View>
          ) : null}
          {patient.heartRate !== undefined ? (
            <View style={styles.summaryInfoRow}>
              <Text style={styles.summaryInfoLabel}>HR</Text>
              <Text style={styles.summaryInfoVal}>{patient.heartRate} bpm</Text>
            </View>
          ) : null}
          {patient.respiratoryRate !== undefined ? (
            <View style={styles.summaryInfoRow}>
              <Text style={styles.summaryInfoLabel}>RR</Text>
              <Text style={styles.summaryInfoVal}>{patient.respiratoryRate} /min</Text>
            </View>
          ) : null}
          {patient.weightKg !== undefined ? (
            <View style={styles.summaryInfoRow}>
              <Text style={styles.summaryInfoLabel}>Weight</Text>
              <Text style={styles.summaryInfoVal}>{patient.weightKg} kg</Text>
            </View>
          ) : null}

          {patient.temperatureC === undefined && patient.spo2 === undefined && patient.heartRate === undefined && patient.respiratoryRate === undefined && (
            <Text style={styles.emptyText}>No vitals entered.</Text>
          )}

          {patient.notes ? (
            <View>
              <View style={styles.divider} />
              <Text style={styles.sidebarSubheading}>Notes</Text>
              <Text style={styles.sidebarNotes}>{patient.notes}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.editProfileBtn}
            onPress={() => setActiveStep('profile')}
          >
            <Text style={styles.editProfileBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

  // 5. Compact Right Panel Safeguards (Focusing strictly on Can't Miss and Attending triggers)
  const renderRightPanelCompact = () => {
    const showAttendingTrigger = snapshot.attendingTriggers.length > 0;
    const showCantMiss = patientFlow.cantMissDiagnoses.length > 0;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <ShieldAlert color="#EF4444" size={18} />
          <Text style={styles.cardTitle}>Clinical Safeguards</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.panelScroll}>
          {/* Attending Triggers */}
          {showAttendingTrigger ? (
            <View style={[styles.alertBlock, styles.alertBlockRed]}>
              <View style={styles.alertHeader}>
                <AlertTriangle color="#EF4444" size={15} />
                <Text style={[styles.alertTitle, styles.textRed]}>ATTENDING TRIGGERS</Text>
              </View>
              {snapshot.attendingTriggers.map((trig, idx) => (
                <Text key={idx} style={styles.alertText}>• {trig}</Text>
              ))}
            </View>
          ) : (
            <View style={styles.safeguardOKBlock}>
              <CheckCircle size={14} color="#10B981" />
              <Text style={styles.safeguardOKText}>No active attending triggers.</Text>
            </View>
          )}

          {/* Can't Miss Diagnoses */}
          {showCantMiss ? (
            <View style={[styles.alertBlock, styles.alertBlockOrange]}>
              <View style={styles.alertHeader}>
                <ShieldAlert color="#F59E0B" size={15} />
                <Text style={[styles.alertTitle, styles.textOrange]}>CAN'T-MISS DIAGNOSES</Text>
              </View>
              <View style={styles.tagContainer}>
                {patientFlow.cantMissDiagnoses.map((diag, idx) => (
                  <View key={idx} style={styles.diagTag}>
                    <Text style={styles.diagTagText}>{diag}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.safeguardOKBlock}>
              <CheckCircle size={14} color="#10B981" />
              <Text style={styles.safeguardOKText}>No high-risk diagnoses surfaced.</Text>
            </View>
          )}

          <View style={styles.divider} />
          <Text style={styles.sidebarSubheading}>Pathway Protocol</Text>
          <Text style={styles.activePathwayLabel}>{pathway.title}</Text>
          <Text style={styles.activeNodeLabel}>Active Node: {currentNode.title}</Text>
        </ScrollView>
      </View>
    );
  };

  // 6. Step 3: Unified Management Recommendations & Care Plan
  const renderFinalRecommendations = () => {
    const showWorkup = snapshot.activeActions.length > 0;
    const showDisposition = (currentNode.dispositionCriteria && currentNode.dispositionCriteria.length > 0) || patientFlow.dispositionReadinessItems.length > 0;
    const showReassess = currentNode.reassess && currentNode.reassess.length > 0;

    return (
      <View style={styles.card}>
        <View style={[styles.cardHeader, { backgroundColor: '#1E293B' }]}>
          <FileText color="#10B981" size={18} />
          <Text style={styles.cardTitle}>Management Care Plan & Recommendations</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.panelScroll}>
          {/* Handoff Summary Header */}
          <View style={styles.handoffHeader}>
            <View>
              <Text style={styles.handoffTitle}>PEDIATRIC PATIENT HANDOFF</Text>
              <Text style={styles.handoffSubtitle}>
                {patient.age} {patient.unit} presenting with "{patient.complaint || pathway.title}"
              </Text>
            </View>
            <View style={[styles.miniAcuityBadge, pathway.acuity === 'emergent' ? styles.badgeEmergent : styles.badgeUrgent]}>
              <Text style={styles.miniAcuityText}>{pathway.acuity}</Text>
            </View>
          </View>

          {/* Vitals Summary */}
          <View style={styles.handoffVitalsSummary}>
            <Text style={styles.handoffVitalsTitle}>CLINICAL CHARACTERISTICS:</Text>
            <Text style={styles.handoffVitalsText}>
              • Appearance: <Text style={{fontWeight: '700'}}>{patient.appearance}</Text>
              {patient.temperatureC !== undefined ? `  • Temp: ${patient.temperatureC}°C` : ''}
              {patient.spo2 !== undefined ? `  • SpO2: ${patient.spo2}%` : ''}
              {patient.heartRate !== undefined ? `  • HR: ${patient.heartRate} bpm` : ''}
              {patient.respiratoryRate !== undefined ? `  • RR: ${patient.respiratoryRate} /min` : ''}
              {patient.weightKg !== undefined ? `  • Weight: ${patient.weightKg} kg` : ''}
            </Text>
            {patient.notes ? (
              <Text style={styles.handoffNotesText}>• Presentation Notes: {patient.notes}</Text>
            ) : null}
          </View>

          {/* Sepsis/Meningitis Warning Alert */}
          {snapshot.activeFlags.length > 0 && (
            <View style={[styles.alertBlock, styles.alertBlockRed, { marginVertical: 12 }]}>
              <View style={styles.alertHeader}>
                <AlertTriangle color="#EF4444" size={15} />
                <Text style={[styles.alertTitle, styles.textRed]}>CRITICAL CLINICAL FLAGS</Text>
              </View>
              {snapshot.activeFlags.map((flag, idx) => (
                <Text key={idx} style={styles.alertText}>• {flag}</Text>
              ))}
            </View>
          )}

          {/* Active Workup Checklist */}
          {showWorkup ? (
            <View style={styles.wizardSection}>
              <Text style={styles.sectionHeading}>ACTIVE CLINICAL WORKUP TASKS</Text>
              <Text style={styles.sectionSubtitle}>Ensure the following diagnostic and treatment tasks are initiated:</Text>
              
              {snapshot.activeActions.map((action, idx) => {
                const isDone = !!completedActions[action];
                return (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.7}
                    style={styles.checklistRowLarge}
                    onPress={() => toggleAction(action)}
                  >
                    <View style={[styles.checkboxLarge, isDone && styles.checkboxChecked]}>
                      {isDone && <CheckCircle size={14} color="#FFFFFF" />}
                    </View>
                    <Text style={[styles.checklistTextLarge, isDone && styles.checklistTextChecked]}>
                      {action}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.recommendationEmptyState}>
              <Text style={styles.recommendationEmptyStateText}>No active workup items required for this pathway branch.</Text>
            </View>
          )}

          {/* Reassessments */}
          {showReassess && (
            <View style={styles.wizardSection}>
              <Text style={[styles.sectionHeading, { color: '#818CF8' }]}>REASSESSMENT CHECKPOINTS</Text>
              <Text style={styles.sectionSubtitle}>Frequently re-evaluate the patient for the following criteria:</Text>
              {currentNode.reassess?.map((re, idx) => (
                <Text key={idx} style={styles.reassessTextLarge}>• {re}</Text>
              ))}
            </View>
          )}

          {/* Disposition Readiness Criteria */}
          {showDisposition && (
            <View style={[styles.alertBlock, styles.alertBlockTeal, { marginVertical: 12 }]}>
              <View style={styles.alertHeader}>
                <CheckCircle color="#10B981" size={15} />
                <Text style={[styles.alertTitle, styles.textTeal]}>DISPOSITION & READINESS CRITERIA</Text>
              </View>
              {(currentNode.dispositionCriteria || patientFlow.dispositionReadinessItems).map((crit, idx) => (
                <Text key={idx} style={[styles.alertText, { color: '#E2E8F0' }]}>• {crit}</Text>
              ))}
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.recommendationsActions}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.backToNavigatorBtn}
              onPress={() => setActiveStep('navigate')}
            >
              <Text style={styles.backToNavigatorBtnText}>Back to Navigator</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.resetAllBtn}
              onPress={() => {
                setPatient(initialPatientContext);
                setSearchQuery('');
                setPathwayId(pathwayRegistry[0].id);
                setNodeId(pathwayRegistry[0].startNodeId);
                setHistory([]);
                setCompletedActions({});
                setActiveStep('profile');
              }}
            >
              <Text style={styles.resetAllBtnText}>Clear & Start New Patient</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  };

  // Render Guided Step-by-Step Pathway Navigator
  const renderGuidedMode = () => {
    const isTerminal = currentNode.type === 'terminal';
    const showBack = history.length > 0;

    return (
      <View style={styles.mainNavCard}>
        {/* Node Card Header */}
        <View style={styles.nodeHeader}>
          <View>
            <View style={styles.nodePathContainer}>
              <Text style={styles.nodePathPathwayName}>{pathway.title}</Text>
              <ChevronRight color="#64748B" size={12} style={{ marginLeft: 4, marginRight: 4 }} />
              <Text style={styles.nodePathNodeName}>{currentNode.title}</Text>
            </View>
            <Text style={styles.nodeTypeBadge}>{currentNode.type}</Text>
          </View>

          <View style={styles.controlsRow}>
            {showBack && (
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.controlBtn}
                onPress={handleGoBack}
              >
                <ArrowLeft color="#14B8A6" size={14} />
                <Text style={styles.controlBtnText}>Back</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.controlBtn, styles.controlBtnSecondary]}
              onPress={handleResetPathway}
            >
              <RefreshCcw color="#94A3B8" size={14} />
              <Text style={styles.controlBtnTextSecondary}>Restart</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Node Question / Prompt */}
        <View style={styles.promptContainer}>
          <Text style={styles.promptLabel}>CRITICAL QUESTION / STEP</Text>
          <Text style={styles.promptText}>{currentNode.prompt || 'Evaluate patient state.'}</Text>
        </View>

        {/* Decision Branches */}
        {currentNode.options && currentNode.options.length > 0 ? (
          <View style={styles.optionsBlock}>
            <Text style={styles.optionsLabel}>SELECT ACTION OR BRANCH:</Text>
            {currentNode.options.map((option, idx) => (
              <TouchableOpacity
                key={idx}
                activeOpacity={0.7}
                style={styles.optionButton}
                onPress={() => handleChooseOption(option)}
              >
                <Text style={styles.optionButtonText}>{option.label}</Text>
                <View style={styles.optionRightContainer}>
                  {option.flags && option.flags.length > 0 && (
                    <View style={styles.optionFlag}>
                      <Text style={styles.optionFlagText}>{option.flags[0]}</Text>
                    </View>
                  )}
                  <ChevronRight color="#14B8A6" size={16} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.terminalContainer}>
            <CheckCircle color="#10B981" size={28} />
            <Text style={styles.terminalTitle}>Disposition Node Reached</Text>
            <Text style={styles.terminalText}>Ensure all active diagnostic items are completed and disposition criteria are fully reviewed before finalizing.</Text>
          </View>
        )}

        {/* Decision History Trail */}
        {history.length > 0 && (
          <View style={styles.historyBlock}>
            <Text style={styles.historyHeading}>DECISION BREADCRUMBS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyScroll}>
              {history.map((step, idx) => (
                <View key={idx} style={styles.historyTag}>
                  <Text style={styles.historyTagText}>{step.nodeTitle}</Text>
                  <ChevronRight color="#475569" size={12} style={{ marginLeft: 4, marginRight: 4 }} />
                  <Text style={styles.historyTagAnswer}>{step.answer}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  // Render Full Pathway Algorithm Reference Explorer
  const renderReferenceMode = () => {
    return (
      <View style={styles.mainNavCard}>
        <View style={styles.nodeHeader}>
          <View>
            <Text style={styles.fullPathwayTitle}>{pathway.title}</Text>
            <Text style={styles.fullPathwaySub}>Algorithm Reference (Version {pathway.version})</Text>
          </View>
          <View style={styles.fullPathwayAcuityBadge}>
            <Text style={styles.fullPathwayAcuityText}>{pathway.acuity}</Text>
          </View>
        </View>

        <View style={styles.warningContainer}>
          <AlertTriangle color="#F59E0B" size={16} />
          <Text style={styles.warningText}>{pathway.warning}</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.nodesReferenceScroll}>
          {Object.values(pathway.nodes).map((node: PathwayNode, index: number) => {
            const isStart = node.id === pathway.startNodeId;
            return (
              <View key={node.id} style={styles.refNodeBlock}>
                <View style={styles.refNodeHeader}>
                  <View style={styles.refNodeTitleRow}>
                    <Text style={styles.refNodeIndex}>{index + 1}</Text>
                    <Text style={styles.refNodeTitle}>{node.title}</Text>
                    {isStart && <Text style={styles.startBadge}>Start</Text>}
                  </View>
                  <Text style={styles.refNodeType}>{node.type}</Text>
                </View>

                <Text style={styles.refNodePrompt}>{node.prompt}</Text>

                {node.options && node.options.length > 0 && (
                  <View style={styles.refOptionsList}>
                    {node.options.map((opt, oIdx) => (
                      <View key={oIdx} style={styles.refOptionItem}>
                        <View style={styles.refOptionLeft}>
                          <Text style={styles.refOptionBullet}>↪</Text>
                          <Text style={styles.refOptionLabel}>{opt.label}</Text>
                        </View>
                        <View style={styles.refOptionRight}>
                          <Text style={styles.refOptionDestText}>Goes to:</Text>
                          <Text style={styles.refOptionDest}>{pathway.nodes[opt.next]?.title || opt.next}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {node.cantMiss && node.cantMiss.length > 0 && (
                  <View style={styles.refNodeMeta}>
                    <Text style={styles.refNodeMetaLabel}>Can't Miss:</Text>
                    <Text style={styles.refNodeMetaVal}>{node.cantMiss.join(', ')}</Text>
                  </View>
                )}

                {node.actions && node.actions.length > 0 && (
                  <View style={styles.refNodeMeta}>
                    <Text style={styles.refNodeMetaLabel}>Actions:</Text>
                    <Text style={[styles.refNodeMetaVal, { color: '#94A3B8' }]}>{node.actions.join(', ')}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  // Main Desktop Render
  const renderDesktop = () => {
    if (activeStep === 'profile') {
      return (
        <View style={styles.desktopContainer}>
          <View style={styles.sidebarColumn}>
            {renderProfileInputs()}
          </View>
          <View style={[styles.mainColumn, { flex: 2 }]}>
            {renderSuggestedPathways()}
          </View>
        </View>
      );
    }

    if (activeStep === 'recommendations') {
      return (
        <View style={styles.desktopContainerWide}>
          <View style={styles.wideColumn}>
            {renderFinalRecommendations()}
          </View>
        </View>
      );
    }

    // Default: 'navigate' step
    return (
      <View style={styles.desktopContainer}>
        <View style={styles.sidebarColumn}>
          {renderPatientSummarySidebar()}
        </View>
        <View style={styles.mainColumn}>
          {/* Mode Selector */}
          <View style={styles.modeTabs}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.modeTab, appMode === 'guided' && styles.modeTabActive]}
              onPress={() => setAppMode('guided')}
            >
              <Compass size={16} color={appMode === 'guided' ? '#14B8A6' : '#94A3B8'} />
              <Text style={[styles.modeTabText, appMode === 'guided' && styles.modeTabTextActive]}>Guided Navigator</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.modeTab, appMode === 'reference' && styles.modeTabActive]}
              onPress={() => setAppMode('reference')}
            >
              <Map size={16} color={appMode === 'reference' ? '#14B8A6' : '#94A3B8'} />
              <Text style={[styles.modeTabText, appMode === 'reference' && styles.modeTabTextActive]}>Algorithm Explorer</Text>
            </TouchableOpacity>
          </View>

          {appMode === 'guided' ? renderGuidedMode() : renderReferenceMode()}

          {/* Quick proceed to care plan button */}
          <View style={styles.navigationProceedContainer}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.proceedToHandoffBtn}
              onPress={() => setActiveStep('recommendations')}
            >
              <Text style={styles.proceedToHandoffBtnText}>Generate Care Plan & Handoff ➔</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.sidebarColumn}>
          {renderRightPanelCompact()}
        </View>
      </View>
    );
  };

  // Main Mobile Render
  const renderMobile = () => {
    if (activeStep === 'profile') {
      return (
        <View style={styles.mobileContainer}>
          <View style={styles.mobileMainArea}>
            {mobileTab === 'context' ? renderProfileInputs() : renderSuggestedPathways()}
          </View>

          <View style={styles.mobileTabs}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.mobileTabBtn, mobileTab === 'context' && styles.mobileTabBtnActive]}
              onPress={() => setMobileTab('context')}
            >
              <User size={20} color={mobileTab === 'context' ? '#14B8A6' : '#64748B'} />
              <Text style={[styles.mobileTabText, mobileTab === 'context' && styles.mobileTabTextActive]}>Patient Info</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.mobileTabBtn, mobileTab === 'navigator' && styles.mobileTabBtnActive]}
              onPress={() => setMobileTab('navigator')}
            >
              <Compass size={20} color={mobileTab === 'navigator' ? '#14B8A6' : '#64748B'} />
              <Text style={[styles.mobileTabText, mobileTab === 'navigator' && styles.mobileTabTextActive]}>Select Pathway</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (activeStep === 'recommendations') {
      return (
        <View style={styles.mobileContainer}>
          <View style={styles.mobileMainArea}>
            {renderFinalRecommendations()}
          </View>
        </View>
      );
    }

    // Default: 'navigate' step
    return (
      <View style={styles.mobileContainer}>
        {/* Mobile Header Context Summary */}
        <View style={styles.mobileHeaderSummary}>
          <View style={styles.mobileSummaryLeft}>
            <Text style={styles.mobileSummaryTitle}>{pathway.title}</Text>
            <Text style={styles.mobileSummaryContext}>
              {ageDescription} • {patient.appearance}
            </Text>
          </View>
          <View style={styles.mobileSummaryRight}>
            <Text style={styles.mobileSummaryNodeText}>{currentNode.title}</Text>
          </View>
        </View>

        {/* View switching based on active Mobile Tab */}
        <View style={styles.mobileMainArea}>
          {mobileTab === 'context' && renderPatientSummarySidebar()}
          {mobileTab === 'navigator' && (
            <View style={{ flex: 1 }}>
              {/* Guided vs Reference mode toggles inside navigator tab */}
              <View style={styles.mobileModeToggle}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[styles.mobileModeBtn, appMode === 'guided' && styles.mobileModeBtnActive]}
                  onPress={() => setAppMode('guided')}
                >
                  <Text style={[styles.mobileModeBtnText, appMode === 'guided' && styles.mobileModeBtnTextActive]}>Guided</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[styles.mobileModeBtn, appMode === 'reference' && styles.mobileModeBtnActive]}
                  onPress={() => setAppMode('reference')}
                >
                  <Text style={[styles.mobileModeBtnText, appMode === 'reference' && styles.mobileModeBtnTextActive]}>Reference</Text>
                </TouchableOpacity>
              </View>

              {appMode === 'guided' ? renderGuidedMode() : renderReferenceMode()}

              {/* Mobile Quick proceed to handoff button */}
              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.proceedToHandoffBtn, { marginTop: 10 }]}
                onPress={() => setActiveStep('recommendations')}
              >
                <Text style={styles.proceedToHandoffBtnText}>Generate Care Plan ➔</Text>
              </TouchableOpacity>
            </View>
          )}
          {mobileTab === 'safeguards' && renderRightPanelCompact()}
        </View>

        {/* Mobile Navigation Tabs */}
        <View style={styles.mobileTabs}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.mobileTabBtn, mobileTab === 'context' && styles.mobileTabBtnActive]}
            onPress={() => setMobileTab('context')}
          >
            <User size={20} color={mobileTab === 'context' ? '#14B8A6' : '#64748B'} />
            <Text style={[styles.mobileTabText, mobileTab === 'context' && styles.mobileTabTextActive]}>Context</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.mobileTabBtn, mobileTab === 'navigator' && styles.mobileTabBtnActive]}
            onPress={() => setMobileTab('navigator')}
          >
            <Compass size={20} color={mobileTab === 'navigator' ? '#14B8A6' : '#64748B'} />
            <Text style={[styles.mobileTabText, mobileTab === 'navigator' && styles.mobileTabTextActive]}>Navigator</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.mobileTabBtn, mobileTab === 'safeguards' && styles.mobileTabBtnActive]}
            onPress={() => setMobileTab('safeguards')}
          >
            <ShieldAlert size={20} color={mobileTab === 'safeguards' ? '#14B8A6' : '#64748B'} />
            <Text style={[styles.mobileTabText, mobileTab === 'safeguards' && styles.mobileTabTextActive]}>Safeguards</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      {/* Premium Top Bar */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <View style={brandMarkStyle}>
            <Heart size={20} color="#14B8A6" fill="#14B8A6" />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerEyebrow}>PEM CLINICAL REFERENCE</Text>
            <Text style={styles.headerTitle}>FlowMaster</Text>
          </View>
        </View>

        <View style={styles.deviceIndicator}>
          {isDesktop ? (
            <View style={styles.indicatorBadge}>
              <Laptop size={12} color="#14B8A6" />
              <Text style={styles.indicatorText}>Desktop Mode</Text>
            </View>
          ) : (
            <View style={styles.indicatorBadge}>
              <Smartphone size={12} color="#14B8A6" />
              <Text style={styles.indicatorText}>Mobile View</Text>
            </View>
          )}
        </View>
      </View>

      {/* Stepper Wizard Indicator */}
      {renderStepper()}

      {/* Main Body */}
      {isDesktop ? renderDesktop() : renderMobile()}
    </SafeAreaView>
  );
}

// Inline workaround for array/tuple styling in React Native Web type safety
const brandMarkStyle = {
  padding: 8,
  backgroundColor: 'rgba(20, 184, 166, 0.12)',
  borderRadius: 10,
  borderWidth: 1,
  borderColor: 'rgba(20, 184, 166, 0.3)',
};

// StyleSheet using React Native properties
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTextContainer: {
    marginLeft: 12,
  },
  headerEyebrow: {
    fontSize: 9,
    fontWeight: '900',
    color: '#14B8A6',
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  deviceIndicator: {
    flexDirection: 'row',
  },
  indicatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  indicatorText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#14B8A6',
    marginLeft: 4,
  },
  desktopContainer: {
    flex: 1,
    flexDirection: 'row',
    padding: 16,
    gap: 16,
    backgroundColor: '#0F172A',
  },
  mobileContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  sidebarColumn: {
    width: 320,
  },
  mainColumn: {
    flex: 1,
  },
  card: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    backgroundColor: '#1E293B',
    gap: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F8FAFC',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  panelScroll: {
    flex: 1,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchField: {
    flex: 1,
    height: 38,
    color: '#F8FAFC',
    fontSize: 13,
    outlineStyle: 'none', // Works for React Native Web
  } as any,
  pathwayList: {
    marginBottom: 10,
  },
  pathwayItem: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  pathwayItemActive: {
    borderColor: '#14B8A6',
    backgroundColor: 'rgba(20, 184, 166, 0.08)',
  },
  pathwayHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pathwayItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  pathwayItemTitleActive: {
    color: '#14B8A6',
  },
  pathwayItemDesc: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 4,
    textTransform: 'capitalize',
  },
  emptyText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginVertical: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 16,
  },
  subSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F8FAFC',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    padding: 10,
    color: '#F8FAFC',
    fontSize: 14,
  },
  textArea: {
    height: 60,
    textAlignVertical: 'top',
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerBtn: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerGridBtn: {
    paddingVertical: 8,
  },
  pickerBtnActive: {
    borderColor: '#14B8A6',
    backgroundColor: 'rgba(20, 184, 166, 0.12)',
  },
  pickerBtnWellActive: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  pickerBtnIllActive: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  pickerBtnToxicActive: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  pickerBtnUnstableActive: {
    borderColor: '#E11D48',
    backgroundColor: 'rgba(225, 29, 72, 0.25)',
  },
  pickerBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  pickerBtnTextActive: {
    color: '#14B8A6',
  },
  pickerBtnTextActiveWhite: {
    color: '#FFFFFF',
  },
  vitalsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(20, 184, 166, 0.04)',
    gap: 8,
  },
  vitalsToggleText: {
    color: '#14B8A6',
    fontSize: 12,
    fontWeight: '700',
  },
  vitalsBlock: {
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    marginBottom: 20,
  },
  infoBadge: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  infoBadgeLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  infoBadgeValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
    textTransform: 'capitalize',
  },
  textRed: {
    color: '#EF4444',
  },
  textOrange: {
    color: '#F59E0B',
  },
  textTeal: {
    color: '#10B981',
  },
  alertBlock: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
  },
  alertBlockRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  alertBlockOrange: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  alertBlockTeal: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  alertTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  alertText: {
    fontSize: 11,
    color: '#CBD5E1',
    lineHeight: 16,
    marginBottom: 4,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  diagTag: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  diagTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
  },
  referenceSection: {
    marginBottom: 16,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '900',
    color: '#818CF8',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 8,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: '#14B8A6',
    borderColor: '#14B8A6',
  },
  checklistText: {
    fontSize: 12,
    color: '#E2E8F0',
    flex: 1,
    lineHeight: 16,
  },
  checklistTextChecked: {
    textDecorationLine: 'line-through',
    color: '#64748B',
  },
  reassessText: {
    fontSize: 11,
    color: '#CBD5E1',
    lineHeight: 16,
    marginBottom: 6,
  },
  emptySafeguards: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    marginTop: 40,
  },
  emptySafeguardsText: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  modeTabActive: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  modeTabTextActive: {
    color: '#14B8A6',
  },
  mainNavCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  nodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 16,
    marginBottom: 16,
  },
  nodePathContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nodePathPathwayName: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  nodePathNodeName: {
    fontSize: 12,
    color: '#14B8A6',
    fontWeight: '700',
  },
  nodeTypeBadge: {
    fontSize: 9,
    fontWeight: '900',
    color: '#10B981',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 184, 166, 0.12)',
    borderWidth: 1,
    borderColor: '#14B8A6',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  controlBtnText: {
    color: '#14B8A6',
    fontSize: 12,
    fontWeight: '700',
  },
  controlBtnSecondary: {
    backgroundColor: 'transparent',
    borderColor: '#475569',
  },
  controlBtnTextSecondary: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  promptContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  promptLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 6,
  },
  promptText: {
    fontSize: 16,
    color: '#F8FAFC',
    fontWeight: '600',
    lineHeight: 24,
  },
  optionsBlock: {
    marginBottom: 20,
  },
  optionsLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  optionButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  optionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E2E8F0',
    flex: 1,
  },
  optionRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionFlag: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  optionFlagText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#F43F5E',
    textTransform: 'uppercase',
  },
  terminalContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    padding: 24,
    marginVertical: 10,
  },
  terminalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#10B981',
    marginTop: 10,
    marginBottom: 6,
  },
  terminalText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
  historyBlock: {
    marginTop: 'auto',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 16,
  },
  historyHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 8,
  },
  historyScroll: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  historyTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  historyTagAnswer: {
    fontSize: 11,
    fontWeight: '700',
    color: '#14B8A6',
  },
  fullPathwayTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  fullPathwaySub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  fullPathwayAcuityBadge: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  fullPathwayAcuityText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#F43F5E',
    textTransform: 'uppercase',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  warningText: {
    fontSize: 11,
    color: '#F59E0B',
    flex: 1,
    lineHeight: 16,
  },
  nodesReferenceScroll: {
    flex: 1,
  },
  refNodeBlock: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    marginBottom: 12,
  },
  refNodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingBottom: 8,
    marginBottom: 8,
  },
  refNodeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refNodeIndex: {
    fontSize: 11,
    fontWeight: '800',
    color: '#14B8A6',
    backgroundColor: 'rgba(20, 184, 166, 0.1)',
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: 'center',
    lineHeight: 20,
  },
  refNodeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  startBadge: {
    fontSize: 9,
    fontWeight: '900',
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
    textTransform: 'uppercase',
  },
  refNodeType: {
    fontSize: 9,
    color: '#64748B',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  refNodePrompt: {
    fontSize: 13,
    color: '#E2E8F0',
    lineHeight: 18,
    marginVertical: 6,
  },
  refOptionsList: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 10,
    marginVertical: 6,
    gap: 8,
  },
  refOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  refOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  refOptionBullet: {
    color: '#14B8A6',
    fontSize: 14,
  },
  refOptionLabel: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  refOptionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  refOptionDestText: {
    fontSize: 10,
    color: '#64748B',
  },
  refOptionDest: {
    fontSize: 11,
    color: '#14B8A6',
    fontWeight: '700',
  },
  refNodeMeta: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 6,
  },
  refNodeMetaLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  refNodeMetaVal: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '600',
    flex: 1,
  },
  mobileHeaderSummary: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mobileSummaryLeft: {
    flex: 1,
    marginRight: 10,
  },
  mobileSummaryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  mobileSummaryContext: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  mobileSummaryRight: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  mobileSummaryNodeText: {
    fontSize: 10,
    color: '#14B8A6',
    fontWeight: '700',
  },
  mobileMainArea: {
    flex: 1,
    padding: 10,
  },
  mobileModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 2,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  mobileModeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 6,
  },
  mobileModeBtnActive: {
    backgroundColor: '#0F172A',
  },
  mobileModeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  mobileModeBtnTextActive: {
    color: '#14B8A6',
  },
  mobileTabs: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    backgroundColor: '#0F172A',
    paddingVertical: 8,
  },
  mobileTabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileTabBtnActive: {},
  mobileTabText: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mobileTabTextActive: {
    color: '#14B8A6',
    fontWeight: '800',
  },
  // Stepper Styles
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    justifyContent: 'center',
  },
  stepperStep: {
    flexDirection: 'row',
    alignItems: 'center',
    opacity: 0.6,
  },
  stepperStepActive: {
    opacity: 1,
  },
  stepperStepDone: {
    opacity: 0.95,
  },
  stepperLine: {
    flex: 1,
    maxWidth: 60,
    height: 2,
    backgroundColor: '#1E293B',
    marginHorizontal: 12,
  },
  stepperNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  stepperNumberActive: {
    backgroundColor: '#14B8A6',
  },
  stepperNumberDone: {
    backgroundColor: '#10B981',
  },
  stepperNumberText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  stepperNumberTextActive: {
    color: '#0F172A',
  },
  stepperLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  stepperLabelActive: {
    color: '#14B8A6',
    fontWeight: '700',
  },
  stepperLabelDone: {
    color: '#F8FAFC',
  },

  // Wizard Content Styles
  wizardSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  wizardSection: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 16,
  },
  inputHint: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 8,
  },
  vitalsToggleCompact: {
    backgroundColor: 'rgba(20, 184, 166, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  vitalsToggleCompactText: {
    fontSize: 10,
    color: '#14B8A6',
    fontWeight: '700',
  },
  vitalsPromoBox: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#334155',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  vitalsPromoText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  vitalBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  vitalBadgeRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  vitalBadgeBlue: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  vitalBadgeOrange: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  vitalBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#14B8A6',
  },
  pathwaySection: {
    marginBottom: 16,
  },
  pathwaySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  pathwaySectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  matchScoreBadge: {
    backgroundColor: 'rgba(20, 184, 166, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  matchScoreBadgeText: {
    fontSize: 9,
    color: '#14B8A6',
    fontWeight: '700',
  },
  previewPanel: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 12,
  },
  previewEyebrow: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '850',
    color: '#F8FAFC',
  },
  miniAcuityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeEmergent: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
  },
  badgeUrgent: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  miniAcuityText: {
    fontSize: 9,
    fontWeight: '850',
    color: '#F43F5E',
    textTransform: 'uppercase',
  },
  previewVersion: {
    fontSize: 10,
    color: '#64748B',
    alignSelf: 'center',
  },
  previewWarning: {
    fontSize: 11,
    color: '#CBD5E1',
    lineHeight: 16,
    marginBottom: 12,
  },
  startWizardBtn: {
    backgroundColor: '#14B8A6',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  startWizardBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  
  // Compact summary styles
  summaryInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  summaryInfoLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  summaryInfoVal: {
    fontSize: 12,
    color: '#E2E8F0',
  },
  sidebarSubheading: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginVertical: 10,
  },
  sidebarNotes: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 16,
    backgroundColor: '#0F172A',
    padding: 10,
    borderRadius: 8,
  },
  editProfileBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  editProfileBtnText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
  },
  safeguardOKBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  safeguardOKText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
  },
  activePathwayLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  activeNodeLabel: {
    fontSize: 11,
    color: '#14B8A6',
    marginTop: 4,
  },

  // Final recommendations styles
  handoffHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 12,
  },
  handoffTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#14B8A6',
    letterSpacing: 0.5,
  },
  handoffSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  handoffVitalsSummary: {
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 16,
  },
  handoffVitalsTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 6,
  },
  handoffVitalsText: {
    fontSize: 11,
    color: '#E2E8F0',
    lineHeight: 16,
  },
  handoffNotesText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingTop: 6,
  },
  checklistRowLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  checkboxLarge: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checklistTextLarge: {
    fontSize: 13,
    color: '#E2E8F0',
    fontWeight: '600',
  },
  reassessTextLarge: {
    fontSize: 12,
    color: '#E2E8F0',
    lineHeight: 18,
    marginVertical: 4,
  },
  recommendationEmptyState: {
    padding: 16,
    alignItems: 'center',
  },
  recommendationEmptyStateText: {
    fontSize: 11,
    color: '#64748B',
  },
  recommendationsActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  backToNavigatorBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  backToNavigatorBtnText: {
    fontSize: 13,
    color: '#F8FAFC',
    fontWeight: '700',
  },
  resetAllBtn: {
    flex: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  resetAllBtnText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '700',
  },

  // Desktop specific containers
  desktopContainerWide: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  wideColumn: {
    flex: 1,
  },
  navigationProceedContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  proceedToHandoffBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  proceedToHandoffBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  // Streamlined Presentation Entry styles
  quickTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  quickTagBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  quickTagBtnActive: {
    backgroundColor: 'rgba(20, 184, 166, 0.15)',
    borderColor: '#14B8A6',
  },
  quickTagBtnText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  quickTagBtnTextActive: {
    color: '#14B8A6',
    fontWeight: '700',
  },
  ageUnitSelectContainer: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: '#334155',
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    padding: 2,
    height: 40,
    alignItems: 'center',
  },
  ageUnitMiniBtn: {
    paddingHorizontal: 8,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  ageUnitMiniBtnActive: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  ageUnitMiniBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  ageUnitMiniBtnTextActive: {
    color: '#14B8A6',
  },
  vitalsAccordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 6,
  },
  vitalsAccordionHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  vitalsAccordionContent: {
    marginTop: 10,
    gap: 8,
  },
});
