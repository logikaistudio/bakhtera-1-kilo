import { commonPairs, loginPairs, sidebarPairs } from './dictionaries/common';
import { dashboardPairs } from './dictionaries/dashboard';
import { financeDocPairs } from './dictionaries/financeDocs';

const allPairs = [
    ...commonPairs,
    ...loginPairs,
    ...sidebarPairs,
    ...dashboardPairs,
    ...financeDocPairs,
];

const en = {};
const id = {};

// Direction: any known source text -> target language text.
allPairs.forEach(([english, indonesian]) => {
    id[english] = indonesian;
    en[indonesian] = english;
    // Identity entries so a text present in both languages never gets re-mapped by later pairs.
    id[indonesian] = indonesian;
    en[english] = english;
});

export const translations = { en, id };
