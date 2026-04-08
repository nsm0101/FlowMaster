/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Patient, TaskState, MedsConsultState, PatientStatus, TeamMember } from '../types';
import { cn, getStatusStyle, getStatusSymbol, getSeenBorderStyle, getStatusGradient, getTimerColor, getRoleColor } from '../lib/utils';
import { 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  Users, 
  ChevronDown, 
  ChevronUp, 
  MoreHorizontal, 
  Pin, 
  PinOff,
  FlaskConical,
  Image as ImageIcon,
  Pill,
  Stethoscope,
  Edit2,
  X,
  RotateCcw,
  FileText,
  Home,
  Bed,
  Calendar,
  StickyNote,
  Phone,
  MessageSquare,
  Bell,
  Users2,
  Plus
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useDroppable } from '@dnd-kit/core';
import { motion, AnimatePresence } from 'motion/react';
import { RadialStatusMenu } from './RadialStatusMenu';
import { RadialTeamMenu } from './RadialTeamMenu';

interface PatientCardProps {
  patient: Patient;
  onUpdate: (id: string, updates: Partial<Patient>) => void;
  onResetTimer: (id: string) => void;
  onDelete: (id: string) => void;
  onComplete: (id: string) => void;
  colorBlindMode?: boolean;
  compactMode?: boolean;
  teamMembers?: TeamMember[];
  darkMode?: boolean;
}

export const PatientCard: React.FC<PatientCardProps> = ({ 
  patient, 
  onUpdate, 
  onResetTimer, 
  onDelete,
  onComplete,
  colorBlindMode = false,
  compactMode = false,
  teamMembers = [],
  darkMode = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [elapsed, setElapsed] = useState<number>(0);
  const [radialMenuOpen, setRadialMenuOpen] = useState(false);
  const [radialMenuPos, setRadialMenuPos] = useState({ x: 0, y: 0 });
  const [teamMenuOpen, setTeamMenuOpen] = useState(false);
  const [teamMenuPos, setTeamMenuPos] = useState({ x: 0, y: 0 });

  const { setNodeRef, isOver } = useDroppable({
    id: patient.id,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const seconds = Math.floor((Date.now() - patient.lastAssessmentAt.toMillis()) / 1000);
      setElapsed(seconds);
    }, 1000);
    return () => clearInterval(interval);
  }, [patient.lastAssessmentAt]);

  const handleStatusPointerDown = (e: React.PointerEvent) => {
    // Ignore if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (
      target.closest('button') || 
      target.closest('textarea') || 
      target.closest('select') || 
      target.closest('input') ||
      target.closest('[data-interactive="true"]')
    ) {
      return;
    }

    setRadialMenuPos({ x: e.clientX, y: e.clientY });
    setRadialMenuOpen(true);
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    // Context menu now only for non-status actions if needed, 
    // but user wants radial for status.
  };

  const handleCardClick = (e: React.MouseEvent) => {
    setIsExpanded(!isExpanded);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleTask = (task: keyof Patient['tasks']) => {
    if (navigator.vibrate) navigator.vibrate(5);
    const current = patient.tasks[task];
    let next: TaskState | MedsConsultState = 'off';

    if (task === 'labs' || task === 'imaging') {
      const states: TaskState[] = ['off', 'ordered', 'pending', 'complete', 'none'];
      const idx = states.indexOf(current as TaskState);
      next = states[(idx + 1) % states.length];
    } else {
      const states: MedsConsultState[] = ['off', 'ordered', 'pending', 'complete', 'none'];
      const idx = states.indexOf(current as MedsConsultState);
      next = states[(idx + 1) % states.length];
    }

    onUpdate(patient.id, {
      tasks: { ...patient.tasks, [task]: next }
    });
  };

  const toggleDischargeTask = (task: keyof NonNullable<Patient['dischargeTasks']>) => {
    const currentTasks = patient.dischargeTasks || { instructions: 'off', rx: 'off', followUp: 'off', notes: 'off' };
    const current = currentTasks[task];
    let next: any;

    if (task === 'rx') {
      const states: ('off' | 'home' | 'facility' | 'none')[] = ['off', 'home', 'facility', 'none'];
      const idx = states.indexOf(current as any);
      next = states[(idx + 1) % states.length];
    } else if (task === 'instructions' || task === 'followUp') {
      const states: TaskState[] = ['off', 'complete'];
      const idx = states.indexOf(current as TaskState);
      next = states[(idx + 1) % states.length];
    } else {
      const states: TaskState[] = ['off', 'pending', 'complete', 'none'];
      const idx = states.indexOf(current as TaskState);
      next = states[(idx + 1) % states.length];
    }

    onUpdate(patient.id, {
      dischargeTasks: { ...currentTasks, [task]: next }
    });
  };

  const toggleAdmitTask = (task: keyof NonNullable<Patient['admitTasks']>) => {
    const currentTasks = patient.admitTasks || { familyUpdate: 'off', page: 'off', handoff: 'off', secureChat: 'off' };
    const current = currentTasks[task];
    const states: TaskState[] = ['off', 'complete'];
    const idx = states.indexOf(current as TaskState);
    const next = states[(idx + 1) % states.length];

    onUpdate(patient.id, {
      admitTasks: { ...currentTasks, [task]: next }
    });
  };

  const toggleObsTask = (task: keyof NonNullable<Patient['obsTasks']>) => {
    const currentTasks = patient.obsTasks || { obsAdmitNote: 'off', obsDCNote: 'off' };
    const current = currentTasks[task];
    const states: TaskState[] = ['off', 'complete'];
    const idx = states.indexOf(current as TaskState);
    const next = states[(idx + 1) % states.length];

    onUpdate(patient.id, {
      obsTasks: { ...currentTasks, [task]: next }
    });
  };

  const toggleSeenState = (e: React.MouseEvent) => {
    e.stopPropagation();
    const states: Patient['seenState'][] = ['To Be Seen', 'Seen by Fellow', 'Seen by Attending'];
    const idx = states.indexOf(patient.seenState);
    const next = states[(idx + 1) % states.length];
    onUpdate(patient.id, { seenState: next });
  };

  const getTaskIcon = (task: keyof Patient['tasks'], state: TaskState | MedsConsultState, size: number = 18) => {
    let icon;
    switch (task) {
      case 'labs': icon = <FlaskConical size={size} />; break;
      case 'imaging': icon = <ImageIcon size={size} />; break;
      case 'meds': icon = <Pill size={size} />; break;
      case 'consult': icon = <Stethoscope size={size} />; break;
    }

    if (state === 'none') {
      return (
        <div className="relative flex items-center justify-center">
          <div className="opacity-40">{icon}</div>
          <div className="absolute w-full h-0.5 bg-red-500 rotate-45" />
        </div>
      );
    }
    return icon;
  };

  const getDischargeTaskIcon = (task: keyof NonNullable<Patient['dischargeTasks']>, state: any, size: number = 18) => {
    let icon;
    switch (task) {
      case 'instructions': 
        icon = (
          <div className="relative">
            <FileText size={size} />
            <div className="absolute -bottom-1 -right-1 bg-white dark:bg-gray-800 rounded-full p-0.5 shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
              <Home size={size * 0.5} className="text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        ); 
        break;
      case 'rx': 
        if (state === 'home') return <div className="flex items-center gap-0.5"><Home size={size * 0.8} /><Pill size={size * 0.7} /></div>;
        if (state === 'facility') return <div className="flex items-center gap-0.5"><Bed size={size * 0.8} /><Pill size={size * 0.7} /></div>;
        icon = <Pill size={size} />;
        break;
      case 'followUp': icon = <Calendar size={size} />; break;
      case 'notes': icon = <StickyNote size={size} />; break;
    }

    if (state === 'none') {
      return (
        <div className="relative flex items-center justify-center">
          <div className="opacity-40">{icon}</div>
          <div className="absolute w-full h-0.5 bg-red-500 rotate-45" />
        </div>
      );
    }
    return icon;
  };

  const getAdmitTaskIcon = (task: keyof NonNullable<Patient['admitTasks']>, state: any, size: number = 18) => {
    let icon;
    switch (task) {
      case 'familyUpdate': icon = <Users2 size={size} />; break;
      case 'page': icon = <Bell size={size} />; break;
      case 'handoff': icon = <Phone size={size} />; break;
      case 'secureChat': icon = <MessageSquare size={size} />; break;
    }
    return icon;
  };

  const getObsTaskIcon = (task: keyof NonNullable<Patient['obsTasks']>, state: any, size: number = 18) => {
    let icon;
    switch (task) {
      case 'obsAdmitNote': 
        icon = (
          <div className="flex items-center gap-0.5 relative">
            <StickyNote size={size} />
            <span className="absolute -bottom-1 -right-1 text-[7px] font-black bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded px-0.5 border border-gray-100 dark:border-gray-700 transition-colors">A</span>
          </div>
        ); 
        break;
      case 'obsDCNote': 
        icon = (
          <div className="flex items-center gap-0.5 relative">
            <StickyNote size={size} />
            <span className="absolute -bottom-1 -right-1 text-[7px] font-black bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded px-0.5 border border-gray-100 dark:border-gray-700 transition-colors">D</span>
          </div>
        ); 
        break;
    }
    return icon;
  };

  const getTaskStyle = (state: TaskState | MedsConsultState | 'home' | 'facility' | 'none') => {
    switch (state) {
      case 'ordered': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800/50';
      case 'pending': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-500 border-yellow-300 dark:border-yellow-800/50';
      case 'complete': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-300 dark:border-green-800/50';
      case 'home': return 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/50';
      case 'facility': return 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/50';
      case 'none': return 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-300 dark:border-gray-700';
      default: return 'bg-gray-50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700';
    }
  };

  const assignedMembers = teamMembers.filter(m => patient.assignedTeam.includes(m.id));

  const defaultDischargeTasks: NonNullable<Patient['dischargeTasks']> = {
    instructions: 'off',
    rx: 'off',
    followUp: 'off',
    notes: 'off'
  };
  const dischargeTasks = patient.dischargeTasks || defaultDischargeTasks;
  const isGoodToGo = patient.status === 'Discharge' && 
    patient.seenState === 'Seen by Attending' &&
    (dischargeTasks.instructions === 'complete' || dischargeTasks.instructions === 'none') &&
    (dischargeTasks.rx === 'home' || dischargeTasks.rx === 'facility' || dischargeTasks.rx === 'none') &&
    (dischargeTasks.followUp === 'complete' || dischargeTasks.followUp === 'none');

  return (
    <motion.div 
      ref={setNodeRef}
      animate={isGoodToGo ? {
        boxShadow: ["0px 0px 0px rgba(34, 197, 94, 0)", "0px 0px 30px rgba(34, 197, 94, 0.5)", "0px 0px 0px rgba(34, 197, 94, 0)"],
        transition: { repeat: Infinity, duration: 1.5 }
      } : (patient.status === 'New' && !patient.isCompleted ? {
        y: [0, -4, 0],
        scale: [1, 1.005, 1],
        transition: { 
          y: { repeat: Infinity, duration: 3, ease: "easeInOut" },
          scale: { repeat: Infinity, duration: 3, ease: "easeInOut" }
        }
      } : {})}
      whileHover={{ y: -2, scale: 1.005, transition: { duration: 0.2 } }}
      onContextMenu={handleContextMenu}
      className={cn(
        "group rounded-xl shadow-sm mb-4 transition-all relative touch-pan-y w-full max-w-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 overflow-visible active:shadow-lg",
        getSeenBorderStyle(patient.seenState),
        patient.isPinned && "ring-2 ring-yellow-400 dark:ring-yellow-500",
        patient.isCompleted && "opacity-60 grayscale-[0.5]",
        isOver && "ring-4 ring-blue-400 dark:ring-blue-500 scale-[1.01] z-20",
        isGoodToGo && "border-green-500 dark:border-green-400 border-2"
      )}
    >
      {/* Radial Team Assignment Menu */}
      <RadialTeamMenu 
        isOpen={teamMenuOpen}
        onClose={() => setTeamMenuOpen(false)}
        onSelect={(memberId) => {
          if (!patient.assignedTeam.includes(memberId)) {
            onUpdate(patient.id, { assignedTeam: [...patient.assignedTeam, memberId] });
          }
        }}
        teamMembers={teamMembers}
        centerX={teamMenuPos.x}
        centerY={teamMenuPos.y}
        darkMode={darkMode}
      />

      {/* Radial Status Menu */}
      <RadialStatusMenu 
        isOpen={radialMenuOpen}
        onClose={() => setRadialMenuOpen(false)}
        onSelect={(status) => onUpdate(patient.id, { status })}
        currentStatus={patient.status}
        centerX={radialMenuPos.x}
        centerY={radialMenuPos.y}
        darkMode={darkMode}
      />

      {/* Top Status Gradient Background */}
      <div className={cn("absolute top-0 left-0 right-0 h-14 rounded-t-xl pointer-events-none opacity-40", getStatusGradient(patient.status))} />

      {isGoodToGo && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden rounded-xl z-0 bg-green-50/20">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ 
              scale: [1, 1.1, 1],
              opacity: [0.1, 0.2, 0.1],
            }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className={cn(
              "font-black text-green-600 uppercase tracking-tighter rotate-[-12deg] whitespace-nowrap select-none flex flex-col leading-none",
              compactMode ? "text-[40px] md:text-[60px]" : "text-[60px] md:text-[100px]"
            )}
          >
            <span>GOOD TO GO!</span>
            <span className="ml-20">GOOD TO GO!</span>
          </motion.div>
        </div>
      )}

      {/* Pin Icon - Center Left */}
      <button 
        onClick={(e) => { e.stopPropagation(); onUpdate(patient.id, { isPinned: !patient.isPinned }); }}
        className={cn(
          "absolute w-7 h-7 rounded-xl flex items-center justify-center transition-all z-30 border-2 border-white dark:border-gray-900",
          "top-1/2 -translate-y-1/2 -left-3 shadow-md",
          patient.isPinned 
            ? "bg-yellow-400 dark:bg-yellow-500 text-yellow-900 scale-110 rotate-12 shadow-yellow-200 dark:shadow-yellow-900/50 opacity-100" 
            : "bg-white/80 dark:bg-gray-800/80 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 opacity-0 group-hover:opacity-100"
        )}
      >
        <Pin size={12} className={cn(patient.isPinned && "fill-current")} />
      </button>

      {/* Team Icons - Floating Top Center on Desktop, Top Right on Mobile */}
      <div className={cn(
        "absolute flex items-center gap-1 z-30 transition-all",
        "md:-top-[18px] md:left-1/2 md:-translate-x-1/2 -top-3 right-10"
      )}>
        {assignedMembers.map(m => (
          <div 
            key={m.id}
            className={cn(
              "w-9 h-9 rounded-full border-2 border-white dark:border-gray-900 flex flex-col items-center justify-center text-[9px] font-black shadow-lg transition-transform hover:scale-110 hover:z-40 relative overflow-hidden",
              getRoleColor(m.role)
            )}
            title={`${m.firstName} ${m.lastName} (${m.role})`}
          >
            {m.avatarUrl || m.emoji ? (
              <div className="w-full h-full flex items-center justify-center bg-white dark:bg-gray-800">
                {m.avatarUrl ? (
                  <img src={m.avatarUrl} alt={m.initials} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg">{m.emoji}</span>
                )}
              </div>
            ) : (
              m.initials
            )}
            {(m.avatarUrl || m.emoji) && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[6px] text-white font-black py-0.5 text-center">
                {m.initials}
              </div>
            )}
          </div>
        ))}
        {assignedMembers.length === 0 && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              setTeamMenuPos({ x: e.clientX, y: e.clientY });
              setTeamMenuOpen(true);
            }}
            className="w-9 h-9 rounded-full border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-300 dark:text-gray-600 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm hover:text-blue-500 hover:border-blue-300 transition-colors"
          >
            <Plus size={16} />
          </motion.button>
        )}
      </div>

        <div 
          className={cn(
            "flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4 relative z-10 touch-none",
            compactMode ? "p-1.5" : "p-3"
          )}
        >
        {/* Left Section: Room & Initials */}
        <div className="flex items-center gap-3 md:gap-4 md:pl-8">
          {/* Overlapping Room Box - Top Left on Desktop */}
          <div className={cn(
            "flex flex-col items-center justify-center bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-100 dark:border-gray-700 shadow-lg shrink-0 z-20 transition-all",
            "md:absolute md:-top-4 md:-left-4 md:ml-0 -ml-6 relative",
            compactMode ? "w-10 h-10" : "w-14 h-14"
          )}>
            {!compactMode && <span className="text-[8px] font-black text-gray-400 dark:text-gray-500 uppercase leading-none mb-0.5">Room</span>}
            <span className={cn("font-black text-gray-900 dark:text-white leading-none", compactMode ? "text-sm" : "text-xl")}>{patient.room}</span>
          </div>
          
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("font-black text-gray-900 dark:text-white tracking-tight truncate", compactMode ? "text-sm" : "text-xl")}>{patient.initials}</span>
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-md transition-colors">
                <span className={cn("font-bold text-gray-400 dark:text-gray-500", compactMode ? "text-[10px]" : "text-xs")}>{patient.age}y</span>
                <span className="text-[10px] font-black text-gray-300 dark:text-gray-600">/</span>
                <span className={cn(
                  "font-black",
                  compactMode ? "text-[10px]" : "text-xs",
                  patient.sex === 'M' ? "text-blue-500 dark:text-blue-400" : patient.sex === 'F' ? "text-pink-500 dark:text-pink-400" : "text-purple-500 dark:text-purple-400"
                )}>
                  {patient.sex}
                </span>
              </div>
              {patient.isCompleted && (
                <div className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-md text-[8px] md:text-[10px] font-black uppercase flex items-center gap-1">
                  <CheckCircle2 size={compactMode ? 8 : 10} /> Done
                </div>
              )}
            </div>
            
            {/* Chief Complaint & Status Row */}
            <div className="flex items-start gap-2 mt-1">
              <textarea 
                className={cn(
                  "flex-1 bg-transparent border-none focus:ring-0 font-bold text-gray-500 dark:text-gray-400 resize-none no-scrollbar leading-tight",
                  compactMode ? "text-[9px]" : "text-[11px]"
                )}
                rows={2}
                placeholder="Chief Complaint..."
                value={patient.chiefComplaint || ''}
                onChange={(e) => onUpdate(patient.id, { chiefComplaint: e.target.value })}
                onClick={(e) => e.stopPropagation()}
              />
              
              <motion.div 
                onPointerDown={handleStatusPointerDown}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "flex-1 rounded-xl font-black uppercase tracking-wider border shadow-sm cursor-pointer active:brightness-90 transition-all flex items-center justify-center text-center", 
                  compactMode ? "text-[8px] h-8" : "text-[10px] h-10",
                  getStatusStyle(patient.status)
                )}
              >
                {colorBlindMode && <span className="mr-1">{getStatusSymbol(patient.status)}</span>}
                {patient.status}
              </motion.div>
            </div>

            {/* Mobile Operational Notes - Shared space below */}
            <textarea 
              className={cn(
                "w-full md:hidden bg-gray-50/50 dark:bg-gray-800/30 rounded-lg p-1.5 border-none focus:ring-0 font-bold text-gray-800 dark:text-gray-200 resize-none no-scrollbar leading-tight mt-1",
                compactMode ? "text-[9px]" : "text-[11px]"
              )}
              rows={2}
              placeholder="Operational notes..."
              value={patient.operationalNotes || ''}
              onChange={(e) => onUpdate(patient.id, { operationalNotes: e.target.value })}
              onClick={(e) => e.stopPropagation()}
            />

            <div className="flex items-center gap-1.5 mt-0.5">
              {patient.workflowFlags?.boarding && (
                <div className={cn(
                  "px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider border shadow-sm w-fit bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/50 flex items-center gap-1",
                  compactMode ? "text-[7px]" : "text-[9px]"
                )}>
                  <Bed size={compactMode ? 8 : 10} />
                  BOARDING
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Middle Section: Operational Notes (Desktop) */}
        <div className="flex-[1.2] flex items-stretch justify-center px-4 min-w-0 self-stretch">
          <textarea 
            className={cn(
              "hidden md:block w-full bg-transparent border-none focus:ring-0 font-bold text-gray-800 dark:text-gray-200 resize-none no-scrollbar text-center leading-tight h-full py-2",
              compactMode ? "text-[10px]" : "text-xs"
            )}
            rows={2}
            placeholder="Operational notes..."
            value={patient.operationalNotes || ''}
            onChange={(e) => onUpdate(patient.id, { operationalNotes: e.target.value })}
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Right Section: Tasks, Seen Toggle & Timer */}
        <div className="flex flex-col md:items-end gap-1.5">
          {/* Workup Toggles Row */}
          <div className="flex items-center gap-1 flex-wrap justify-start md:justify-end">
            {(['labs', 'imaging', 'meds', 'consult'] as const).map(task => (
              <motion.button
                key={`${task}-${patient.tasks[task]}`}
                whileTap={{ scale: 0.85 }}
                initial={patient.tasks[task] === 'complete' ? { scale: 1.2, filter: "brightness(1.5)" } : false}
                animate={{ scale: 1, filter: "brightness(1)" }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                onClick={(e) => { e.stopPropagation(); toggleTask(task); }}
                className={cn(
                  "rounded-xl border-2 flex items-center justify-center transition-all relative shadow-sm",
                  compactMode ? "w-10 h-10" : "w-12 h-12",
                  getTaskStyle(patient.tasks[task])
                )}
                title={task.charAt(0).toUpperCase() + task.slice(1)}
              >
                {getTaskIcon(task, patient.tasks[task], compactMode ? 16 : 22)}
                {patient.tasks[task] === 'pending' && (
                  <motion.div 
                    animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className={cn("absolute -top-1 -right-1 bg-yellow-400 rounded-full border-2 border-white shadow-sm", compactMode ? "w-3 h-3" : "w-4 h-4")} 
                  />
                )}
                {patient.tasks[task] === 'complete' && (
                  <motion.div
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 15 }}
                    className="absolute -top-1.5 -right-1.5 bg-green-500 rounded-full border-2 border-white shadow-md w-4 h-4 flex items-center justify-center"
                  >
                    <CheckCircle2 size={10} className="text-white" />
                  </motion.div>
                )}
              </motion.button>
            ))}

            <div className={cn("bg-gray-200 dark:bg-gray-700 mx-1.5 self-center", compactMode ? "w-px h-7" : "w-px h-9")} />

            <motion.button
              key={`notes-${dischargeTasks.notes}`}
              whileTap={{ scale: 0.85 }}
              initial={dischargeTasks.notes === 'complete' ? { scale: 1.2, filter: "brightness(1.5)" } : false}
              animate={{ scale: 1, filter: "brightness(1)" }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
              onClick={(e) => { e.stopPropagation(); toggleDischargeTask('notes'); }}
              className={cn(
                "rounded-xl border-2 flex items-center justify-center transition-all relative shadow-sm",
                compactMode ? "w-10 h-10" : "w-12 h-12",
                getTaskStyle(dischargeTasks.notes as any)
              )}
              title="Notes"
            >
              {getDischargeTaskIcon('notes', dischargeTasks.notes, compactMode ? 16 : 22)}
              {dischargeTasks.notes === 'pending' && (
                <motion.div 
                  animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className={cn("absolute -top-1 -right-1 bg-yellow-400 rounded-full border-2 border-white shadow-sm", compactMode ? "w-3 h-3" : "w-4 h-4")} 
                />
              )}
              {dischargeTasks.notes === 'complete' && (
                <motion.div
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 15 }}
                  className="absolute -top-1.5 -right-1.5 bg-green-500 rounded-full border-2 border-white shadow-md w-4 h-4 flex items-center justify-center"
                >
                  <CheckCircle2 size={10} className="text-white" />
                </motion.div>
              )}
            </motion.button>
          </div>

          {/* Secondary Toggles Row (Discharge / Admit / Obs) */}
          <div className="flex items-center gap-1.5 flex-wrap justify-start md:justify-end">
            {patient.status === 'Discharge' && (
              <>
                {(['instructions', 'rx', 'followUp'] as const).map(task => {
                  const state = dischargeTasks[task];
                  return (
                    <motion.button
                      key={`${task}-${state}`}
                      whileTap={{ scale: 0.85 }}
                      initial={state === 'complete' ? { scale: 1.2, filter: "brightness(1.5)" } : false}
                      animate={{ scale: 1, filter: "brightness(1)" }}
                      transition={{ type: "spring", stiffness: 400, damping: 10 }}
                      onClick={(e) => { e.stopPropagation(); toggleDischargeTask(task); }}
                      className={cn(
                        "rounded-xl border-2 flex items-center justify-center transition-all relative shadow-sm",
                        compactMode ? "w-10 h-10" : "w-12 h-12",
                        getTaskStyle(state as any)
                      )}
                      title={task.charAt(0).toUpperCase() + task.slice(1)}
                    >
                      {getDischargeTaskIcon(task, state, compactMode ? 16 : 22)}
                      {state === 'complete' && (
                        <motion.div
                          initial={{ scale: 0, rotate: -45 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 15 }}
                          className="absolute -top-1.5 -right-1.5 bg-green-500 rounded-full border-2 border-white shadow-md w-4 h-4 flex items-center justify-center"
                        >
                          <CheckCircle2 size={10} className="text-white" />
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </>
            )}

            {patient.status === 'Admit' && (
              <>
                {(['familyUpdate', 'page', 'handoff', 'secureChat'] as const).map(task => {
                  const state = (patient.admitTasks || { familyUpdate: 'off', page: 'off', handoff: 'off', secureChat: 'off' })[task];
                  return (
                    <motion.button
                      key={`${task}-${state}`}
                      whileTap={{ scale: 0.85 }}
                      initial={state === 'complete' ? { scale: 1.2, filter: "brightness(1.5)" } : false}
                      animate={{ scale: 1, filter: "brightness(1)" }}
                      transition={{ type: "spring", stiffness: 400, damping: 10 }}
                      onClick={(e) => { e.stopPropagation(); toggleAdmitTask(task); }}
                      className={cn(
                        "rounded-xl border-2 flex items-center justify-center transition-all relative shadow-sm",
                        compactMode ? "w-10 h-10" : "w-12 h-12",
                        getTaskStyle(state as any)
                      )}
                      title={task.replace(/([A-Z])/g, ' $1').trim()}
                    >
                      {getAdmitTaskIcon(task, state, compactMode ? 16 : 22)}
                      {state === 'complete' && (
                        <motion.div
                          initial={{ scale: 0, rotate: -45 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 15 }}
                          className="absolute -top-1.5 -right-1.5 bg-green-500 rounded-full border-2 border-white shadow-md w-4 h-4 flex items-center justify-center"
                        >
                          <CheckCircle2 size={10} className="text-white" />
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </>
            )}

            {patient.status === 'ED Observation' && (
              <>
                {(['obsAdmitNote', 'obsDCNote'] as const).map(task => {
                  const state = (patient.obsTasks || { obsAdmitNote: 'off', obsDCNote: 'off' })[task];
                  return (
                    <motion.button
                      key={`${task}-${state}`}
                      whileTap={{ scale: 0.85 }}
                      initial={state === 'complete' ? { scale: 1.2, filter: "brightness(1.5)" } : false}
                      animate={{ scale: 1, filter: "brightness(1)" }}
                      transition={{ type: "spring", stiffness: 400, damping: 10 }}
                      onClick={(e) => { e.stopPropagation(); toggleObsTask(task); }}
                      className={cn(
                        "rounded-xl border-2 flex items-center justify-center transition-all relative shadow-sm",
                        compactMode ? "w-10 h-10" : "w-12 h-12",
                        getTaskStyle(state as any)
                      )}
                      title={task.replace(/([A-Z])/g, ' $1').trim()}
                    >
                      {getObsTaskIcon(task, state, compactMode ? 16 : 22)}
                      {state === 'complete' && (
                        <motion.div
                          initial={{ scale: 0, rotate: -45 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 15 }}
                          className="absolute -top-1.5 -right-1.5 bg-green-500 rounded-full border-2 border-white shadow-md w-4 h-4 flex items-center justify-center"
                        >
                          <CheckCircle2 size={10} className="text-white" />
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </>
            )}
          </div>
          
          <div className="flex items-center justify-between md:justify-end gap-4 border-t border-gray-100 md:border-t-0 pt-2 md:pt-0">
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={toggleSeenState}
              className={cn(
                "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl font-black text-gray-600 dark:text-gray-300 uppercase tracking-tight transition-all flex items-center gap-2 shadow-sm",
                compactMode ? "px-3 py-2 text-[9px]" : "px-4 py-2.5 text-[11px]"
              )}
            >
              <Edit2 size={compactMode ? 10 : 14} />
              {patient.seenState}
            </motion.button>
            
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm",
                compactMode ? "px-3 py-2" : "px-4 py-2.5"
              )}>
                <Clock size={compactMode ? 14 : 18} style={{ color: getTimerColor(elapsed) }} />
                <span className={cn("font-black tabular-nums", compactMode ? "text-sm" : "text-base")} style={{ color: getTimerColor(elapsed) }}>
                  {formatTime(elapsed)}
                </span>
              </div>
              <motion.button 
                whileTap={{ rotate: -180, scale: 0.8 }}
                onClick={(e) => { e.stopPropagation(); onResetTimer(patient.id); }}
                className="p-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-colors text-gray-300 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 border border-transparent hover:border-blue-100 dark:hover:border-blue-800"
                title="Reset Timer"
              >
                <RotateCcw size={compactMode ? 16 : 20} />
              </motion.button>
              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={(e) => { e.stopPropagation(); handleCardClick(e); }}
                data-interactive="true"
                className="p-1.5 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
              >
                {isExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="px-3 pb-4 pt-2 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
          {/* Team & Notes */}
          <div className="space-y-3">
            <div>
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Patient Details</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400">Initials</label>
                  <input 
                    className="w-full text-xs p-2 border border-gray-200 rounded-lg"
                    value={patient.initials || ''}
                    onChange={(e) => onUpdate(patient.id, { initials: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 dark:text-gray-500">Age</label>
                  <input 
                    className="w-full text-xs p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                    value={patient.age || ''}
                    onChange={(e) => onUpdate(patient.id, { age: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 dark:text-gray-500">Sex</label>
                  <select 
                    className="w-full text-xs p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                    value={patient.sex || 'M'}
                    onChange={(e) => onUpdate(patient.id, { sex: e.target.value as 'M' | 'F' | 'Other' })}
                  >
                    <option value="M">M</option>
                    <option value="F">F</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 dark:text-gray-500">Room</label>
                  <input 
                    className="w-full text-xs p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                    value={patient.room || ''}
                    onChange={(e) => onUpdate(patient.id, { room: e.target.value })}
                  />
                </div>
              </div>
              <div className="mt-2 space-y-1">
                <label className="text-[9px] font-bold text-gray-400 dark:text-gray-500">Chief Complaint</label>
                <input 
                  className="w-full text-xs p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                  value={patient.chiefComplaint || ''}
                  onChange={(e) => onUpdate(patient.id, { chiefComplaint: e.target.value })}
                />
              </div>
            </div>

            <div>
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Users size={12} /> ASSIGNED TEAM
              </h4>
              <div className="flex flex-wrap gap-2">
                {patient.assignedTeam.length > 0 ? (
                  patient.assignedTeam.map(id => {
                    const member = teamMembers.find(m => m.id === id);
                    return (
                      <div key={id} className="flex items-center gap-1 bg-white dark:bg-gray-800 px-2 py-1 rounded-full border border-gray-200 dark:border-gray-700 text-xs text-gray-900 dark:text-white shadow-sm transition-colors">
                        <div className={cn("w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold", member ? getRoleColor(member.role) : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400")}>
                          {member?.initials || id.slice(0, 2).toUpperCase()}
                        </div>
                        <span>{member ? `${member.firstName} ${member.lastName}` : id}</span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdate(patient.id, { assignedTeam: patient.assignedTeam.filter(tid => tid !== id) });
                          }}
                          className="ml-1 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <span className="text-[10px] text-gray-400 italic font-medium">Drag team members here to assign</span>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">OPERATIONAL NOTES</h4>
              <p className="text-[9px] text-red-500 font-bold mb-1.5 flex items-center gap-1">⚠️ DO NOT ENTER PHI</p>
              <textarea 
                className="w-full text-xs p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white h-24 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                placeholder="Enter non-PHI notes here..."
                value={patient.operationalNotes || ''}
                onChange={(e) => onUpdate(patient.id, { operationalNotes: e.target.value })}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Workflow Flags Removed */}

          {/* Status Control */}
          <div className="space-y-3">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">STATUS CONTROL</h4>
              <select 
                className="w-full text-xs p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                value={patient.status}
                onChange={(e) => onUpdate(patient.id, { status: e.target.value as any })}
              >
                {['New', 'Staff', 'Work-up', 'ED Observation', 'Likely Discharge', 'Likely Admit', 'Discharge', 'Admit'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate(patient.id, { 
                    workflowFlags: { 
                      ...patient.workflowFlags, 
                      boarding: !patient.workflowFlags?.boarding 
                    } 
                  });
                }}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-xs font-bold",
                  patient.workflowFlags?.boarding 
                    ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400" 
                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                )}
              >
                <div className="flex items-center gap-2">
                  <Bed size={14} className={patient.workflowFlags?.boarding ? "text-red-500 dark:text-red-400" : "text-gray-400 dark:text-gray-500"} />
                  <span>Boarding Status</span>
                </div>
                <div className={cn(
                  "w-8 h-4 rounded-full relative transition-colors",
                  patient.workflowFlags?.boarding ? "bg-red-500 dark:bg-red-600" : "bg-gray-200 dark:bg-gray-700"
                )}>
                  <div className={cn(
                    "absolute top-0.5 w-3 h-3 bg-white dark:bg-gray-200 rounded-full transition-all",
                    patient.workflowFlags?.boarding ? "left-[18px]" : "left-0.5"
                  )} />
                </div>
              </button>
            </div>

            <div className="pt-4 flex flex-wrap gap-3 justify-between items-center">
              <div className="flex gap-2">
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => { e.stopPropagation(); onComplete(patient.id); }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md",
                    patient.isCompleted 
                      ? "bg-green-100 text-green-700 border border-green-200" 
                      : "bg-green-600 text-white border border-green-700 hover:bg-green-700 active:bg-green-800"
                  )}
                >
                  <CheckCircle2 size={16} />
                  {patient.isCompleted ? 'Re-open' : 'Complete Encounter'}
                </motion.button>
              </div>
              
              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Are you sure you want to delete this patient? This action cannot be undone.')) {
                    onDelete(patient.id);
                  }
                }}
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-800/50"
              >
                <X size={16} />
                Delete Patient
              </motion.button>
            </div>
        </div>
      )}
    </motion.div>
  );
};
