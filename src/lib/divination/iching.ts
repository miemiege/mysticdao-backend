import { type Hexagram, HEXAGRAMS } from '../data/hexagrams.js';

export type CastMethod = 'random' | 'time' | 'number';

export interface LineResult {
  value: number; isChanging: boolean; type: 'yin' | 'yang';
}

export interface CastingResult {
  method: CastMethod; lines: LineResult[];
  present: Hexagram; presentNumber: number;
  transformed: Hexagram | null; transformedNumber: number | null;
  changingLineIndices: number[]; yaoText: string;
}

function castLine(): LineResult {
  const c1 = Math.random() < 0.5 ? 2 : 3;
  const c2 = Math.random() < 0.5 ? 2 : 3;
  const c3 = Math.random() < 0.5 ? 2 : 3;
  const t = c1 + c2 + c3;
  if (t === 6) return { value: 6, isChanging: true, type: 'yin' };
  if (t === 7) return { value: 7, isChanging: false, type: 'yang' };
  if (t === 8) return { value: 8, isChanging: false, type: 'yin' };
  return { value: 9, isChanging: true, type: 'yang' };
}

function seededLines(seed: number): LineResult[] {
  let s = seed >>> 0;
  const lines: LineResult[] = [];
  for (let i = 0; i < 6; i++) {
    s = (s * 1103515245 + 12345) >>> 0;
    const r1 = (s / 4294967296) < 0.5 ? 2 : 3;
    s = (s * 1103515245 + 12345) >>> 0;
    const r2 = (s / 4294967296) < 0.5 ? 2 : 3;
    s = (s * 1103515245 + 12345) >>> 0;
    const r3 = (s / 4294967296) < 0.5 ? 2 : 3;
    const t = r1 + r2 + r3;
    if (t === 6) lines.push({ value: 6, isChanging: true, type: 'yin' });
    else if (t === 7) lines.push({ value: 7, isChanging: false, type: 'yang' });
    else if (t === 8) lines.push({ value: 8, isChanging: false, type: 'yin' });
    else lines.push({ value: 9, isChanging: true, type: 'yang' });
  }
  return lines;
}

function resolveHex(lines: LineResult[]): { present: Hexagram; transformed: Hexagram | null } {
  const pl = lines.map(l => l.type === 'yang' ? 1 : 0);
  const present = HEXAGRAMS.find(h => h.lines.every((v, i) => v === pl[i]))!;
  const changing = lines.filter(l => l.isChanging);
  if (changing.length === 0) return { present, transformed: null };
  const tl = lines.map(l => l.isChanging ? (l.type === 'yang' ? 0 : 1) : (l.type === 'yang' ? 1 : 0));
  const transformed = HEXAGRAMS.find(h => h.lines.every((v, i) => v === tl[i])) || null;
  return { present, transformed };
}

function buildResult(method: CastMethod, lines: LineResult[]): CastingResult {
  const { present, transformed } = resolveHex(lines);
  const ci = lines.map((l, i) => l.isChanging ? i : -1).filter(i => i !== -1);
  return {
    method, lines, present, presentNumber: present.number,
    transformed, transformedNumber: transformed?.number || null,
    changingLineIndices: ci,
    yaoText: ci.length === 0 ? 'No changing lines: stable situation.' :
      ci.length === 1 ? `Line ${ci[0] + 1} changes: key insight.` :
      `Lines ${ci.map(i => i + 1).join(', ')} change: multiple forces.`,
  };
}

export function castRandom(): CastingResult {
  const lines: LineResult[] = [];
  for (let i = 0; i < 6; i++) lines.push(castLine());
  return buildResult('random', lines);
}

export function castByTime(date?: Date): CastingResult {
  const d = date || new Date();
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
    + d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  return buildResult('time', seededLines(seed));
}

export function castByNumber(n1: number, n2: number, n3?: number): CastingResult {
  return buildResult('number', seededLines(n1 * 1000000 + n2 * 1000 + (n3 || 0)));
}
