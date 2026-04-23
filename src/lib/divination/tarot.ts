import { TAROT_DECK, SPREAD_POSITIONS, type TarotCard } from '../data/tarot-deck.js';

export type SpreadType = 'single' | 'three' | 'celtic' | 'relationship' | 'decision' | 'horseshoe';

export interface DrawnCard extends TarotCard {
  position: string; isReversed: boolean;
}

export interface SpreadResult {
  spreadType: SpreadType; spreadName: string;
  cards: DrawnCard[]; totalCards: number; timestamp: string;
}

function shuffle(): TarotCard[] {
  const d = [...TAROT_DECK];
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}

export function drawSpread(type: SpreadType, q?: string): SpreadResult {
  const d = shuffle();
  const pos = SPREAD_POSITIONS[type] || SPREAD_POSITIONS.single;
  const cards: DrawnCard[] = [];
  for (let i = 0; i < pos.length; i++) cards.push({ ...d[i], position: pos[i], isReversed: Math.random() < 0.15 });
  const names: Record<SpreadType, string> = {
    single: 'Single Card', three: 'Three Card Spread', celtic: 'Celtic Cross',
    relationship: 'Relationship Spread', decision: 'Decision Spread', horseshoe: 'Horseshoe Spread',
  };
  return { spreadType: type, spreadName: names[type], cards, totalCards: cards.length, timestamp: new Date().toISOString() };
}

export function drawDailyCard(): DrawnCard {
  const d = shuffle();
  return { ...d[0], position: 'Daily Guidance', isReversed: Math.random() < 0.15 };
}

export function getCardOfTheDay(d?: Date): DrawnCard {
  const dt = d || new Date();
  let s = dt.getFullYear() * 10000 + (dt.getMonth() + 1) * 100 + dt.getDate();
  s = (s * 1103515245 + 12345) >>> 0;
  const idx = s % TAROT_DECK.length;
  s = (s * 1103515245 + 12345) >>> 0;
  return { ...TAROT_DECK[idx], position: `Daily Card ${dt.toISOString().split('T')[0]}`, isReversed: (s / 4294967296) < 0.15 };
}
