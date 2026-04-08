/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TeamMember } from '../types';
import { getRoleColor, cn } from '../lib/utils';
import { User, X, Check } from 'lucide-react';

interface RadialTeamMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (memberId: string) => void;
  teamMembers: TeamMember[];
  centerX: number;
  centerY: number;
  darkMode?: boolean;
}

export const RadialTeamMenu: React.FC<RadialTeamMenuProps> = ({
  isOpen,
  onClose,
  onSelect,
  teamMembers,
  centerX,
  centerY,
  darkMode = false
}) => {
  const [touchPos, setTouchPos] = useState({ x: centerX, y: centerY });
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  useEffect(() => {
    if (!isOpen) {
      setSelectedIndex(-1);
      return;
    }

    const handleMove = (e: PointerEvent) => {
      setTouchPos({ x: e.clientX, y: e.clientY });
      
      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 30) {
        setSelectedIndex(-1);
        return;
      }

      let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
      if (angle < 0) angle += 360;

      const count = teamMembers.length;
      if (count === 0) {
        setSelectedIndex(-1);
        return;
      }

      const segmentSize = 360 / count;
      const index = Math.round(angle / segmentSize) % count;
      
      if (index !== selectedIndex && !isNaN(index)) {
        if (navigator.vibrate) navigator.vibrate(5);
        setSelectedIndex(index);
      }
    };

    const handleUp = () => {
      if (selectedIndex !== -1 && teamMembers[selectedIndex]) {
        onSelect(teamMembers[selectedIndex].id);
      }
      onClose();
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [isOpen, centerX, centerY, selectedIndex, onSelect, onClose, teamMembers]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-md"
        />

        <motion.div 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute w-3 h-3 bg-white rounded-full shadow-lg border-2 border-blue-500 z-10"
          style={{ left: centerX - 6, top: centerY - 6 }}
        />

        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <motion.line 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            x1={centerX} 
            y1={centerY} 
            x2={touchPos.x} 
            y2={touchPos.y} 
            stroke="white" 
            strokeWidth="2" 
            strokeDasharray="4 4"
          />
        </svg>

        <div className="absolute" style={{ left: centerX, top: centerY }}>
          {teamMembers.map((member, i) => {
            const isSelected = selectedIndex === i;
            const segmentSize = 360 / teamMembers.length;
            const angle = i * segmentSize;
            
            const radius = isSelected ? 85 : 70;
            const rad = (angle - 90) * (Math.PI / 180);
            const x = Math.cos(rad) * radius;
            const y = Math.sin(rad) * radius;

            return (
              <motion.div
                key={member.id}
                initial={{ scale: 0, x: 0, y: 0, opacity: 0 }}
                animate={{ 
                  scale: isSelected ? 1.1 : 1, 
                  x, 
                  y, 
                  opacity: 1,
                  transition: { type: "spring", stiffness: 400, damping: 25 }
                }}
                className={cn(
                  "absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center gap-0.5 transition-all",
                  isSelected ? "z-20" : "z-10"
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center shadow-xl border-2 transition-all overflow-hidden",
                  isSelected 
                    ? "scale-110 border-white ring-4 ring-white/30" 
                    : "border-transparent opacity-80",
                  getRoleColor(member.role)
                )}>
                  {member.avatarUrl || member.emoji ? (
                    <div className="w-full h-full flex items-center justify-center bg-white dark:bg-gray-800">
                      {member.avatarUrl ? (
                        <img src={member.avatarUrl} alt={member.initials} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl">{member.emoji}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs font-black">{member.initials}</span>
                  )}
                </div>
                <span className={cn(
                  "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full shadow-sm whitespace-nowrap transition-all",
                  isSelected 
                    ? "bg-white text-gray-900 scale-110" 
                    : "bg-black/40 text-white opacity-60"
                )}>
                  {member.lastName}
                </span>
              </motion.div>
            );
          })}
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute left-1/2 -translate-x-1/2 bottom-24 flex flex-col items-center gap-2"
        >
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl px-6 py-3 flex items-center gap-4 shadow-2xl">
            <div className="flex flex-col items-center min-w-[120px]">
              <span className="text-[8px] font-black text-white/50 uppercase tracking-widest">Assign Member</span>
              <span className={cn(
                "text-xs font-black uppercase px-2 py-0.5 rounded-md transition-all",
                (selectedIndex !== -1 && teamMembers[selectedIndex]) ? getRoleColor(teamMembers[selectedIndex].role) : "bg-white/5 text-white/20"
              )}>
                {(selectedIndex !== -1 && teamMembers[selectedIndex]) ? `${teamMembers[selectedIndex].firstName} ${teamMembers[selectedIndex].lastName}` : 'Drag to Select'}
              </span>
            </div>
          </div>
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Release to assign to patient</p>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
