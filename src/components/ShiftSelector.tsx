/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shift } from '../types';
import { Calendar, Plus, Clock, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

interface ShiftSelectorProps {
  shifts: Shift[];
  activeShiftId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onDelete: (id: string) => void;
}

export const ShiftSelector: React.FC<ShiftSelectorProps> = ({ shifts, activeShiftId, onSelect, onCreate, onDelete }) => {
  const [newShiftName, setNewShiftName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newShiftName.trim()) {
      onCreate(newShiftName.trim());
      setNewShiftName('');
      setIsCreating(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-4 space-y-4 transition-colors">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800 dark:text-gray-200">
          <Calendar size={20} className="text-blue-600 dark:text-blue-400" /> Shift Management
        </h2>
        <button 
          onClick={() => setIsCreating(!isCreating)}
          className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
        >
          <Plus size={20} />
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} className="flex gap-2 animate-in slide-in-from-top-2">
          <input 
            autoFocus
            className="flex-1 p-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
            placeholder="Shift Name (e.g., Night Shift 04/02)"
            value={newShiftName}
            onChange={(e) => setNewShiftName(e.target.value)}
          />
          <button 
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
          >
            Create
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {shifts.map(shift => (
          <div key={shift.id} className="relative group">
            <button
              onClick={() => onSelect(shift.id)}
              className={cn(
                "w-full p-4 rounded-xl border text-left transition-all overflow-hidden",
                activeShiftId === shift.id 
                  ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-500/50 ring-2 ring-blue-100 dark:ring-blue-900/50" 
                  : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              )}
            >
              <div className="flex flex-col gap-1">
                <span className={cn(
                  "text-sm font-bold",
                  activeShiftId === shift.id ? "text-blue-700 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"
                )}>
                  {shift.name}
                </span>
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                  <Clock size={12} />
                  {format(shift.startTime.toMillis(), 'MMM d, HH:mm')}
                </div>
              </div>
              {activeShiftId === shift.id && (
                <div className="absolute top-4 right-4 text-blue-600 dark:text-blue-400">
                  <CheckCircle2 size={16} />
                </div>
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('Are you sure you want to delete this shift? This action cannot be undone.')) {
                  onDelete(shift.id);
                }
              }}
              className="absolute top-2 right-2 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
              title="Delete Shift"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
            </button>
          </div>
        ))}
        {shifts.length === 0 && !isCreating && (
          <div className="col-span-full py-8 text-center text-gray-400 italic text-sm">
            No shifts found. Create one to get started.
          </div>
        )}
      </div>
    </div>
  );
};
