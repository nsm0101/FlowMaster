import { BellRing, ClipboardCheck, Clock3, ListChecks, Map, PlayCircle, UserRoundCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

type Actionability = 'Ready now' | 'Needs review' | 'Blocked' | 'Snoozed';

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

type PanelProps = {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
};

type TagProps = {
  children: ReactNode;
  tone?: string;
};

const actionabilityOrder: Actionability[] = ['Ready now', 'Needs review', 'Blocked', 'Snoozed'];
const roadmapSteps = ['Danger screen', 'Workup', 'Reassessment', 'Disposition'];

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

function Panel({ title, icon, children }: PanelProps) {
  return <section className="panel"><h3>{icon}{title}</h3>{children}</section>;
}

function Tag({ children, tone = 'neutral' }: TagProps) {
  return <span className={`tag ${tone}`}>{children}</span>;
}

function roomValue(room: string) {
  const value = Number.parseInt(room.replace(/\D/g, ''), 10);
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
}

function actionabilityTone(actionability: Actionability) {
  if (actionability === 'Ready now') return 'danger';
  if (actionability === 'Blocked') return 'warn';
  return 'blue';
}

export function DemoRoster() {
  const [roster, setRoster] = useState<DemoPatient[]>(initialRoster);

  const sortedRoster = useMemo(
    () => [...roster].sort((a, b) => roomValue(a.room) - roomValue(b.room) || a.room.localeCompare(b.room)),
    [roster]
  );
  const owners = useMemo(() => [...new Set(sortedRoster.map((item) => item.owner))], [sortedRoster]);
  const attentionGroups = useMemo(
    () => actionabilityOrder.map((group) => ({
      group,
      patients: sortedRoster.filter((item) => item.actionability === group),
    })).filter(({ patients }) => patients.length),
    [sortedRoster]
  );


  function updateRoster(id: string, patch: Partial<DemoPatient>) {
    setRoster((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function markReviewed(id: string) {
    updateRoster(id, { reviewed: true, actionability: 'Ready now', blocker: 'None' });
  }

  function snooze(id: string) {
    updateRoster(id, {
      actionability: 'Snoozed',
      snoozedUntil: '15 min',
      blocker: 'Snoozed for reassessment window',
    });
  }

  return <div className="demoSections">
    <Panel title="Attention queue" icon={<BellRing />}>
      <p className="muted">Grouped by actionability so a new actionable patient can rise above an older blocked workup.</p>
      <div className="attentionQueue">
        {attentionGroups.map(({ group, patients }) => <div className="queueGroup" key={group}>
          <h4>{group}</h4>
          {patients.map((item) => <button key={item.id} onClick={() => markReviewed(item.id)}>
            <b>Room {item.room}</b>
            <span>{item.nextAction}</span>
          </button>)}
        </div>)}
      </div>
    </Panel>

    <Panel title="Roadmap view" icon={<Map />}>
      <div className="roadmap">
        {roadmapSteps.map((step) => <div key={step} className="roadmapStep">
          <span>{step}</span>
          <b>{sortedRoster.filter((item) => item.phase.includes(step.split(' ')[0])).length}</b>
        </div>)}
      </div>
    </Panel>

    <Panel title="Running-the-list mode" icon={<ListChecks />}>
      <div className="rosterList">
        {sortedRoster.map((item) => <article className="patientCard" key={item.id}>
          <div className="patientCardTop">
            <div><p className="room">Room {item.room}</p><h3>{item.chiefComplaint}</h3></div>
            <Tag tone={actionabilityTone(item.actionability)}>{item.actionability}</Tag>
          </div>
          <dl>
            <div><dt>Age</dt><dd>{item.age}</dd></div>
            <div><dt>ED time</dt><dd>{item.edTime}</dd></div>
            <div><dt>Phase</dt><dd>{item.phase}</dd></div>
            <div><dt>Owner</dt><dd>{item.owner}</dd></div>
            <div className="wide"><dt>Next action</dt><dd>{item.nextAction}</dd></div>
            <div className="wide"><dt>Blocker</dt><dd>{item.blocker}</dd></div>
            <div className="wide"><dt>Dispo target</dt><dd>{item.dispoTarget}</dd></div>
          </dl>
          <div className="cardActions">
            <button onClick={() => markReviewed(item.id)}><ClipboardCheck /> Mark reviewed</button>
            <button onClick={() => snooze(item.id)}><Clock3 /> Snooze</button>
          </div>
          <div className="editGrid">
            <label>Next action<input value={item.nextAction} onChange={(event) => updateRoster(item.id, { nextAction: event.target.value, actionability: 'Ready now' })} /></label>
            <label>Owner<input value={item.owner} onChange={(event) => updateRoster(item.id, { owner: event.target.value })} /></label>
            <label>Disposition target<input value={item.dispoTarget} onChange={(event) => updateRoster(item.id, { dispoTarget: event.target.value })} /></label>
          </div>
        </article>)}
      </div>
    </Panel>

    <Panel title="MVP demo script" icon={<PlayCircle />}>
      <ol className="tight">
        <li>Start with the room-sorted roster and call out every patient in physical ED order.</li>
        <li>Open the attention queue to show why actionable items outrank blocked or snoozed patients.</li>
        <li>Use mark reviewed, set next action, snooze, assign owner, and update disposition target during the huddle.</li>
        <li>Close with the roadmap view: who is in danger screen, workup, reassessment, and disposition.</li>
      </ol>
    </Panel>

    <Panel title="Demo owners" icon={<UserRoundCheck />}>
      <ul className="tight">{owners.map((owner) => <li key={owner}>{owner}</li>)}</ul>
    </Panel>
  </div>;
}
