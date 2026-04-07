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
  Users2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useDroppable } from '@dnd-kit/core';
import { motion, useMotionValue, useTransform } from 'motion/react';

interface PatientCardProps {
  patient: Patient;
  onUpdate: (id: string, updates: Partial<Patient>, isSwipe?: boolean) => void;
  onResetTimer: (id: string) => void;
  onDelete: (id: string) => void;
  onComplete: (id: string) => void;
  colorBlindMode?: boolean;
  compactMode?: boolean;
  teamMembers?: TeamMember[];
}

export const PatientCard: React.FC<PatientCardProps> = ({ 
  patient, 
  onUpdate, 
  onResetTimer, 
  onDelete,
  onComplete,
  colorBlindMode = false,
  compactMode = false,
  teamMembers = []
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [elapsed, setElapsed] = useState<number>(0);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number, y: number } | null>(null);
  const [lastTap, setLastTap] = useState(0);

  const { setNodeRef, isOver } = useDroppable({
    id: patient.id,
  });

  // Swipe logic
  const x = useMotionValue(0);
  const isDark = document.documentElement.classList.contains('dark');
  const background = useTransform(
    x,
    [-100, 0, 100],
    isDark 
      ? ["#4c1d95", "#1f2937", "#064e3b"] // Dark mode colors
      : ["#fce4ec", "#ffffff", "#e8f5e9"] // Light mode colors
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const seconds = Math.floor((Date.now() - patient.lastAssessmentAt.toMillis()) / 1000);
      setElapsed(seconds);
    }, 1000);
    return () => clearInterval(interval);
  }, [patient.lastAssessmentAt]);

  const handleDragEnd = (_: any, info: any) => {
    const threshold = 80;
    const velocityThreshold = 500;
    if (info.offset.x > threshold || info.velocity.x > velocityThreshold) {
      onUpdate(patient.id, { status: 'Discharge' }, true);
    } else if (info.offset.x < -threshold || info.velocity.x < -velocityThreshold) {
      onUpdate(patient.id, { status: 'Admit' }, true);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (window.innerWidth < 768) {
      setMenuPosition(null);
    } else {
      setMenuPosition({ x: e.clientX, y: e.clientY });
    }
    setShowStatusMenu(true);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    if (now - lastTap < DOUBLE_PRESS_DELAY) {
      // Double tap
      e.preventDefault();
      handleContextMenu(e);
    } else {
      // Single tap
      setIsExpanded(!isExpanded);
    }
    setLastTap(now);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleTask = (task: keyof Patient['tasks']) => {
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
            <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-gray-100">
              <Home size={size * 0.5} className="text-blue-600" />
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
            <span className="absolute -bottom-1 -right-1 text-[7px] font-black bg-white rounded px-0.5 border border-gray-100">A</span>
          </div>
        ); 
        break;
      case 'obsDCNote': 
        icon = (
          <div className="flex items-center gap-0.5 relative">
            <StickyNote size={size} />
            <span className="absolute -bottom-1 -right-1 text-[7px] font-black bg-white rounded px-0.5 border border-gray-100">D</span>
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
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      dragDirectionLock
      onDragEnd={handleDragEnd}
      animate={isGoodToGo ? {
        boxShadow: ["0px 0px 0px rgba(34, 197, 94, 0)", "0px 0px 30px rgba(34, 197, 94, 0.5)", "0px 0px 0px rgba(34, 197, 94, 0)"],
        transition: { repeat: Infinity, duration: 1.5 }
      } : {}}
      style={{ x, background }}
      onContextMenu={handleContextMenu}
      className={cn(
        "group rounded-xl shadow-sm mb-4 transition-all relative touch-pan-y w-full max-w-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 overflow-visible",
        getSeenBorderStyle(patient.seenState),
        patient.isPinned && "ring-2 ring-yellow-400 dark:ring-yellow-500",
        patient.isCompleted && "opacity-60 grayscale-[0.5]",
        isOver && "ring-4 ring-blue-400 dark:ring-blue-500 scale-[1.01] z-20",
        isGoodToGo && "border-green-500 dark:border-green-400 border-2"
      )}
    >
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
              "w-9 h-9 rounded-full border-2 border-white dark:border-gray-900 flex items-center justify-center text-[9px] font-black shadow-lg transition-transform hover:scale-110 hover:z-40 relative",
              getRoleColor(m.role)
            )}
            title={`${m.firstName} ${m.lastName} (${m.role})`}
          >
            {m.initials}
          </div>
        ))}
        {assignedMembers.length === 0 && (
          <div className="w-9 h-9 rounded-full border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-300 dark:text-gray-600 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm">
            <User size={12} />
          </div>
        )}
      </div>

      {/* Quick Status Menu (Right Click / Long Press) */}
      {showStatusMenu && (
        <div 
          className={cn(
            "fixed inset-0 z-[100] flex",
            menuPosition ? "" : "bg-black/20 backdrop-blur-sm items-center justify-center p-4 animate-in fade-in duration-200"
          )}
          onClick={(e) => {
            e.stopPropagation();
            setShowStatusMenu(false);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setShowStatusMenu(false);
          }}
        >
          <div 
            className={cn(
              "bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 transition-colors",
              menuPosition ? "w-64 border border-gray-200 dark:border-gray-800 absolute" : "w-full max-w-sm relative"
            )}
            style={menuPosition ? {
              left: Math.min(menuPosition.x, window.innerWidth - 260),
              top: Math.min(menuPosition.y, window.innerHeight - 320),
            } : {}}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50 transition-colors">
              <h3 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Quick Status Change</h3>
              <button onClick={() => setShowStatusMenu(false)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors">
                <X size={18} className="text-gray-400 dark:text-gray-500" />
              </button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              {['New', 'Staff', 'Work-up', 'ED Observation', 'Likely Discharge', 'Likely Admit'].map(s => (
                <button
                  key={s}
                  onClick={() => { onUpdate(patient.id, { status: s as PatientStatus }); setShowStatusMenu(false); }}
                  className={cn(
                    "py-3 px-4 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all border shadow-sm",
                    patient.status === s 
                      ? "bg-blue-900 dark:bg-blue-600 text-white border-blue-900 dark:border-blue-600 shadow-md scale-[0.98]" 
                      : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 flex justify-center transition-colors">
              <button 
                onClick={() => setShowStatusMenu(false)}
                className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div 
        className={cn(
          "cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4 relative z-10",
          compactMode ? "p-1.5" : "p-3"
        )}
        onClick={handleCardClick}
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
            
            {/* Chief Complaint - Editable In Place */}
            <textarea 
              className={cn(
                "w-full bg-transparent border-none focus:ring-0 font-bold text-gray-500 dark:text-gray-400 resize-none no-scrollbar mt-0.5 leading-tight",
                compactMode ? "text-[9px]" : "text-[11px]"
              )}
              rows={2}
              placeholder="Chief Complaint..."
              value={patient.chiefComplaint || ''}
              onChange={(e) => onUpdate(patient.id, { chiefComplaint: e.target.value })}
              onClick={(e) => e.stopPropagation()}
            />

            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={cn(
                "px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider border shadow-sm w-fit", 
                compactMode ? "text-[7px]" : "text-[9px]",
                getStatusStyle(patient.status)
              )}>
                {colorBlindMode && <span className="mr-1">{getStatusSymbol(patient.status)}</span>}
                {patient.status}
              </div>
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
              <button
                key={task}
                onClick={(e) => { e.stopPropagation(); toggleTask(task); }}
                className={cn(
                  "rounded-xl border-2 flex items-center justify-center transition-all relative shadow-sm",
                  compactMode ? "w-7 h-7" : "w-9 h-9",
                  getTaskStyle(patient.tasks[task])
                )}
                title={task.charAt(0).toUpperCase() + task.slice(1)}
              >
                {getTaskIcon(task, patient.tasks[task], compactMode ? 12 : 16)}
                {patient.tasks[task] === 'pending' && (
                  <div className={cn("absolute -top-1 -right-1 bg-yellow-400 rounded-full border-2 border-white shadow-sm", compactMode ? "w-2 h-2" : "w-3 h-3")} />
                )}
              </button>
            ))}

            <div className={cn("bg-gray-200 mx-1 self-center", compactMode ? "w-px h-5" : "w-px h-7")} />

            <button
              onClick={(e) => { e.stopPropagation(); toggleDischargeTask('notes'); }}
              className={cn(
                "rounded-xl border-2 flex items-center justify-center transition-all relative shadow-sm",
                compactMode ? "w-7 h-7" : "w-9 h-9",
                getTaskStyle(dischargeTasks.notes as any)
              )}
              title="Notes"
            >
              {getDischargeTaskIcon('notes', dischargeTasks.notes, compactMode ? 12 : 16)}
              {dischargeTasks.notes === 'pending' && (
                <div className={cn("absolute -top-1 -right-1 bg-yellow-400 rounded-full border-2 border-white shadow-sm", compactMode ? "w-2 h-2" : "w-3 h-3")} />
              )}
            </button>
          </div>

          {/* Secondary Toggles Row (Discharge / Admit / Obs) */}
          <div className="flex items-center gap-1 flex-wrap justify-start md:justify-end">
            {patient.status === 'Discharge' && (
              <>
                {(['instructions', 'rx', 'followUp'] as const).map(task => {
                  const state = dischargeTasks[task];
                  return (
                    <button
                      key={task}
                      onClick={(e) => { e.stopPropagation(); toggleDischargeTask(task); }}
                      className={cn(
                        "rounded-xl border-2 flex items-center justify-center transition-all relative shadow-sm",
                        compactMode ? "w-7 h-7" : "w-9 h-9",
                        getTaskStyle(state as any)
                      )}
                      title={task.charAt(0).toUpperCase() + task.slice(1)}
                    >
                      {getDischargeTaskIcon(task, state, compactMode ? 12 : 16)}
                    </button>
                  );
                })}
              </>
            )}

            {patient.status === 'Admit' && (
              <>
                {(['familyUpdate', 'page', 'handoff', 'secureChat'] as const).map(task => {
                  const state = (patient.admitTasks || { familyUpdate: 'off', page: 'off', handoff: 'off', secureChat: 'off' })[task];
                  return (
                    <button
                      key={task}
                      onClick={(e) => { e.stopPropagation(); toggleAdmitTask(task); }}
                      className={cn(
                        "rounded-xl border-2 flex items-center justify-center transition-all relative shadow-sm",
                        compactMode ? "w-7 h-7" : "w-9 h-9",
                        getTaskStyle(state as any)
                      )}
                      title={task.replace(/([A-Z])/g, ' $1').trim()}
                    >
                      {getAdmitTaskIcon(task, state, compactMode ? 12 : 16)}
                    </button>
                  );
                })}
              </>
            )}

            {patient.status === 'ED Observation' && (
              <>
                {(['obsAdmitNote', 'obsDCNote'] as const).map(task => {
                  const state = (patient.obsTasks || { obsAdmitNote: 'off', obsDCNote: 'off' })[task];
                  return (
                    <button
                      key={task}
                      onClick={(e) => { e.stopPropagation(); toggleObsTask(task); }}
                      className={cn(
                        "rounded-xl border-2 flex items-center justify-center transition-all relative shadow-sm",
                        compactMode ? "w-7 h-7" : "w-9 h-9",
                        getTaskStyle(state as any)
                      )}
                      title={task.replace(/([A-Z])/g, ' $1').trim()}
                    >
                      {getObsTaskIcon(task, state, compactMode ? 12 : 16)}
                    </button>
                  );
                })}
              </>
            )}
          </div>
          
          <div className="flex items-center justify-between md:justify-end gap-3 border-t border-gray-100 md:border-t-0 pt-1.5 md:pt-0">
            <button 
              onClick={toggleSeenState}
              className={cn(
                "bg-gray-100 hover:bg-gray-200 rounded-xl font-black text-gray-600 uppercase tracking-tight transition-all active:scale-95 flex items-center gap-1.5 shadow-sm",
                compactMode ? "px-2 py-1 text-[8px]" : "px-3 py-1.5 text-[10px]"
              )}
            >
              <Edit2 size={compactMode ? 8 : 10} />
              {patient.seenState}
            </button>
            
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex items-center gap-2 bg-gray-50 rounded-xl border border-gray-100 shadow-sm",
                compactMode ? "px-2 py-1" : "px-3 py-1.5"
              )}>
                <Clock size={compactMode ? 12 : 16} style={{ color: getTimerColor(elapsed) }} />
                <span className={cn("font-black tabular-nums", compactMode ? "text-xs" : "text-sm")} style={{ color: getTimerColor(elapsed) }}>
                  {formatTime(elapsed)}
                </span>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); onResetTimer(patient.id); }}
                className="p-1.5 hover:bg-blue-50 rounded-full transition-colors text-gray-300 hover:text-blue-500 border border-transparent hover:border-blue-100"
                title="Reset Timer"
              >
                <RotateCcw size={compactMode ? 12 : 14} />
              </button>
              <div className="p-1 bg-gray-50 rounded-lg md:hidden">
                {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </div>
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
                  <label className="text-[9px] font-bold text-gray-400">Age</label>
                  <input 
                    className="w-full text-xs p-2 border border-gray-200 rounded-lg"
                    value={patient.age || ''}
                    onChange={(e) => onUpdate(patient.id, { age: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400">Sex</label>
                  <select 
                    className="w-full text-xs p-2 border border-gray-200 rounded-lg bg-white"
                    value={patient.sex || 'M'}
                    onChange={(e) => onUpdate(patient.id, { sex: e.target.value as 'M' | 'F' | 'Other' })}
                  >
                    <option value="M">M</option>
                    <option value="F">F</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400">Room</label>
                  <input 
                    className="w-full text-xs p-2 border border-gray-200 rounded-lg"
                    value={patient.room || ''}
                    onChange={(e) => onUpdate(patient.id, { room: e.target.value })}
                  />
                </div>
              </div>
              <div className="mt-2 space-y-1">
                <label className="text-[9px] font-bold text-gray-400">Chief Complaint</label>
                <input 
                  className="w-full text-xs p-2 border border-gray-200 rounded-lg"
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
                      <div key={id} className="flex items-center gap-1 bg-white px-2 py-1 rounded-full border border-gray-200 text-xs shadow-sm">
                        <div className={cn("w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold", member ? getRoleColor(member.role) : "bg-blue-100 text-blue-600")}>
                          {member?.initials || id.slice(0, 2).toUpperCase()}
                        </div>
                        <span>{member ? `${member.firstName} ${member.lastName}` : id}</span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdate(patient.id, { assignedTeam: patient.assignedTeam.filter(tid => tid !== id) });
                          }}
                          className="ml-1 text-gray-400 hover:text-red-500"
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
                className="w-full text-xs p-2.5 border border-gray-200 rounded-xl bg-white h-24 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
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
                className="w-full text-xs p-2.5 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
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
                    ? "bg-red-50 border-red-200 text-red-700" 
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                )}
              >
                <div className="flex items-center gap-2">
                  <Bed size={14} className={patient.workflowFlags?.boarding ? "text-red-500" : "text-gray-400"} />
                  <span>Boarding Status</span>
                </div>
                <div className={cn(
                  "w-8 h-4 rounded-full relative transition-colors",
                  patient.workflowFlags?.boarding ? "bg-red-500" : "bg-gray-200"
                )}>
                  <div className={cn(
                    "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all",
                    patient.workflowFlags?.boarding ? "left-[18px]" : "left-0.5"
                  )} />
                </div>
              </button>
            </div>

            <div className="pt-4 flex flex-wrap gap-2 justify-between items-center">
              <div className="flex gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); onComplete(patient.id); }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold transition-all",
                    patient.isCompleted ? "bg-green-100 text-green-700 border border-green-200" : "bg-green-600 text-white border border-green-700 shadow-sm hover:bg-green-700"
                  )}
                >
                  <CheckCircle2 size={12} />
                  {patient.isCompleted ? 'Re-open' : 'Complete Encounter'}
                </button>
              </div>
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Are you sure you want to delete this patient? This action cannot be undone.')) {
                    onDelete(patient.id);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold text-red-500 hover:bg-red-50 transition-colors border border-transparent hover:border-red-100"
              >
                <X size={12} />
                Delete Patient
              </button>
            </div>
        </div>
      )}
    </motion.div>
  );
};
