/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getStatusColor(status: string) {
  switch (status) {
    case 'New': return 'bg-red-500 text-white';
    case 'Staff': return 'bg-yellow-400 text-black';
    case 'Work-up': return 'bg-orange-500 text-white';
    case 'ED Observation': return 'bg-blue-900 text-white';
    case 'Likely Discharge': return 'bg-green-700 text-white';
    case 'Likely Admit': return 'bg-pink-700 text-white';
    case 'Discharge': return 'bg-green-400 text-black';
    case 'Admit': return 'bg-pink-300 text-black';
    default: return 'bg-gray-200 text-black';
  }
}

export function getStatusStyle(status: string, colorBlindMode: boolean = false) {
  const base = getStatusColor(status);
  if (!colorBlindMode) return base;

  // Add patterns/indicators for color-blind mode
  switch (status) {
    case 'New': return `${base} ring-2 ring-inset ring-black border-4 border-double border-white`;
    case 'Staff': return `${base} border-2 border-dashed border-black`;
    case 'Work-up': return `${base} ring-2 ring-inset ring-white border-2 border-dotted border-black`;
    case 'ED Observation': return `${base} border-4 border-solid border-white`;
    case 'Likely Discharge': return `${base} border-2 border-double border-black`;
    case 'Likely Admit': return `${base} border-2 border-dotted border-white`;
    case 'Discharge': return `${base} ring-2 ring-inset ring-black`;
    case 'Admit': return `${base} ring-2 ring-inset ring-white`;
    default: return base;
  }
}

export function getStatusSymbol(status: string) {
  switch (status) {
    case 'New': return '●';
    case 'Staff': return '◆';
    case 'Work-up': return '▲';
    case 'ED Observation': return '■';
    case 'Likely Discharge': return '○';
    case 'Likely Admit': return '◇';
    case 'Discharge': return '△';
    case 'Admit': return '□';
    default: return '';
  }
}

export function getTimerColor(seconds: number) {
  const minutes = seconds / 60;
  if (minutes >= 180) return '#ef4444'; // red-500
  if (minutes >= 90) {
    // Interpolate between orange and red
    const ratio = (minutes - 90) / 90;
    return ratio > 0.5 ? '#ef4444' : '#f97316'; // Simplified for now, or use hex
  }
  if (minutes > 0) {
    // Interpolate between green and orange
    const ratio = minutes / 90;
    return ratio > 0.5 ? '#f97316' : '#22c55e'; // Simplified
  }
  return '#22c55e'; // green-500
}

export function getRoleColor(role: string) {
  switch (role) {
    case 'attending': return 'bg-red-100 text-red-700 border-red-200';
    case 'fellow': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'resident': return 'bg-green-100 text-green-700 border-green-200';
    case 'student': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'nurse': return 'bg-purple-100 text-purple-700 border-purple-200';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

export function getStatusGradient(status: string) {
  switch (status) {
    case 'New': return 'bg-linear-to-b from-red-500/20 to-transparent';
    case 'Staff': return 'bg-linear-to-b from-yellow-400/20 to-transparent';
    case 'Work-up': return 'bg-linear-to-b from-orange-500/20 to-transparent';
    case 'ED Observation': return 'bg-linear-to-b from-blue-900/20 to-transparent';
    case 'Likely Discharge': return 'bg-linear-to-b from-green-700/20 to-transparent';
    case 'Likely Admit': return 'bg-linear-to-b from-pink-700/20 to-transparent';
    case 'Discharge': return 'bg-linear-to-b from-green-400/20 to-transparent';
    case 'Admit': return 'bg-linear-to-b from-pink-300/20 to-transparent';
    default: return 'bg-linear-to-b from-gray-200/20 to-transparent';
  }
}

export function getSeenBorderStyle(seenState: string) {
  switch (seenState) {
    case 'To Be Seen': return 'border-dashed border-2 border-gray-400';
    case 'Seen by Fellow': return 'border-solid border-4 border-blue-600';
    case 'Seen by Attending': return 'border-double border-8 border-purple-800';
    default: return 'border-solid border-2 border-gray-200';
  }
}
