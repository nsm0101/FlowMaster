import corePathways from './pathways.json';
import additionalPathways from './additionalPathways.json';
import type { Pathway } from '../types/flowmaster';

export const pathwayRegistry = [...corePathways, ...additionalPathways] as Pathway[];

export const getPathwayById = (id: string) => pathwayRegistry.find((pathway) => pathway.id === id) ?? pathwayRegistry[0];
