import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  GitBranch,
  ListChecks,
  Map,
  PlayCircle,
  RefreshCcw,
  Search,
  Stethoscope,
  UserRoundCheck,
} from 'lucide-react';
import { createSnapshot, getNode, makeDecisionStep, matchPathways } from './engine/pathwayEngine';
import { getPathwayById, pathwayRegistry } from './pathways';
import type { DecisionStep, PatientContext } from './types/flowmaster';

const emptyPatient: PatientContext = { complaint: '', age: 5, unit: 'years', appearance: 'well', notes: '' };

type Actionability = 'Ready now' | 'Blocked' | 'Snoozed' | 'Needs review';
type DemoPatient = {
  id: string;
  room: string;
  age: string;
  chiefComplaint: string;
  edTime: string;
  phase: string;
  nextAction: string;
  blocker: string;
  owner: string;
  dispoTarget: string;
  actionability: Actionability;
  reviewed: boolean;
  snoozedUntil?: string;
};

const actionabilityOrder: Actionability[] = ['Ready now', 'Needs review', 'Blocked', 'Snoozed'];

const initialRoster: DemoPatient[] = [
  {
    id: 'p1',
    room: '03',
    age: '7 mo',
    chiefComplaint: 'Fever, decreased intake',
    edTime: '0:42',
    phase: 'Danger screen',
    nextAction: 'Recheck perfusion + urine plan',
    blocker: 'Awaiting cath UA',
    owner: 'Nurse Lee',
    dispoTarget: 'Likely discharge if UA negative',
    actionability: 'Ready now',
    reviewed: false,
  },
  {
    id: 'p2',
    room: '08',
    age: '12 yr',
    chiefComplaint: 'RLQ abdominal pain',
    edTime: '2:18',
    phase: 'Workup',
    nextAction: 'Call ultrasound result to surgery if positive',
    blocker: 'US read pending',
    owner: 'Dr. Nguyen',
    dispoTarget: 'Surgery consult vs PO challenge',
    actionability: 'Blocked',
    reviewed: false,
  },
  {
    id: 'p3',
    room: '11',
    age: '4 yr',
    chiefComplaint: 'Wheeze',
    edTime: '1:06',
    phase: 'Reassessment',
    nextAction: 'Repeat respiratory score after neb',
    blocker: 'Snoozed for reassessment window',
    owner: 'RT Sam',
    dispoTarget: 'Discharge after 2 hr obs if stable',
    actionability: 'Snoozed',
    reviewed: true,
    snoozedUntil: '15 min',
  },
  {
    id: 'p4',
    room: '14',
    age: '16 yr',
    chiefComplaint: 'Syncope',
    edTime: '0:23',
    phase: 'Initial assessment',
    nextAction: 'Review ECG + red flags',
    blocker: 'None',
    owner: 'Unassigned',
    dispoTarget: 'Home if ECG normal and low risk',
    actionability: 'Needs review',
    reviewed: false,
  },
];

function Tag({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}

function Panel({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return <section className="panel"><h3>{icon}{title}</h3>{children}</section>;
}

function List({ items }: { items?: string[] }) {
  return items?.length ? <ul className="tight">{items.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="muted">None listed.</p>;
}

function roomValue(room: string) {
  const value = Number.parseInt(room.replace(/\D/g, ''), 10);
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
}

export default function App() {
  const [patient, setPatient] = useState<PatientContext>(emptyPatient);
  const [pathwayId, setPathwayId] = useState(pathwayRegistry[0].id);
  const pathway = getPathwayById(pathwayId);
  const [nodeId, setNodeId] = useState(pathway.startNodeId);
  const [history, setHistory] = useState<DecisionStep[]>([]);
  const [query, setQuery] = useState('');
  const [roster, setRoster] = useState<DemoPatient[]>(initialRoster);

  const currentNode = getNode(pathway, nodeId);
  const snapshot = createSnapshot(pathway, currentNode, patient, history);
  const matchedPathways = useMemo(() => matchPathways(pathwayRegistry, patient.complaint), [patient.complaint]);
  const visiblePathways = matchedPathways.length ? matchedPathways : pathwayRegistry;
  const sortedRoster = useMemo(() => [...roster].sort((a, b) => roomValue(a.room) - roomValue(b.room) || a.room.localeCompare(b.room)), [roster]);
  const attentionGroups = useMemo(() => actionabilityOrder.map((group) => ({
    group,
    patients: sortedRoster.filter((item) => item.actionability === group),
  })).filter(({ patients }) => patients.length), [sortedRoster]);
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

  function updateRoster(id: string, patch: Partial<DemoPatient>) {
    setRoster((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function markReviewed(id: string) {
    updateRoster(id, { reviewed: true, actionability: 'Ready now', blocker: 'None' });
  }

  function snooze(id: string) {
    updateRoster(id, { actionability: 'Snoozed', snoozedUntil: '15 min', blocker: 'Snoozed for reassessment window' });
  }

  return <div className="app">
    <header className="hero">
      <div>
        <p className="eyebrow">PEM FlowMaster MVP</p>
        <h1>PEM FlowMaster</h1>
        <p>Pediatric ED pathway navigator plus a manual demo roster: room-sorted list, actionability-first attention queue, roadmap view, and running-the-list mode for shift huddles.</p>
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

        <div className="demoSections">
          <Panel title="Attention queue" icon={<BellRing />}>
            <p className="muted">Grouped by actionability so a new actionable patient can rise above an older blocked workup.</p>
            <div className="attentionQueue">{attentionGroups.map(({ group, patients }) => <div className="queueGroup" key={group}><h4>{group}</h4>{patients.map((item) => <button key={item.id} onClick={() => markReviewed(item.id)}><b>Room {item.room}</b><span>{item.nextAction}</span></button>)}</div>)}</div>
          </Panel>

          <Panel title="Roadmap view" icon={<Map />}>
            <div className="roadmap">{['Danger screen', 'Workup', 'Reassessment', 'Disposition'].map((step) => <div key={step} className="roadmapStep"><span>{step}</span><b>{sortedRoster.filter((item) => item.phase.includes(step.split(' ')[0])).length}</b></div>)}</div>
          </Panel>

          <Panel title="Running-the-list mode" icon={<ListChecks />}>
            <div className="rosterList">{sortedRoster.map((item) => <article className="patientCard" key={item.id}>
              <div className="patientCardTop"><div><p className="room">Room {item.room}</p><h3>{item.chiefComplaint}</h3></div><Tag tone={item.actionability === 'Ready now' ? 'danger' : item.actionability === 'Blocked' ? 'warn' : 'blue'}>{item.actionability}</Tag></div>
              <dl>
                <div><dt>Age</dt><dd>{item.age}</dd></div><div><dt>ED time</dt><dd>{item.edTime}</dd></div><div><dt>Phase</dt><dd>{item.phase}</dd></div><div><dt>Owner</dt><dd>{item.owner}</dd></div>
                <div className="wide"><dt>Next action</dt><dd>{item.nextAction}</dd></div><div className="wide"><dt>Blocker</dt><dd>{item.blocker}</dd></div><div className="wide"><dt>Dispo target</dt><dd>{item.dispoTarget}</dd></div>
              </dl>
              <div className="cardActions">
                <button onClick={() => markReviewed(item.id)}><ClipboardCheck /> Mark reviewed</button>
                <button onClick={() => snooze(item.id)}><Clock3 /> Snooze</button>
              </div>
              <div className="editGrid">
                <label>Next action<input value={item.nextAction} onChange={(e) => updateRoster(item.id, { nextAction: e.target.value, actionability: 'Ready now' })} /></label>
                <label>Owner<input value={item.owner} onChange={(e) => updateRoster(item.id, { owner: e.target.value })} /></label>
                <label>Disposition target<input value={item.dispoTarget} onChange={(e) => updateRoster(item.id, { dispoTarget: e.target.value })} /></label>
              </div>
            </article>)}</div>
          </Panel>

          <Panel title="MVP demo script" icon={<PlayCircle />}>
            <ol className="tight">
              <li>Start with the room-sorted roster and call out every patient in physical ED order.</li>
              <li>Open the attention queue to show why actionable items outrank blocked or snoozed patients.</li>
              <li>Use mark reviewed, set next action, snooze, assign owner, and update disposition target during the huddle.</li>
              <li>Close with the roadmap view: who is in danger screen, workup, reassessment, and disposition.</li>
            </ol>
          </Panel>
        </div>

        <div className="twoCol"><Panel title="Actions now" icon={<ClipboardList />}><List items={currentNode.actions} /></Panel><Panel title="Reassessment" icon={<AlertTriangle />}><List items={currentNode.reassess} /></Panel></div>
        <Panel title="Disposition criteria"><List items={currentNode.dispositionCriteria} /></Panel>
        <Panel title="Search current pathway" icon={<Search />}><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search nodes, actions, diagnoses" />{query && <div className="searchResults">{searchNodes.map((node) => <button key={node.id} onClick={() => setNodeId(node.id)}>{node.title}<span>{node.prompt}</span></button>)}</div>}</Panel>
      </section>

      <aside className="right">
        <Panel title="Can’t miss" icon={<AlertTriangle />}><List items={snapshot.cantMiss} /></Panel>
        <Panel title="Active tasks"><List items={snapshot.activeActions} /></Panel>
        <Panel title="Flags">{snapshot.activeFlags.length ? snapshot.activeFlags.map((flag) => <Tag key={flag} tone="danger">{flag}</Tag>) : <p className="muted">No active flags.</p>}</Panel>
        <Panel title="Attending triggers"><List items={snapshot.attendingTriggers} /></Panel>
        <Panel title="Timeline">{history.length ? <ol className="timeline">{history.map((step, index) => <li key={index}><b>{step.nodeTitle}</b><span>{step.answer} · {step.at}</span></li>)}</ol> : <p className="muted">No decisions yet.</p>}</Panel>
        <Panel title="Demo owners" icon={<UserRoundCheck />}><List items={[...new Set(sortedRoster.map((item) => item.owner))]} /></Panel>
      </aside>
    </main>

    <footer>This tool supports clinician decision-making and does not replace clinical judgment, local policy, or attending supervision.</footer>
  </div>;
}
