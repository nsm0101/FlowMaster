/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Patient, TeamMember } from '../types';
import { PatientCard } from './PatientCard';
import { Search, Filter, SortAsc, SortDesc, User, Users, Clock, AlertCircle, Plus, LayoutGrid, List, ChevronDown, ChevronUp, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { DndContext, DragOverlay, useDraggable, useDroppable, DragEndEvent } from '@dnd-kit/core';

interface PatientBoardProps {
  patients: Patient[];
  teamMembers: TeamMember[];
  onUpdatePatient: (id: string, updates: Partial<Patient>) => void;
  onDeletePatient: (id: string) => void;
  onCompletePatient: (id: string) => void;
  onResetTimer: (id: string) => void;
  onAddPatient: () => void;
  colorBlindMode?: boolean;
  compactMode?: boolean;
  twoColumnMode?: boolean;
}

const DraggableTeamMember = ({ member }: { member: TeamMember }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `member-${member.id}`,
    data: { member }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const roleColors = {
    attending: 'bg-red-100 text-red-700 border-red-200',
    fellow: 'bg-blue-100 text-blue-700 border-blue-200',
    resident: 'bg-green-100 text-green-700 border-green-200',
    student: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    nurse: 'bg-purple-100 text-purple-700 border-purple-200',
    other: 'bg-gray-100 text-gray-700 border-gray-200'
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs font-black cursor-grab active:cursor-grabbing transition-all shadow-sm shrink-0",
        roleColors[member.role],
        isDragging && "opacity-50 scale-110 shadow-lg"
      )}
      title={`${member.firstName} ${member.lastName} (${member.role})`}
    >
      {member.initials}
    </div>
  );
};

export const PatientBoard: React.FC<PatientBoardProps> = ({ 
  patients, 
  teamMembers, 
  onUpdatePatient, 
  onDeletePatient,
  onCompletePatient,
  onResetTimer,
  onAddPatient,
  colorBlindMode = false,
  compactMode = false,
  twoColumnMode = false
}) => {
  const [search, setSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'room' | 'status' | 'age' | 'timer'>('room');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredAndSortedPatients = useMemo(() => {
    let result = [...patients];

    // Search
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(p => 
        p.initials.toLowerCase().includes(s) || 
        p.room.toLowerCase().includes(s) ||
        p.chiefComplaint.toLowerCase().includes(s)
      );
    }

    // Filter Provider
    if (filterProvider !== 'all') {
      result = result.filter(p => p.assignedTeam.includes(filterProvider));
    }

    // Filter Status
    if (filterStatus !== 'all') {
      result = result.filter(p => p.status === filterStatus);
    }

    // Sort
    result.sort((a, b) => {
      // 1. Completion status (Active first)
      if (!a.isCompleted && b.isCompleted) return -1;
      if (a.isCompleted && !b.isCompleted) return 1;

      // 2. Pinning status
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      // 3. Room assignment status (Assigned rooms first)
      const isUnassigned = (room: string) => !room || room === '?' || room === 'TBD' || room === 'WAIT';
      const aUnassigned = isUnassigned(a.room);
      const bUnassigned = isUnassigned(b.room);
      if (!aUnassigned && bUnassigned) return -1;
      if (aUnassigned && !bUnassigned) return 1;

      let comparison = 0;
      if (sortBy === 'room') comparison = a.room.localeCompare(b.room, undefined, { numeric: true });
      else if (sortBy === 'status') comparison = a.status.localeCompare(b.status);
      else if (sortBy === 'age') comparison = parseInt(a.age) - parseInt(b.age);
      else if (sortBy === 'timer') comparison = a.lastAssessmentAt.toMillis() - b.lastAssessmentAt.toMillis();
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [patients, search, sortBy, sortOrder, filterProvider, filterStatus]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.data.current) {
      const memberId = active.data.current.member.id;
      const patientId = over.id as string;
      const patient = patients.find(p => p.id === patientId);
      
      if (patient && !patient.assignedTeam.includes(memberId)) {
        onUpdatePatient(patientId, {
          assignedTeam: [...patient.assignedTeam, memberId]
        });
      }
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        {/* Team Bar - Pinned */}
        <div className="sticky top-10 md:top-12 z-40 bg-white/90 backdrop-blur-md py-1 border-b border-gray-100 -mx-4 px-4 shadow-sm flex items-center justify-between gap-0">
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex justify-center w-full">
              <div className="flex items-center gap-1 opacity-60">
                <Users size={10} className="text-gray-400" />
                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Team</span>
              </div>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {teamMembers.map(m => (
                <DraggableTeamMember key={m.id} member={m} />
              ))}
              {teamMembers.length === 0 && (
                <span className="text-[10px] text-gray-400 font-medium italic">No team members active</span>
              )}
            </div>
          </div>

          <div className="w-px h-10 bg-gray-200 mx-2 shrink-0" />

          <button 
            onClick={onAddPatient}
            className="flex flex-col items-center justify-center min-w-[50px] h-10 text-blue-600 hover:bg-blue-50 rounded-xl transition-all shrink-0"
          >
            <Plus size={20} />
            <span className="text-[8px] font-black uppercase tracking-tighter">Add Patient</span>
          </button>
        </div>

        {/* Board Controls */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-start gap-4">
            <div className="flex items-center gap-4">
              {isSearchOpen ? (
                <div className="relative animate-in slide-in-from-left-2 duration-200 min-w-[200px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    autoFocus
                    className="w-full pl-9 pr-8 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <button 
                    onClick={() => { setSearch(''); setIsSearchOpen(false); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setIsSearchOpen(true)}
                  className="text-[10px] font-black text-gray-400 hover:text-blue-600 tracking-widest uppercase"
                >
                  SEARCH
                </button>
              )}
              
              <button 
                onClick={() => setIsSortOpen(!isSortOpen)}
                className={cn(
                  "text-[10px] font-black tracking-widest uppercase transition-all",
                  isSortOpen ? "text-blue-600" : "text-gray-400 hover:text-blue-600"
                )}
              >
                FILTER
              </button>
            </div>
          </div>

          {isSortOpen && (
            <div className="flex flex-wrap items-center gap-2 p-3 bg-white border border-gray-100 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1">
                <SortAsc size={14} className="text-gray-400" />
                <select 
                  className="text-xs font-bold text-gray-600 bg-transparent outline-none"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                >
                  <option value="room">Room</option>
                  <option value="status">Status</option>
                  <option value="age">Age</option>
                  <option value="timer">Timer</option>
                </select>
                <button 
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-1 hover:bg-gray-200 rounded text-gray-400"
                >
                  {sortOrder === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />}
                </button>
              </div>

              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1">
                <Users size={14} className="text-gray-400" />
                <select 
                  className="text-xs font-bold text-gray-600 bg-transparent outline-none max-w-[100px]"
                  value={filterProvider}
                  onChange={(e) => setFilterProvider(e.target.value)}
                >
                  <option value="all">All Providers</option>
                  {teamMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.initials} - {m.lastName}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1">
                <Filter size={14} className="text-gray-400" />
                <select 
                  className="text-xs font-bold text-gray-600 bg-transparent outline-none max-w-[100px]"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">All Status</option>
                  {['New', 'Staff', 'Work-up', 'ED Observation', 'Likely Discharge', 'Likely Admit', 'Discharge', 'Admit'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Patient List */}
        <div className={cn("grid gap-2", twoColumnMode ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
          {filteredAndSortedPatients.map(patient => (
            <PatientCard 
              key={patient.id} 
              patient={patient} 
              onUpdate={onUpdatePatient}
              onDelete={onDeletePatient}
              onComplete={onCompletePatient}
              onResetTimer={onResetTimer}
              colorBlindMode={colorBlindMode}
              compactMode={compactMode}
              teamMembers={teamMembers}
            />
          ))}
          {filteredAndSortedPatients.length === 0 && (
            <div className="py-20 text-center text-gray-400 italic text-sm border-2 border-dashed border-gray-200 rounded-2xl">
              No patients found matching your filters.
            </div>
          )}
        </div>
      </div>
      <DragOverlay>
        {/* Drag overlay handled by dnd-kit */}
      </DragOverlay>
    </DndContext>
  );
};
