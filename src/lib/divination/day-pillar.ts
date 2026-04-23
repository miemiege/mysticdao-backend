import { getStem, getBranch, type FiveElement, ELEMENT_INFO } from '../data/five-elements.js';

export interface DailyEnergy {
  date: string; dayPillar: { stem: string; stemPinyin: string; branch: string; branchAnimal: string };
  dayElement: FiveElement; vibe: string;
  luckyColor: string; luckyColorHex: string; luckyDirection: string; luckyNumber: number;
  bestFor: string[]; avoid: string[]; thirtySecondReset: string; cosmicTip: string;
}

export function getDayPillar(d?: Date) {
  const dt = d || new Date();
  const y = dt.getFullYear(), m = dt.getMonth() + 1, day = dt.getDate();
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  const jd = day + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  const off = jd - 2415011;
  const si = ((off % 10) + 10) % 10 + 1;
  const bi = ((off % 12) + 12) % 12 + 1;
  const s = getStem(si); const b = getBranch(bi);
  return { stem: s.name, stemPinyin: s.pinyin, branch: b.name, branchAnimal: b.animal, element: s.element };
}

export function getDailyEnergy(d?: Date): DailyEnergy {
  const dt = d || new Date();
  const p = getDayPillar(dt);
  const el = ELEMENT_INFO[p.element];

  const vibes: Record<FiveElement, string> = {
    wood: 'Growing energy. A day for planting seeds and starting new projects.',
    fire: 'Passionate energy. Express yourself boldly and connect with others.',
    earth: 'Grounded energy. Focus on stability, routine, and practical matters.',
    metal: 'Sharp energy. Cut through complexity. Make decisions with clarity.',
    water: 'Flowing energy. Go with the flow. Trust your intuition today.',
  };

  const dirs: Record<string, string> = {
    Rat: 'North', Ox: 'Northeast', Tiger: 'East', Rabbit: 'East',
    Dragon: 'Southeast', Snake: 'Southeast', Horse: 'South', Goat: 'Southwest',
    Monkey: 'West', Rooster: 'West', Dog: 'Northwest', Pig: 'Northwest',
  };

  const nums: Record<string, number> = { 甲: 3, 乙: 8, 丙: 2, 丁: 7, 戊: 5, 己: 0, 庚: 4, 辛: 9, 壬: 1, 癸: 6 };

  const best: Record<FiveElement, string[]> = {
    wood: ['Starting projects', 'Creative work', 'Learning', 'Planting'],
    fire: ['Presentations', 'Socializing', 'Romance', 'Teaching'],
    earth: ['Planning', 'Organizing', 'Finance', 'Real estate'],
    metal: ['Decision-making', 'Analysis', 'Decluttering', 'Negotiation'],
    water: ['Reflection', 'Research', 'Meditation', 'Writing'],
  };

  const avoid: Record<FiveElement, string[]> = {
    wood: ['Impulsive decisions', 'Cutting corners'],
    fire: ['Arguments', 'Overcommitting'],
    earth: ['Rushing', 'Taking big risks'],
    metal: ['Emotional decisions', 'Procrastination'],
    water: ['Overthinking', 'Isolation'],
  };

  const resets: Record<FiveElement, string> = {
    wood: 'Stand tall, arms reaching up like branches. Breathe in growth. Exhale tension.',
    fire: 'Place hands over heart. Feel warmth spreading. Smile. Release.',
    earth: 'Feel your feet on the ground. Root down. Breathe slowly for 30 seconds.',
    metal: 'Sit tall. Close eyes. Imagine clarity like a polished mirror.',
    water: 'Flow your arms like waves. Move with the breath. Let go.',
  };

  const tips: Record<FiveElement, string> = {
    wood: 'The universe supports new beginnings today. Plant a seed.',
    fire: 'Your inner light is visible to others. Share it generously.',
    earth: 'Slow and steady wins the race. Build something that lasts.',
    metal: 'Precision is power. Cut away what no longer serves you.',
    water: 'The path of least resistance leads to the ocean. Trust the flow.',
  };

  return {
    date: dt.toISOString().split('T')[0],
    dayPillar: { stem: p.stem, stemPinyin: p.stemPinyin, branch: p.branch, branchAnimal: p.branchAnimal },
    dayElement: p.element, vibe: vibes[p.element],
    luckyColor: el.en, luckyColorHex: el.color, luckyDirection: dirs[p.branchAnimal] || 'Center',
    luckyNumber: nums[p.stem] || 5,
    bestFor: best[p.element], avoid: avoid[p.element],
    thirtySecondReset: resets[p.element], cosmicTip: tips[p.element],
  };
}
