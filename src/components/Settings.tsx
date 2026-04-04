/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Settings as SettingsIcon, ShieldAlert, Database, Trash2, RefreshCw, Info, Eye, LogOut, User, Users, Calendar } from 'lucide-react';
import { cn } from '../lib/utils';
import { TeamMember, Shift } from '../types';
import { TeamSetup } from './TeamSetup';
import { ShiftSelector } from './ShiftSelector';

interface SettingsProps {
  onSeedData: () => void;
  onClearData: () => void;
  isLoading: boolean;
  colorBlindMode: boolean;
  onToggleColorBlindMode: (enabled: boolean) => void;
  compactMode: boolean;
  onToggleCompactMode: (enabled: boolean) => void;
  twoColumnMode: boolean;
  onToggleTwoColumnMode: (enabled: boolean) => void;
  onLogout: () => void;
  user: any;
  teamMembers: TeamMember[];
  onAddTeamMember: (member: Omit<TeamMember, 'id'>) => void;
  onRemoveTeamMember: (id: string) => void;
  shifts: Shift[];
  activeShiftId: string | null;
  onSelectShift: (id: string) => void;
  onCreateShift: (name: string) => void;
}

export const Settings: React.FC<SettingsProps> = ({ 
  onSeedData, 
  onClearData, 
  isLoading, 
  colorBlindMode, 
  onToggleColorBlindMode,
  compactMode,
  onToggleCompactMode,
  twoColumnMode,
  onToggleTwoColumnMode,
  onLogout,
  user,
  teamMembers,
  onAddTeamMember,
  onRemoveTeamMember,
  shifts,
  activeShiftId,
  onSelectShift,
  onCreateShift
}) => {
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8 space-y-8">
        <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
            <SettingsIcon size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight">System Settings</h2>
            <p className="text-sm text-gray-400 font-medium">Manage your ED workflow environment</p>
          </div>
        </div>

        {/* Shift Management */}
        <div className="space-y-4">
          <ShiftSelector 
            shifts={shifts}
            activeShiftId={activeShiftId}
            onSelect={onSelectShift}
            onCreate={onCreateShift}
          />
        </div>

        {/* Team Setup */}
        <div className="space-y-4">
          <TeamSetup 
            teamMembers={teamMembers}
            onAdd={onAddTeamMember}
            onRemove={onRemoveTeamMember}
          />
        </div>

        {/* Accessibility & Display */}
        <div className="space-y-4 pt-4">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <Eye size={14} /> Display & Accessibility
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-gray-800">Color-Blind Mode</p>
                <p className="text-[10px] text-gray-500 font-medium">Use patterns and symbols for status</p>
              </div>
              <button 
                onClick={() => onToggleColorBlindMode(!colorBlindMode)}
                className={cn(
                  "w-12 h-6 rounded-full transition-all relative",
                  colorBlindMode ? "bg-blue-600" : "bg-gray-300"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                  colorBlindMode ? "left-7" : "left-1"
                )} />
              </button>
            </div>

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-gray-800">Compact Mode</p>
                <p className="text-[10px] text-gray-500 font-medium">Condense patient cards for more info</p>
              </div>
              <button 
                onClick={() => onToggleCompactMode(!compactMode)}
                className={cn(
                  "w-12 h-6 rounded-full transition-all relative",
                  compactMode ? "bg-blue-600" : "bg-gray-300"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                  compactMode ? "left-7" : "left-1"
                )} />
              </button>
            </div>

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-gray-800">2-Column Layout</p>
                <p className="text-[10px] text-gray-500 font-medium">Split board into two columns</p>
              </div>
              <button 
                onClick={() => onToggleTwoColumnMode(!twoColumnMode)}
                className={cn(
                  "w-12 h-6 rounded-full transition-all relative",
                  twoColumnMode ? "bg-blue-600" : "bg-gray-300"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                  twoColumnMode ? "left-7" : "left-1"
                )} />
              </button>
            </div>
          </div>
        </div>

        {/* Data Management */}
        <div className="space-y-4">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <Database size={14} /> Data Management
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-blue-700 font-bold text-sm">
                <RefreshCw size={16} /> Seed Demo Data
              </div>
              <button 
                onClick={onSeedData}
                disabled={isLoading}
                className="w-full py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-sm disabled:opacity-50"
              >
                {isLoading ? "Seeding..." : "Seed Shift Data"}
              </button>
            </div>

            <div className="p-4 bg-red-50/50 border border-red-100 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                <Trash2 size={16} /> Clear Shift Data
              </div>
              <button 
                onClick={onClearData}
                disabled={isLoading}
                className="w-full py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-all shadow-sm disabled:opacity-50"
              >
                {isLoading ? "Clearing..." : "Clear Current Shift"}
              </button>
            </div>
          </div>
        </div>

        {/* Account Section */}
        <div className="space-y-4">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <User size={14} /> Account
          </h3>
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <User size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-800">{user?.email}</p>
                <p className="text-[10px] text-gray-500 font-medium tracking-tight">Authenticated Provider</p>
              </div>
            </div>
            <button 
              onClick={onLogout}
              className="px-4 py-2 bg-white border border-red-200 text-red-600 rounded-xl text-xs font-black hover:bg-red-50 transition-all flex items-center gap-2 shadow-sm"
            >
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>

        {/* Security & Compliance */}
        <div className="space-y-4 pt-4">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <ShieldAlert size={14} /> Security & Compliance
          </h3>
          <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-2xl flex gap-3">
            <Info size={20} className="text-yellow-600 shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-yellow-800">HIPAA Guardrails</p>
              <p className="text-[10px] text-yellow-700 leading-relaxed font-medium">
                This application is designed as a side-car workflow tool. 
                <strong> DO NOT enter Protected Health Information (PHI)</strong>. 
                Use only initials, age, and room numbers.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-100 text-center">
          <p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest">
            PEM FlowMaster v1.0.0 • Built for Pediatric Emergency Departments
          </p>
        </div>
      </div>
    </div>
  );
};
