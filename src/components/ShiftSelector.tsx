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
}

export const ShiftSelector: React.FC<ShiftSelectorProps> = ({ shifts, activeShiftId, onSelect, onCreate }) => {
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800">
          <Calendar size={20} className="text-blue-600" /> Shift Management
        </h2>
        <button 
          onClick={() => setIsCreating(!isCreating)}
          className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <Plus size={20} />
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} className="flex gap-2 animate-in slide-in-from-top-2">
          <input 
            autoFocus
            className="flex-1 p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
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
          <button
            key={shift.id}
            onClick={() => onSelect(shift.id)}
            className={cn(
              "p-4 rounded-xl border text-left transition-all group relative overflow-hidden",
              activeShiftId === shift.id 
                ? "bg-blue-50 border-blue-500 ring-2 ring-blue-100" 
                : "bg-white border-gray-100 hover:border-gray-300 hover:bg-gray-50"
            )}
          >
            <div className="flex flex-col gap-1">
              <span className={cn(
                "text-sm font-bold",
                activeShiftId === shift.id ? "text-blue-700" : "text-gray-700"
              )}>
                {shift.name}
              </span>
              <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-medium">
                <Clock size={12} />
                {format(shift.startTime.toMillis(), 'MMM d, HH:mm')}
              </div>
            </div>
            {activeShiftId === shift.id && (
              <div className="absolute top-2 right-2 text-blue-600">
                <CheckCircle2 size={16} />
              </div>
            )}
          </button>
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
