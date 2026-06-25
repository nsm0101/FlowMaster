import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardList, GitBranch, RefreshCcw, Search, Stethoscope } from 'lucide-react';
import { createSnapshot, getNode, makeDecisionStep, matchPathways } from './engine/pathwayEngine';
import { getPathwayById, pathwayRegistry } from './pathways';
import type { DecisionStep, NormalizedPatientFlowState, PatientContext } from './types/flowmaster';

const emptyPatient: PatientContext = { complaint: '', age: 5, unit: 'years', appearance: 'well', notes: '' };

const createDemoFlowState = (patient: PatientContext, pathwayTitle: string, acuity: NormalizedPatientFlowState['acuity']): NormalizedPatientFlowState => ({
  identity: {
    patientId: 'demo-patient',
    encounterId: 'demo-encounter',
    initials: 'DEMO',
  },
  encounter: {
    encounterId: 'demo-encounter',
    trackingStatus: 'Manual MVP',
    locationSource: 'manual',
  },
  room: 'TBD',
  chiefComplaint: patient.complaint || pathwayTitle,
  age: {
    value: patient.age,
    unit: patient.unit,
  },
  acuity,
  status: patient.appearance === 'unstable' || patient.appearance === 'toxic' ? 'needs-provider' : 'active',
  phase: 'initial-assessment',
  nextAction: {
    label: 'Use pathway to identify the next care-advancing action',
    ownerRole: 'attending',
    source: 'pathway',
    confidence: 'needs-review',
  },
  owner: {
    role: 'attending',
    source: 'manual',
  },
  dispositionTarget: 'undecided',
  review: {},
  sourceLabels: ['manual', 'pathway'],
  updatedAt: new Date().toISOString(),
});

function Tag({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}

function Panel({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return <section className="panel"><h3>{icon}{title}</h3>{children}</section>;
}

function List({ items }: { items?: string[] }) {
  return items?.length ? <ul className="tight">{items.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="muted">None listed.</p>;
}

export default function App() {
  const [patient, setPatient] = useState<PatientContext>(emptyPatient);
  const [pathwayId, setPathwayId] = useState(pathwayRegistry[0].id);
  const pathway = getPathwayById(pathwayId);
  const [nodeId, setNodeId] = useState(pathway.startNodeId);
  const [history, setHistory] = useState<DecisionStep[]>([]);
  const [query, setQuery] = useState('');

  const currentNode = getNode(pathway, nodeId);
  const snapshot = createSnapshot(pathway, currentNode, patient, history);
  const flowState = useMemo(() => createDemoFlowState(patient, pathway.title, pathway.acuity), [patient, pathway.title, pathway.acuity]);
  const matchedPathways = useMemo(() => matchPathways(pathwayRegistry, patient.complaint), [patient.complaint]);
  const visiblePathways = matchedPathways.length ? matchedPathways : pathwayRegistry;
  const searchNodes = Object.values(pathway.nodes).filter((node) =>
    [node.title, node.prompt, ...(node.actions ?? []), ...(node.cantMiss ?? []), ...(node.dispositionCriteria ?? [])]
      .join(' ')
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  function selectPathway(id: string) {
    const next = getPathwayById(id);
    setPathwayId(id);
    setNodeId(next.startNodeId);
    setHistory([]);
  }

  function choose(option: NonNullable<typeof currentNode.options>[number]) {
    const step = makeDecisionStep(pathway, currentNode, option.label, option.next, option.flags ?? [], option.actions ?? []);
    setHistory((prior) => [...prior, step]);
    setNodeId(option.next);
  }

  function back() {
    const prior = history[history.length - 1];
    setHistory((items) => items.slice(0, -1));
    if (prior) setNodeId(prior.nodeId);
  }

  function reset() {
    setNodeId(pathway.startNodeId);
    setHistory([]);
  }

  return <div className="app">
    <header className="hero">
      <div>
        <p className="eyebrow">PEM FlowMaster MVP</p>
        <h1>PEM FlowMaster</h1>
        <p>Pediatric ED pathway navigator: chief complaint + age/risk context → danger screen → can’t-miss diagnoses → workup → reassessment → disposition.</p>
      </div>
      <div className="heroCard"><Stethoscope /><b>Clinical safety layer</b><span>ABCDE → branch → workup → reassess → disposition</span></div>
    </header>

    <main className="grid">
      <aside className="left">
        <Panel title="Patient context" icon={<ClipboardList />}>
          <label>Chief complaint<input value={patient.complaint} onChange={(e) => setPatient({ ...patient, complaint: e.target.value })} placeholder="fever, limp, seizure..." /></label>
          <div className="row">
            <label>Age<input type="number" value={patient.age} onChange={(e) => setPatient({ ...patient, age: Number(e.target.value) })} /></label>
            <label>Unit<select value={patient.unit} onChange={(e) => setPatient({ ...patient, unit: e.target.value as PatientContext['unit'] })}><option>days</option><option>months</option><option>years</option></select></label>
          </div>
          <div className="row">
            <label>Wt kg<input type="number" value={patient.weightKg ?? ''} onChange={(e) => setPatient({ ...patient, weightKg: e.target.value ? Number(e.target.value) : undefined })} /></label>
            <label>SpO2<input type="number" value={patient.spo2 ?? ''} onChange={(e) => setPatient({ ...patient, spo2: e.target.value ? Number(e.target.value) : undefined })} /></label>
          </div>
          <label>Appearance<select value={patient.appearance} onChange={(e) => setPatient({ ...patient, appearance: e.target.value as PatientContext['appearance'] })}><option>well</option><option>ill</option><option>toxic</option><option>unstable</option></select></label>
          <label>Notes<textarea value={patient.notes} onChange={(e) => setPatient({ ...patient, notes: e.target.value })} /></label>
          <div className="mini"><Tag tone="blue">Age band: {snapshot.ageBand}</Tag>{patient.weightKg && <Tag>{patient.weightKg} kg</Tag>}</div>
        </Panel>

        <Panel title="Pathways" icon={<GitBranch />}>
          {visiblePathways.map((item) => <button key={item.id} onClick={() => selectPathway(item.id)} className={`pathBtn ${item.id === pathway.id ? 'active' : ''}`}><b>{item.title}</b><span>{item.chiefComplaints.slice(0, 3).join(' · ')}</span></button>)}
        </Panel>
      </aside>

      <section className="center">
        <div className="pathHeader"><div><h2>{pathway.title}</h2><p>{pathway.warning}</p></div><div className="mini"><Tag tone={pathway.acuity === 'emergent' || pathway.acuity === 'critical' ? 'danger' : 'warn'}>{pathway.acuity}</Tag>{pathway.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</div></div>

        <article className={`node ${currentNode.type === 'terminal' ? 'terminal' : ''}`}>
          <p className="nodeType">{currentNode.type}</p>
          <h2>{currentNode.title}</h2>
          <p className="prompt">{currentNode.prompt}</p>
          {currentNode.options?.length ? <div className="options">{currentNode.options.map((option) => <button key={option.label} onClick={() => choose(option)}>{option.label}</button>)}</div> : <div className="done"><CheckCircle2 /> Terminal node reached</div>}
          <div className="controls"><button onClick={back} disabled={!history.length}><ArrowLeft /> Back</button><button onClick={reset}><RefreshCcw /> Reset</button></div>
        </article>

        <div className="twoCol"><Panel title="Actions now" icon={<ClipboardList />}><List items={currentNode.actions} /></Panel><Panel title="Reassessment" icon={<AlertTriangle />}><List items={currentNode.reassess} /></Panel></div>
        <Panel title="Disposition criteria"><List items={currentNode.dispositionCriteria} /></Panel>
        <Panel title="Search current pathway" icon={<Search />}><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search nodes, actions, diagnoses" />{query && <div className="searchResults">{searchNodes.map((node) => <button key={node.id} onClick={() => setNodeId(node.id)}>{node.title}<span>{node.prompt}</span></button>)}</div>}</Panel>
      </section>

      <aside className="right">
        <Panel title="Can’t miss" icon={<AlertTriangle />}><List items={snapshot.cantMiss} /></Panel>
        <Panel title="Flow state model">
          <div className="flowFacts">
            <span><b>Phase</b>{flowState.phase}</span>
            <span><b>Status</b>{flowState.status}</span>
            <span><b>Owner</b>{flowState.owner?.role ?? 'unknown'}</span>
            <span><b>Dispo</b>{flowState.dispositionTarget}</span>
          </div>
          <p className="muted">{flowState.nextAction?.label}</p>
          <div className="mini">{flowState.sourceLabels.map((source) => <Tag key={source}>{source}</Tag>)}</div>
        </Panel>
        <Panel title="Active tasks"><List items={snapshot.activeActions} /></Panel>
        <Panel title="Flags">{snapshot.activeFlags.length ? snapshot.activeFlags.map((flag) => <Tag key={flag} tone="danger">{flag}</Tag>) : <p className="muted">No active flags.</p>}</Panel>
        <Panel title="Attending triggers"><List items={snapshot.attendingTriggers} /></Panel>
        <Panel title="Timeline">{history.length ? <ol className="timeline">{history.map((step, index) => <li key={index}><b>{step.nodeTitle}</b><span>{step.answer} · {step.at}</span></li>)}</ol> : <p className="muted">No decisions yet.</p>}</Panel>
      </aside>
    </main>

    <footer>This tool supports clinician decision-making and does not replace clinical judgment, local policy, or attending supervision.</footer>
  </div>;
}
