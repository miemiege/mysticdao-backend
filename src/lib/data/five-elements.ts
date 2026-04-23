export type FiveElement = 'wood' | 'fire' | 'earth' | 'metal' | 'water';

interface StemInfo {
  name: string;
  pinyin: string;
  element: FiveElement;
}

interface BranchInfo {
  name: string;
  animal: string;
  element: FiveElement;
}

interface ElementInfo {
  en: string;
  color: string;
  direction: string;
  season: string;
}

const STEMS: Record<number, StemInfo> = {
  1: { name: '甲', pinyin: 'jiǎ', element: 'wood' },
  2: { name: '乙', pinyin: 'yǐ', element: 'wood' },
  3: { name: '丙', pinyin: 'bǐng', element: 'fire' },
  4: { name: '丁', pinyin: 'dīng', element: 'fire' },
  5: { name: '戊', pinyin: 'wù', element: 'earth' },
  6: { name: '己', pinyin: 'jǐ', element: 'earth' },
  7: { name: '庚', pinyin: 'gēng', element: 'metal' },
  8: { name: '辛', pinyin: 'xīn', element: 'metal' },
  9: { name: '壬', pinyin: 'rén', element: 'water' },
  10: { name: '癸', pinyin: 'guǐ', element: 'water' },
};

const BRANCHES: Record<number, BranchInfo> = {
  1: { name: '子', animal: 'Rat', element: 'water' },
  2: { name: '丑', animal: 'Ox', element: 'earth' },
  3: { name: '寅', animal: 'Tiger', element: 'wood' },
  4: { name: '卯', animal: 'Rabbit', element: 'wood' },
  5: { name: '辰', animal: 'Dragon', element: 'earth' },
  6: { name: '巳', animal: 'Snake', element: 'fire' },
  7: { name: '午', animal: 'Horse', element: 'fire' },
  8: { name: '未', animal: 'Goat', element: 'earth' },
  9: { name: '申', animal: 'Monkey', element: 'metal' },
  10: { name: '酉', animal: 'Rooster', element: 'metal' },
  11: { name: '戌', animal: 'Dog', element: 'earth' },
  12: { name: '亥', animal: 'Pig', element: 'water' },
};

export function getStem(index: number): StemInfo {
  const i = ((index - 1) % 10 + 10) % 10 + 1;
  return STEMS[i];
}

export function getBranch(index: number): BranchInfo {
  const i = ((index - 1) % 12 + 12) % 12 + 1;
  return BRANCHES[i];
}

export const ELEMENT_INFO: Record<FiveElement, ElementInfo> = {
  wood: { en: 'Green / Azure', color: '#2E7D32', direction: 'East', season: 'Spring' },
  fire: { en: 'Red / Vermilion', color: '#C62828', direction: 'South', season: 'Summer' },
  earth: { en: 'Yellow / Brown', color: '#F9A825', direction: 'Center', season: 'Late Summer' },
  metal: { en: 'White / Gold', color: '#B0BEC5', direction: 'West', season: 'Autumn' },
  water: { en: 'Black / Blue', color: '#1565C0', direction: 'North', season: 'Winter' },
};
