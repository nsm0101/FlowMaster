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
  appearance: 'well',
  weightKg: undefined,
  spo2: undefined,
  temperatureC: undefined,
  heartRate: undefined,
  respiratoryRate: undefined,
  notes: ''
};

export default function App() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  // App Mode: 'guided' (step-by-step) vs 'reference' (full algorithm)
  const [appMode, setAppMode] = useState<'guided' | 'reference'>('guided');

  // Mobile Tab: 'navigator' | 'context' | 'safeguards'
  const [mobileTab, setMobileTab] = useState<'navigator' | 'context' | 'safeguards'>('navigator');

  // Patient Context
  const [patient, setPatient] = useState<PatientContext>(initialPatientContext);
  
  // Active Pathway
  const [pathwayId, setPathwayId] = useState<string>(pathwayRegistry[0].id);
  const pathway = useMemo(() => getPathwayById(pathwayId), [pathwayId]);

  // Pathway Search
  const [searchQuery, setSearchQuery] = useState('');
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

  // Render Left Column: Search & Context Inputs
  const renderLeftPanel = () => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Stethoscope color="#14B8A6" size={18} />
        <Text style={styles.cardTitle}>Clinical Context</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.panelScroll}>
        {/* Pathway Search & Select */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Search Symptoms/Pathways</Text>
          <View style={styles.searchContainer}>
            <Search color="#94A3B8" size={16} style={styles.searchIcon} />
            <TextInput
              style={styles.searchField}
              placeholder="e.g. fever, limp, seizure..."
              placeholderTextColor="#64748B"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        <View style={styles.pathwayList}>
          {matchedPathwaysList.slice(0, 4).map((item) => (
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
          {matchedPathwaysList.length === 0 && (
            <Text style={styles.emptyText}>No matching pathways found.</Text>
          )}
        </View>

        {/* Patient Parameters */}
        <View style={styles.divider} />
        
        <Text style={styles.subSectionTitle}>Patient Profile</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Age Value</Text>
          <TextInput
            style={styles.textInput}
            keyboardType="numeric"
            value={patient.age.toString()}
            onChangeText={(val) => setPatient(prev => ({ ...prev, age: Number(val) || 0 }))}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Age Unit</Text>
          <View style={styles.pickerRow}>
            {(['days', 'months', 'years'] as const).map((unit) => (
              <TouchableOpacity
                key={unit}
                activeOpacity={0.7}
                style={[
                  styles.pickerBtn,
                  patient.unit === unit && styles.pickerBtnActive
                ]}
                onPress={() => setPatient(prev => ({ ...prev, unit }))}
              >
                <Text style={[
                  styles.pickerBtnText,
                  patient.unit === unit && styles.pickerBtnTextActive
                ]}>{unit}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
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
                    isActive && appearance === 'toxic' && styles.pickerBtnToxicActive,
                    isActive && appearance === 'unstable' && styles.pickerBtnUnstableActive,
                    isActive && appearance === 'ill' && styles.pickerBtnIllActive,
                    isActive && appearance === 'well' && styles.pickerBtnWellActive,
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

        {/* Toggleable Advanced Vitals */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setShowVitals(!showVitals)}
          style={styles.vitalsToggle}
        >
          <Activity size={14} color="#14B8A6" />
          <Text style={styles.vitalsToggleText}>
            {showVitals ? 'Hide Vitals & Weights' : 'Add Vitals & Weight'}
          </Text>
        </TouchableOpacity>

        {showVitals && (
          <View style={styles.vitalsBlock}>
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Weight (kg)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  placeholder="e.g. 12"
                  placeholderTextColor="#475569"
                  value={patient.weightKg !== undefined ? patient.weightKg.toString() : ''}
                  onChangeText={(val) => setPatient(prev => ({ ...prev, weightKg: val ? Number(val) : undefined }))}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>SpO2 (%)</Text>
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
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Temp (°C)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  placeholder="38.5"
                  placeholderTextColor="#475569"
                  value={patient.temperatureC !== undefined ? patient.temperatureC.toString() : ''}
                  onChangeText={(val) => setPatient(prev => ({ ...prev, temperatureC: val ? Number(val) : undefined }))}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Heart Rate (bpm)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  placeholder="120"
                  placeholderTextColor="#475569"
                  value={patient.heartRate !== undefined ? patient.heartRate.toString() : ''}
                  onChangeText={(val) => setPatient(prev => ({ ...prev, heartRate: val ? Number(val) : undefined }))}
                />
              </View>
            </View>
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Clinical Notes (Optional)</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            multiline={true}
            numberOfLines={3}
            placeholder="Add relevant history/findings..."
            placeholderTextColor="#475569"
            value={patient.notes}
            onChangeText={(val) => setPatient(prev => ({ ...prev, notes: val }))}
          />
        </View>

        {/* Info Badges */}
        <View style={styles.badgeRow}>
          <View style={styles.infoBadge}>
            <Text style={styles.infoBadgeLabel}>Age Band</Text>
            <Text style={styles.infoBadgeValue}>{resolvedAgeBand}</Text>
          </View>
          <View style={styles.infoBadge}>
            <Text style={styles.infoBadgeLabel}>Acuity Level</Text>
            <Text style={[
              styles.infoBadgeValue,
              pathway.acuity === 'emergent' && styles.textRed,
              pathway.acuity === 'urgent' && styles.textOrange,
            ]}>{pathway.acuity}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );

  // Render Right Column: Clinical Safeguards (Can't miss, triggers, actions)
  const renderRightPanel = () => {
    const showAttendingTrigger = snapshot.attendingTriggers.length > 0;
    const showCantMiss = patientFlow.cantMissDiagnoses.length > 0;
    const showDisposition = currentNode.type === 'terminal' || (currentNode.dispositionCriteria && currentNode.dispositionCriteria.length > 0);
    const showWorkup = snapshot.activeActions.length > 0;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <ShieldAlert color="#F43F5E" size={18} />
          <Text style={styles.cardTitle}>Reference & Safeguards</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.panelScroll}>
          {/* Attending Triggers */}
          {showAttendingTrigger && (
            <View style={[styles.alertBlock, styles.alertBlockRed]}>
              <View style={styles.alertHeader}>
                <AlertTriangle color="#EF4444" size={15} />
                <Text style={[styles.alertTitle, styles.textRed]}>ATTENDING NOTIFICATION TRIGGERS</Text>
              </View>
              {snapshot.attendingTriggers.map((trig, idx) => (
                <Text key={idx} style={styles.alertText}>• {trig}</Text>
              ))}
            </View>
          )}

          {/* Can't Miss Diagnoses */}
          {showCantMiss && (
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
          )}

          {/* Recommended Workup Checklist */}
          {showWorkup && (
            <View style={styles.referenceSection}>
              <Text style={styles.sectionHeading}>ACTIVE CLINICAL WORKUP</Text>
              <Text style={styles.sectionSubtitle}>Check off actions as they are initiated:</Text>
              
              {snapshot.activeActions.map((action, idx) => {
                const isDone = !!completedActions[action];
                return (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.7}
                    style={styles.checklistRow}
                    onPress={() => toggleAction(action)}
                  >
                    <View style={[styles.checkbox, isDone && styles.checkboxChecked]}>
                      {isDone && <CheckCircle size={12} color="#FFFFFF" />}
                    </View>
                    <Text style={[styles.checklistText, isDone && styles.checklistTextChecked]}>
                      {action}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Reassessment / Disposition */}
          {showDisposition && (
            <View style={[styles.alertBlock, styles.alertBlockTeal]}>
              <View style={styles.alertHeader}>
                <CheckCircle color="#10B981" size={15} />
                <Text style={[styles.alertTitle, styles.textTeal]}>DISPOSITION CRITERIA</Text>
              </View>
              {(currentNode.dispositionCriteria || patientFlow.dispositionReadinessItems).map((crit, idx) => (
                <Text key={idx} style={[styles.alertText, { color: '#E2E8F0' }]}>• {crit}</Text>
              ))}
            </View>
          )}

          {/* Normal Node Reassessments */}
          {!showDisposition && currentNode.reassess && currentNode.reassess.length > 0 && (
            <View style={styles.referenceSection}>
              <Text style={[styles.sectionHeading, { color: '#818CF8' }]}>REASSESSMENT CHECKPOINTS</Text>
              {currentNode.reassess.map((re, idx) => (
                <Text key={idx} style={styles.reassessText}>• {re}</Text>
              ))}
            </View>
          )}

          {!showAttendingTrigger && !showCantMiss && !showWorkup && !showDisposition && (
            <View style={styles.emptySafeguards}>
              <Compass color="#475569" size={32} />
              <Text style={styles.emptySafeguardsText}>Navigate the pathway nodes to populate clinical recommendations, safeguards, and active care tasks.</Text>
            </View>
          )}
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
  const renderDesktop = () => (
    <View style={styles.desktopContainer}>
      <View style={styles.sidebarColumn}>
        {renderLeftPanel()}
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
      </View>
      <View style={styles.sidebarColumn}>
        {renderRightPanel()}
      </View>
    </View>
  );

  // Main Mobile Render
  const renderMobile = () => {
    return (
      <View style={styles.mobileContainer}>
        {/* Mobile Header Context Summary */}
        <View style={styles.mobileHeaderSummary}>
          <View style={styles.mobileSummaryLeft}>
            <Text style={styles.mobileSummaryTitle}>{pathway.title}</Text>
            <Text style={styles.mobileSummaryContext}>
              {ageDescription} presenting with "{patient.complaint || 'symptom'}" ({patient.appearance})
            </Text>
          </View>
          <View style={styles.mobileSummaryRight}>
            <Text style={styles.mobileSummaryNodeText}>{currentNode.title}</Text>
          </View>
        </View>

        {/* View switching based on active Mobile Tab */}
        <View style={styles.mobileMainArea}>
          {mobileTab === 'context' && renderLeftPanel()}
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
            </View>
          )}
          {mobileTab === 'safeguards' && renderRightPanel()}
        </View>

        {/* Mobile Navigation Tabs */}
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
});
