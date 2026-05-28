/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Patient, TaskState, MedsConsultState, PatientStatus, TeamMember } from '../types';
import { cn, getStatusStyle, getSeenBorderStyle, getStatusGradient, getTimerColor, getRoleColor } from '../lib/utils';
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
  Plus,
  Mars,
  Venus,
  CircleDot,
  ClipboardList
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useDroppable } from '@dnd-kit/core';
import { motion, AnimatePresence } from 'framer-motion';
import { RadialStatusMenu } from './RadialStatusMenu';

interface PatientCardProps {
  patient: Patient;
  onUpdate: (id: string, updates: Partial<Patient>) => void;
  onResetTimer: (id: string) => void;
  onDelete: (id: string) => void;
  onComplete: (id: string) => void;
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
  compactMode = false,
  teamMembers = [],
  darkMode = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [elapsed, setElapsed] = useState<number>(0);
  const [radialMenuOpen, setRadialMenuOpen] = useState(false);
  const [radialMenuPos, setRadialMenuPos] = useState({ x: 0, y: 0 });

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

  const toggleFellowSeen = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate(patient.id, { fellowSeen: !patient.fellowSeen });
  };

  const toggleAttendingSeen = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate(patient.id, { attendingSeen: !patient.attendingSeen });
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
    patient.attendingSeen &&
    (dischargeTasks.instructions === 'complete' || dischargeTasks.instructions === 'none') &&
    (dischargeTasks.rx === 'home' || dischargeTasks.rx === 'facility' || dischargeTasks.rx === 'none') &&
    (dischargeTasks.followUp === 'complete' || dischargeTasks.followUp === 'none');

  return (
    <motion.div 
      ref={setNodeRef}
      animate={isGoodToGo ? {
        boxShadow: ["0px 0px 0px rgba(34, 197, 94, 0)", "0px 0px 30px rgba(34, 197, 94, 0.5)", "0px 0px 0px rgba(34, 197, 94, 0)"],
        transition: { repeat: Infinity, duration: 1.5 }
      } : {}}
      whileHover={{ y: -2, scale: 1.005, transition: { duration: 0.2 } }}
      onContextMenu={handleContextMenu}
      className={cn(
        "group rounded-xl shadow-sm mb-4 transition-all relative touch-pan-y w-full max-w-full bg-white dark:bg-gray-900 border overflow-visible active:shadow-lg",
        getSeenBorderStyle(patient.fellowSeen, patient.attendingSeen),
        patient.isPinned && "ring-2 ring-yellow-400 dark:ring-yellow-500",
        patient.isCompleted && "opacity-60 grayscale-[0.5]",
        isOver && "ring-4 ring-blue-400 dark:ring-blue-500 scale-[1.01] z-20",
        isGoodToGo && "border-green-500 dark:border-green-400 border-2"
      )}
    >
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

      {/* Team Icons - Floating Top Right */}
      <div className={cn(
        "absolute flex items-center gap-1 z-20 transition-all",
        "md:-top-6 md:right-4 -top-4 right-10"
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
                  <img src={m.avatarUrl} alt={m.initials} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
      </div>

        <div 
          className={cn(
            "flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4 relative z-30 touch-none",
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
            {!compactMode && <span className="col-header leading-none mb-0.5">Room</span>}
            <input 
              className={cn(
                "data-value font-black text-gray-900 dark:text-white leading-none bg-transparent border-none p-0 text-center focus:ring-0 w-full",
                compactMode ? "text-sm" : "text-xl"
              )}
              inputMode="numeric"
              value={patient.room || ''}
              onChange={(e) => onUpdate(patient.id, { room: e.target.value })}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-1 flex-wrap">
              <input 
                className={cn(
                  "font-black text-gray-900 dark:text-white tracking-tight bg-transparent border-none p-0 focus:ring-0 w-16",
                  compactMode ? "text-base" : "text-2xl"
                )}
                value={patient.initials || ''}
                onChange={(e) => onUpdate(patient.id, { initials: e.target.value.toUpperCase().slice(0, 4) })}
                onClick={(e) => e.stopPropagation()}
                maxLength={4}
              />
              <div className="flex flex-col mt-1.5">
                <div className="flex items-center gap-1 px-1 py-0.5 rounded-md transition-colors min-h-[28px]">
                  <div className="flex items-center">
                    <input 
                      className={cn(
                        "data-value font-bold text-gray-600 dark:text-gray-300 bg-transparent border-none p-0 focus:ring-0 w-8 text-right",
                        compactMode ? "text-xs" : "text-sm"
                      )}
                      inputMode="numeric"
                      value={patient.age.replace(/[^0-9]/g, '') || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        const unit = patient.age.replace(/[0-9]/g, '') || 'y';
                        onUpdate(patient.id, { age: val + unit });
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <select 
                      className={cn(
                        "data-value font-bold text-gray-400 dark:text-gray-500 bg-transparent border-none p-0 focus:ring-0 appearance-none cursor-pointer ml-0.5",
                        compactMode ? "text-[10px]" : "text-xs"
                      )}
                      value={patient.age.replace(/[0-9]/g, '') || 'y'}
                      onChange={(e) => {
                        const unit = e.target.value;
                        const val = patient.age.replace(/[^0-9]/g, '') || '';
                        onUpdate(patient.id, { age: val + unit });
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="y">y</option>
                      <option value="m">m</option>
                      <option value="d">d</option>
                    </select>
                  </div>
                  <span className="text-[10px] font-black text-gray-300 dark:text-gray-600 mx-1">/</span>
                  <div className="relative group/sex">
                    <button 
                      className={cn(
                        "transition-all p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center",
                        patient.sex === 'M' ? "text-blue-500 dark:text-blue-400" : 
                        patient.sex === 'F' ? "text-pink-500 dark:text-pink-400" : 
                        "text-purple-500 dark:text-purple-400"
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {patient.sex === 'M' ? <Mars size={compactMode ? 12 : 14} /> : 
                       patient.sex === 'F' ? <Venus size={compactMode ? 12 : 14} /> : 
                       <CircleDot size={compactMode ? 12 : 14} />}
                    </button>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg shadow-xl opacity-0 invisible group-hover/sex:opacity-100 group-hover/sex:visible transition-all z-50 p-1 flex flex-col gap-1">
                      <button 
                        onClick={(e) => { e.stopPropagation(); onUpdate(patient.id, { sex: 'M' }); }}
                        className={cn("p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30", patient.sex === 'M' ? "text-blue-500" : "text-gray-400")}
                      >
                        <Mars size={14} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onUpdate(patient.id, { sex: 'F' }); }}
                        className={cn("p-1.5 rounded-md hover:bg-pink-50 dark:hover:bg-pink-900/30", patient.sex === 'F' ? "text-pink-500" : "text-gray-400")}
                      >
                        <Venus size={14} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onUpdate(patient.id, { sex: 'Other' }); }}
                        className={cn("p-1.5 rounded-md hover:bg-purple-50 dark:hover:bg-purple-900/30", patient.sex === 'Other' ? "text-purple-500" : "text-gray-400")}
                      >
                        <CircleDot size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Epic Vitals Display */}
                {patient.vitals && !compactMode && (
                  <div className="flex items-center gap-2 mb-1.5 py-0.5 px-1.5 bg-gray-50/50 dark:bg-gray-800/30 rounded-lg border border-gray-100/50 dark:border-gray-700/50 w-fit ml-1">
                    <div className="flex items-center gap-1">
                      <span className="text-[6px] font-black text-gray-400 uppercase tracking-tighter">HR</span>
                      <span className={cn(
                        "text-[9px] font-black",
                        parseInt(patient.vitals.hr || '0') > 150 ? "text-red-500" : "text-gray-600 dark:text-gray-400"
                      )}>{patient.vitals.hr}</span>
                    </div>
                    <div className="w-px h-3 bg-gray-200 dark:bg-gray-700" />
                    <div className="flex items-center gap-1">
                      <span className="text-[6px] font-black text-gray-400 uppercase tracking-tighter">BP</span>
                      <span className="text-[9px] font-black text-gray-600 dark:text-gray-400">{patient.vitals.bp}</span>
                    </div>
                    <div className="w-px h-3 bg-gray-200 dark:bg-gray-700" />
                    <div className="flex items-center gap-1">
                      <span className="text-[6px] font-black text-gray-400 uppercase tracking-tighter">T</span>
                      <span className={cn(
                        "text-[9px] font-black",
                        (parseFloat(patient.vitals.temp || '98.6')) > 100.4 ? "text-red-500" : "text-gray-600 dark:text-gray-400"
                      )}>{patient.vitals.temp}</span>
                    </div>
                  </div>
                )}
                
                {(patient.age.includes('d') || patient.age.includes('m')) && (
                  <div className="flex items-center gap-0.5 text-[8px] font-bold text-gray-400 dark:text-gray-500 mt-1 pl-1">
                    <span className="opacity-60">(ex-</span>
                    <input 
                      type="number"
                      max={45}
                      className="w-4 bg-transparent border-none p-0 focus:ring-0 text-center text-[8px] font-black text-blue-500 dark:text-blue-400"
                      value={patient.gestationalAge?.weeks || ''}
                      onChange={(e) => {
                        const val = Math.min(45, parseInt(e.target.value) || 0);
                        onUpdate(patient.id, { gestationalAge: { ...patient.gestationalAge, weeks: val, days: patient.gestationalAge?.days || 0 } });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="__"
                    />
                    <span className="opacity-60">w</span>
                    <select 
                      className="bg-transparent border-none p-0 focus:ring-0 appearance-none cursor-pointer text-[8px] font-black text-blue-500 dark:text-blue-400 w-3 text-center"
                      value={patient.gestationalAge?.days || 0}
                      onChange={(e) => onUpdate(patient.id, { gestationalAge: { ...patient.gestationalAge, weeks: patient.gestationalAge?.weeks || 0, days: parseInt(e.target.value) || 0 } })}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value={0}>_</option>
                      {[1,2,3,4,5,6,7].map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <span className="opacity-60">d)</span>
                  </div>
                )}
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
                placeholder="Presents with:..."
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
          
          <div className="flex items-center justify-between md:justify-end gap-2 border-t border-gray-100 md:border-t-0 pt-2 md:pt-0">
            <div className="flex items-center gap-1.5">
              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={toggleFellowSeen}
                className={cn(
                  "rounded-xl font-black uppercase tracking-tight transition-all flex items-center gap-1.5 shadow-sm border",
                  compactMode ? "px-2.5 py-1.5 text-[8px]" : "px-3 py-2 text-[10px]",
                  patient.fellowSeen 
                    ? "bg-green-500 text-white border-green-600" 
                    : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-transparent hover:bg-gray-200 dark:hover:bg-gray-700"
                )}
              >
                {patient.fellowSeen ? <CheckCircle2 size={compactMode ? 10 : 12} /> : <User size={compactMode ? 10 : 12} />}
                Fellow
              </motion.button>

              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={toggleAttendingSeen}
                className={cn(
                  "rounded-xl font-black uppercase tracking-tight transition-all flex items-center gap-1.5 shadow-sm border",
                  compactMode ? "px-2.5 py-1.5 text-[8px]" : "px-3 py-2 text-[10px]",
                  patient.attendingSeen 
                    ? "bg-green-500 text-white border-green-600" 
                    : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-transparent hover:bg-gray-200 dark:hover:bg-gray-700"
                )}
              >
                {patient.attendingSeen ? <CheckCircle2 size={compactMode ? 10 : 12} /> : <Users size={compactMode ? 10 : 12} />}
                Attending
              </motion.button>
            </div>
            
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm",
                compactMode ? "px-3 py-2" : "px-4 py-2.5"
              )}>
                <Clock size={compactMode ? 14 : 18} style={{ color: getTimerColor(elapsed) }} />
                <span className={cn("data-value font-black tabular-nums", compactMode ? "text-sm" : "text-base")} style={{ color: getTimerColor(elapsed) }}>
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
        <div className="px-3 pb-4 pt-2 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
          {/* Clinical Management */}
          <div className="space-y-4">
            <div>
              <h4 className="col-header mb-2 flex items-center gap-1.5 opacity-100">
                <ClipboardList size={12} className="text-blue-500" /> CLINICAL PLAN & DISPOSITION
              </h4>
              <textarea 
                className="w-full text-xs p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white h-32 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm resize-none font-medium"
                placeholder="What is the plan for this patient? (e.g., Awaiting labs, then discharge if normal...)"
                value={patient.operationalNotes || ''}
                onChange={(e) => onUpdate(patient.id, { operationalNotes: e.target.value })}
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <div>
              <h4 className="col-header mb-2 flex items-center gap-1.5 opacity-100">
                <MessageSquare size={12} className="text-purple-500" /> SHIFT HANDOFF SUMMARY
              </h4>
              <textarea 
                className="w-full text-xs p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white h-24 focus:ring-2 focus:ring-purple-500 outline-none transition-all shadow-inner resize-none italic"
                placeholder="Concise summary for the next team..."
              />
            </div>
          </div>

          {/* Quick Actions & Team */}
          <div className="space-y-4">
            <div>
              <h4 className="col-header mb-2 flex items-center gap-1.5 opacity-100">
                <Stethoscope size={12} className="text-green-500" /> QUICK ACTIONS
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <button className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-[10px] font-bold text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors shadow-sm">
                  <Phone size={12} /> Page Consultant
                </button>
                <button className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-[10px] font-bold text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors shadow-sm">
                  <Users size={12} /> Update Family
                </button>
                <button className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-[10px] font-bold text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors shadow-sm">
                  <ClipboardList size={12} /> Review Vitals
                </button>
                <button className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-[10px] font-bold text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors shadow-sm">
                  <AlertCircle size={12} /> Flag for Review
                </button>
              </div>
            </div>

            <div>
              <h4 className="col-header mb-2 flex items-center gap-1.5 opacity-100">
                <Users size={12} className="text-orange-500" /> ASSIGNED TEAM
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
          </div>

          {/* Bottom Actions */}
          <div className="md:col-span-2 pt-4 flex flex-wrap gap-3 justify-between items-center border-t border-gray-100 dark:border-gray-800">
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
