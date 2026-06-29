import corePathways from './pathways.json';
import additionalPathways from './additionalPathways.json';
import abdDetailed from './abdomen-detailed.json';
import expandedClinical from './expanded-clinical.json';
import criticalCare from './critical-care.json';
import expandedPresentations from './expanded-presentations.json';
import type { Pathway } from '../types/flowmaster';

// Merge all pathways, with detailed versions overriding basic entries
const allPathways = [abdDetailed, ...expandedClinical, ...corePathways, ...additionalPathways, ...criticalCare, ...expandedPresentations] as unknown as Pathway[];
// Deduplicate by id, preferring early entries (detailed versions come first)
const seen = new Set<string>();
export const pathwayRegistry = allPathways.filter((p: Pathway) => {
  if (seen.has(p.id)) return false;
  seen.add(p.id);
  return true;
});

export const getPathwayById = (id: string) => pathwayRegistry.find((pathway) => pathway.id === id) ?? pathwayRegistry[0];
