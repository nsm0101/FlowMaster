/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TeamMember } from '../types';
import { User, UserPlus, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface TeamAssignmentProps {
  teamMembers: TeamMember[];
  assignedIds: string[];
  onAssign: (id: string) => void;
  onRemove: (id: string) => void;
}

export const TeamAssignment: React.FC<TeamAssignmentProps> = ({ teamMembers, assignedIds, onAssign, onRemove }) => {
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'attending': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'fellow': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'resident': return 'bg-green-100 text-green-700 border-green-200';
      case 'student': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {teamMembers.map(member => {
          const isAssigned = assignedIds.includes(member.id);
          return (
            <button
              key={member.id}
              onClick={() => isAssigned ? onRemove(member.id) : onAssign(member.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold transition-all shadow-sm",
                isAssigned 
                  ? "bg-blue-600 border-blue-700 text-white ring-2 ring-blue-200" 
                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
              )}
            >
              <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                isAssigned ? "bg-blue-500 text-white" : getRoleColor(member.role)
              )}>
                {member.initials}
              </div>
              <span>{member.firstName} {member.lastName}</span>
              {isAssigned ? <X size={14} /> : <UserPlus size={14} />}
            </button>
          );
        })}
      </div>
    </div>
  );
};
