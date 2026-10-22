import { commonPairs, loginPairs, sidebarPairs } from './dictionaries/common';
import { dashboardPairs } from './dictionaries/dashboard';
import { financeDocPairs } from './dictionaries/financeDocs';
import { financeDocsSweepPairs } from './dictionaries/financeDocsSweep';
import { quotationArApPairs } from './dictionaries/quotationArAp';
import { blinkPagePairs } from './dictionaries/blinkPages';
import { bridgeBigPairs1 } from './dictionaries/bridgeBig1';
import { bridgeBigPairs2 } from './dictionaries/bridgeBig2';

const allPairs = [
    ...commonPairs,
    ...loginPairs,
    ...sidebarPairs,
    ...dashboardPairs,
    ...financeDocPairs,
    ...financeDocsSweepPairs,
    ...quotationArApPairs,
    ...blinkPagePairs,
    ...bridgeBigPairs1,
    ...bridgeBigPairs2,
];

const en = {};
const id = {};

// Direction: any known source text -> target language text.
// Optional 3rd element: explicit English text for a source key that mixes both languages.
allPairs.forEach(([english, indonesian, englishOverride]) => {
    if (englishOverride !== undefined) {
        id[english] = indonesian;
        en[english] = englishOverride;
        return;
    }
    id[english] = indonesian;
    en[indonesian] = english;
    // Identity entries so a text present in both languages never gets re-mapped by later pairs.
    id[indonesian] = indonesian;
    en[english] = english;
});

export const translations = { en, id };
