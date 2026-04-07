/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Patient, TeamMember } from '../types';
import { PatientCard } from './PatientCard';
import { Search, Filter, SortAsc, SortDesc, User, Users, Clock, AlertCircle, Plus, LayoutGrid, List, ChevronDown, ChevronUp, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { DndContext, DragOverlay, useDraggable, useDroppable, DragEndEvent, TouchSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';

interface PatientBoardProps {
  patients: Patient[];
  teamMembers: TeamMember[];
  onUpdatePatient: (id: string, updates: Partial<Patient>, isSwipe?: boolean) => void;
  onDeletePatient: (id: string) => void;
  onCompletePatient: (id: string) => void;
  onResetTimer: (id: string) => void;
  onAddPatient: () => void;
  onAddTeamMember?: (member: Partial<TeamMember>) => void;
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
  onAddTeamMember,
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
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddData, setQuickAddData] = useState({ firstName: '', lastName: '', initials: '', role: 'resident' as any });

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickAddData.firstName && quickAddData.lastName && quickAddData.initials && onAddTeamMember) {
      onAddTeamMember(quickAddData);
      setQuickAddData({ firstName: '', lastName: '', initials: '', role: 'resident' });
      setIsQuickAddOpen(false);
    }
  };

  const groupedPatients = useMemo(() => {
    if (filterProvider === 'all') return { all: filteredAndSortedPatients };
    
    // If a specific provider is selected, we still group them but only show that provider
    // However, the user requested "Collapsible sections by provider selected (when filter is active all a (All Providers) button to clear the selection"
    // This implies that when "All Providers" is selected, we might NOT group, or we group by ALL providers.
    // Let's implement grouping by provider when a specific provider is NOT selected, OR just group by the selected provider.
    // Wait, the request says: "Collpaseable sections by provider selected (when filter is active all a (All Providers) button to clear the selection"
    // This means if filterProvider !== 'all', we show a section for that provider.
    // Actually, it might mean we group by provider ALWAYS, or only when filtered.
    // Let's group by provider if filterProvider !== 'all'.
    
    const groups: Record<string, Patient[]> = {};
    filteredAndSortedPatients.forEach(p => {
      if (p.assignedTeam.length === 0) {
        if (!groups['unassigned']) groups['unassigned'] = [];
        groups['unassigned'].push(p);
      } else {
        p.assignedTeam.forEach(providerId => {
          if (!groups[providerId]) groups[providerId] = [];
          // Avoid duplicates if a patient has multiple providers and we are showing all
          if (!groups[providerId].find(existing => existing.id === p.id)) {
             groups[providerId].push(p);
          }
        });
      }
    });
    return groups;
  }, [filteredAndSortedPatients, filterProvider]);

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };
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

      // 3. New Patients (Always at the top, newest first)
      if (a.status === 'New' && b.status !== 'New') return -1;
      if (a.status !== 'New' && b.status === 'New') return 1;
      if (a.status === 'New' && b.status === 'New') {
        const aTime = a.createdAt ? a.createdAt.toMillis() : 0;
        const bTime = b.createdAt ? b.createdAt.toMillis() : 0;
        return bTime - aTime;
      }

      // 4. Room assignment status (Assigned rooms first)
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      {/* Quick Add Modal */}
      {isQuickAddOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-gray-900 tracking-tight">Quick Add Team</h3>
              <button onClick={() => setIsQuickAddOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleQuickAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">First Name</label>
                  <input 
                    autoFocus
                    required
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="First"
                    value={quickAddData.firstName}
                    onChange={(e) => setQuickAddData({ ...quickAddData, firstName: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Last Name</label>
                  <input 
                    required
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Last"
                    value={quickAddData.lastName}
                    onChange={(e) => setQuickAddData({ ...quickAddData, lastName: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Initials</label>
                  <input 
                    required
                    maxLength={3}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                    placeholder="JD"
                    value={quickAddData.initials}
                    onChange={(e) => setQuickAddData({ ...quickAddData, initials: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Role</label>
                  <select 
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={quickAddData.role}
                    onChange={(e) => setQuickAddData({ ...quickAddData, role: e.target.value as any })}
                  >
                    <option value="attending">Attending</option>
                    <option value="fellow">Fellow</option>
                    <option value="resident">Resident</option>
                    <option value="student">Student</option>
                    <option value="nurse">Nurse</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <button 
                type="submit"
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
              >
                Add Member
              </button>
            </form>
          </div>
        </div>
      )}

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
              <button
                onClick={() => setIsQuickAddOpen(true)}
                className="w-10 h-10 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all shrink-0"
                title="Quick Add Team Member"
              >
                <Plus size={16} />
              </button>
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
            <div className="flex flex-wrap items-center gap-2 p-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 transition-colors">
              <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg px-2 py-1 transition-colors">
                <SortAsc size={14} className="text-gray-400 dark:text-gray-500" />
                <select 
                  className="text-xs font-bold text-gray-600 dark:text-gray-300 bg-transparent outline-none"
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
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-400 dark:text-gray-500 transition-colors"
                >
                  {sortOrder === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />}
                </button>
              </div>

              <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg px-2 py-1 transition-colors">
                <Users size={14} className="text-gray-400 dark:text-gray-500" />
                <select 
                  className="text-xs font-bold text-gray-600 dark:text-gray-300 bg-transparent outline-none max-w-[100px]"
                  value={filterProvider}
                  onChange={(e) => setFilterProvider(e.target.value)}
                >
                  <option value="all">All Providers</option>
                  {teamMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.initials} - {m.lastName}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg px-2 py-1 transition-colors">
                <Filter size={14} className="text-gray-400 dark:text-gray-500" />
                <select 
                  className="text-xs font-bold text-gray-600 dark:text-gray-300 bg-transparent outline-none max-w-[100px]"
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
        {filterProvider === 'all' ? (
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
              <div className="py-20 text-center text-gray-400 dark:text-gray-500 italic text-sm border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
                No patients found matching your filters.
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800/50 transition-colors">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-bold text-blue-900 dark:text-blue-100">
                  Filtered by: {teamMembers.find(m => m.id === filterProvider)?.lastName || 'Unknown'}
                </span>
              </div>
              <button 
                onClick={() => setFilterProvider('all')}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg shadow-sm transition-colors"
              >
                Clear Filter (All Providers)
              </button>
            </div>
            
            {Object.entries(groupedPatients).filter(([groupId]) => groupId === filterProvider).map(([groupId, groupPatients]) => {
              const provider = teamMembers.find(m => m.id === groupId);
              const isCollapsed = collapsedGroups[groupId];
              
              return (
                <div key={groupId} className="space-y-2">
                  <button 
                    onClick={() => toggleGroup(groupId)}
                    className="w-full flex items-center justify-between p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white",
                        provider ? roleColors[provider.role] : "bg-gray-400 dark:bg-gray-600"
                      )}>
                        {provider?.initials || '?'}
                      </div>
                      <span className="font-bold text-gray-800 dark:text-gray-200">
                        {provider ? `${provider.firstName} ${provider.lastName}` : 'Unassigned'}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full text-xs font-bold transition-colors">
                        {groupPatients.length}
                      </span>
                    </div>
                    <div className={cn("transition-transform duration-200", isCollapsed ? "rotate-180" : "")}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 dark:text-gray-500"><path d="m18 15-6-6-6 6"/></svg>
                    </div>
                  </button>
                  
                  {!isCollapsed && (
                    <div className={cn("grid gap-2 pl-2 md:pl-4 border-l-2 border-gray-100 dark:border-gray-800 transition-colors", twoColumnMode ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
                      {groupPatients.map(patient => (
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
                      {groupPatients.length === 0 && (
                        <div className="py-8 text-center text-gray-400 dark:text-gray-500 italic text-sm">
                          No patients assigned.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <DragOverlay>
        {/* Drag overlay handled by dnd-kit */}
      </DragOverlay>
    </DndContext>
  );
};
