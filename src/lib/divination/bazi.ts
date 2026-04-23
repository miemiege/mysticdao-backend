import { getStem, getBranch, type FiveElement, ELEMENT_INFO } from '../data/five-elements.js';
import { getYearJieqi, JIEQI_INDEX } from './jieqi-table.js';
import { toSolarTime } from './solar-time.js';

export interface BaziPillar {
  stem: string; stemPinyin: string; stemElement: FiveElement;
  branch: string; branchAnimal: string; branchElement: FiveElement;
  hiddenStems: string[];
  shiShen?: string; // 十神（相对于日主）
}

export interface FourPillars {
  year: BaziPillar; month: BaziPillar; day: BaziPillar; hour: BaziPillar;
  dayMaster: { stem: string; element: FiveElement; pinyin: string };
  nayin?: string; // 年柱纳音
}

export interface FiveElementsCount {
  wood: number; fire: number; earth: number; metal: number; water: number;
}

export interface TenGodInfo {
  name: string;
  description: string;
  nature: '吉' | '凶' | '中性';
}

export interface DayunInfo {
  ganzhi: string;
  stem: string;
  branch: string;
  startAge: number;
  endAge: number;
  shiShen: string;
}

export interface XiyongShen {
  dayMasterStrength: '强' | '弱' | '中和';
  xiyong: string;   // 喜用神
  jishen: string;   // 忌神
  yongshen: string; // 用神
}

// ═══════════════════════════════════════════════════════════════
// 精确节气时刻（1900-2100）
// 数据来源：NASA JPL DE440s 星历表 + Skyfield 天文库
// 精度：分钟级
// ═══════════════════════════════════════════════════════════════

/** 判断出生时间是否在立春之前（年柱分界）— 使用精确时刻 */
function isBeforeLiChun(year: number, month: number, day: number, hour: number = 0, minute: number = 0): boolean {
  const yj = getYearJieqi(year);
  if (!yj) {
    // 超出数据范围，回退到简化判断
    if (month < 2) return true;
    if (month > 2) return false;
    return day < 4;
  }
  const lichun = yj.items[JIEQI_INDEX['立春']];
  // 比较出生时刻与立春时刻
  const birth = month * 1000000 + day * 10000 + hour * 100 + minute;
  const lichunTime = lichun[0] * 1000000 + lichun[1] * 10000 + lichun[2] * 100 + lichun[3];
  return birth < lichunTime;
}

/** 计算年柱的"干支年"（考虑立春分界，精确到分钟） */
function getGanZhiYear(year: number, month: number, day: number, hour: number = 0, minute: number = 0): number {
  return isBeforeLiChun(year, month, day, hour, minute) ? year - 1 : year;
}

// ═══════════════════════════════════════════════════════════════
// 基础数据
// ═══════════════════════════════════════════════════════════════

function hiddenStems(bi: number): string[] {
  const h: Record<number, string[]> = {
    1: ['癸'], 2: ['己', '癸', '辛'], 3: ['甲', '丙', '戊'], 4: ['乙'],
    5: ['戊', '乙', '癸'], 6: ['丙', '戊', '庚'], 7: ['丁', '己'],
    8: ['己', '丁', '乙'], 9: ['庚', '壬', '戊'], 10: ['辛'],
    11: ['戊', '辛', '丁'], 12: ['壬', '甲'],
  };
  return h[bi] || [];
}

function stemIndex(name: string): number {
  return ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'].indexOf(name) + 1;
}

function branchIndex(name: string): number {
  return ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'].indexOf(name) + 1;
}

// 天干五行
const STEM_ELEMENT: Record<string, FiveElement> = {
  甲: 'wood', 乙: 'wood', 丙: 'fire', 丁: 'fire', 戊: 'earth',
  己: 'earth', 庚: 'metal', 辛: 'metal', 壬: 'water', 癸: 'water',
};

// 天干阴阳
const STEM_YINYANG: Record<string, 'yang' | 'yin'> = {
  甲: 'yang', 乙: 'yin', 丙: 'yang', 丁: 'yin', 戊: 'yang',
  己: 'yin', 庚: 'yang', 辛: 'yin', 壬: 'yang', 癸: 'yin',
};

// 地支五行
const BRANCH_ELEMENT: Record<string, FiveElement> = {
  子: 'water', 丑: 'earth', 寅: 'wood', 卯: 'wood', 辰: 'earth',
  巳: 'fire', 午: 'fire', 未: 'earth', 申: 'metal', 酉: 'metal',
  戌: 'earth', 亥: 'water',
};

// ═══════════════════════════════════════════════════════════════
// 十神计算
// ═══════════════════════════════════════════════════════════════

// 五行相生：木→火→土→金→水→木
const SHENG: Record<FiveElement, FiveElement> = {
  wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood',
};

// 五行相克：木→土→水→火→金→木
const KE: Record<FiveElement, FiveElement> = {
  wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood',
};

export function calculateShiShen(dayStem: string, targetStem: string): string {
  if (dayStem === targetStem) return '比肩';

  const dayEl = STEM_ELEMENT[dayStem];
  const targetEl = STEM_ELEMENT[targetStem];
  const dayYy = STEM_YINYANG[dayStem];
  const targetYy = STEM_YINYANG[targetStem];
  const sameYy = dayYy === targetYy;

  if (targetEl === dayEl) return sameYy ? '比肩' : '劫财';
  if (SHENG[dayEl] === targetEl) return sameYy ? '食神' : '伤官';
  if (KE[dayEl] === targetEl) return sameYy ? '偏财' : '正财';
  if (SHENG[targetEl] === dayEl) return sameYy ? '偏印' : '正印';
  if (KE[targetEl] === dayEl) return sameYy ? '七杀' : '正官';

  return '未知';
}

export const SHI_SHEN_INFO: Record<string, TenGodInfo> = {
  '比肩': { name: '比肩', description: '同我同性，代表自我意识、独立、兄弟姐妹、朋友助力', nature: '中性' },
  '劫财': { name: '劫财', description: '同我异性，代表竞争、争夺、合作关系、冒险精神', nature: '中性' },
  '食神': { name: '食神', description: '我生同性，代表才华、口福、享受、创造力、温和', nature: '吉' },
  '伤官': { name: '伤官', description: '我生异性，代表才华外露、叛逆、创新、口才、锋芒', nature: '中性' },
  '偏财': { name: '偏财', description: '我克同性，代表意外之财、投资、父亲、风流', nature: '吉' },
  '正财': { name: '正财', description: '我克异性，代表稳定收入、妻子、勤劳、务实', nature: '吉' },
  '七杀': { name: '七杀', description: '克我同性，代表压力、挑战、权威、魄力、小人', nature: '凶' },
  '正官': { name: '正官', description: '克我异性，代表地位、名誉、约束、贵人、丈夫', nature: '吉' },
  '偏印': { name: '偏印', description: '生我同性，代表偏门学问、灵感、孤独、继母', nature: '中性' },
  '正印': { name: '正印', description: '生我异性，代表学问、贵人、母亲、慈悲、保护', nature: '吉' },
};

// ═══════════════════════════════════════════════════════════════
// 纳音五行
// ═══════════════════════════════════════════════════════════════

const NAYIN_TABLE: Record<string, string> = {
  '甲子': '海中金', '乙丑': '海中金', '丙寅': '炉中火', '丁卯': '炉中火',
  '戊辰': '大林木', '己巳': '大林木', '庚午': '路旁土', '辛未': '路旁土',
  '壬申': '剑锋金', '癸酉': '剑锋金', '甲戌': '山头火', '乙亥': '山头火',
  '丙子': '涧下水', '丁丑': '涧下水', '戊寅': '城头土', '己卯': '城头土',
  '庚辰': '白蜡金', '辛巳': '白蜡金', '壬午': '杨柳木', '癸未': '杨柳木',
  '甲申': '泉中水', '乙酉': '泉中水', '丙戌': '屋上土', '丁亥': '屋上土',
  '戊子': '霹雳火', '己丑': '霹雳火', '庚寅': '松柏木', '辛卯': '松柏木',
  '壬辰': '长流水', '癸巳': '长流水', '甲午': '沙中金', '乙未': '沙中金',
  '丙申': '山下火', '丁酉': '山下火', '戊戌': '平地木', '己亥': '平地木',
  '庚子': '壁上土', '辛丑': '壁上土', '壬寅': '金箔金', '癸卯': '金箔金',
  '甲辰': '覆灯火', '乙巳': '覆灯火', '丙午': '天河水', '丁未': '天河水',
  '戊申': '大驿土', '己酉': '大驿土', '庚戌': '钗钏金', '辛亥': '钗钏金',
  '壬子': '桑柘木', '癸丑': '桑柘木', '甲寅': '大溪水', '乙卯': '大溪水',
  '丙辰': '沙中土', '丁巳': '沙中土', '戊午': '天上火', '己未': '天上火',
  '庚申': '石榴木', '辛酉': '石榴木', '壬戌': '大海水', '癸亥': '大海水',
};

export function getNayin(stem: string, branch: string): string {
  return NAYIN_TABLE[`${stem}${branch}`] || '未知';
}

// ═══════════════════════════════════════════════════════════════
// 节气计算（用于精确月柱）
// ═══════════════════════════════════════════════════════════════

/**
 * 使用精确节气时刻计算月支
 * 12节令（非中气）决定月柱分界：立春、惊蛰、清明、立夏、芒种、小暑、
 * 立秋、白露、寒露、立冬、大雪、小寒
 */
function getMonthBranchByJieqi(year: number, month: number, day: number, hour: number = 0, minute: number = 0): number {
  const yj = getYearJieqi(year);
  if (!yj) {
    // 超出数据范围，回退到简化判断
    if (month < 2) return 12; // 亥月（上一年）
    if (month === 2 && day < 4) return 12;
    return ((month + 10) % 12) + 1; // 简化映射
  }

  // 节令到月支的映射
  const branchMap: Record<string, number> = {
    '立春': 3, '惊蛰': 4, '清明': 5, '立夏': 6, '芒种': 7, '小暑': 8,
    '立秋': 9, '白露': 10, '寒露': 11, '立冬': 12, '大雪': 1, '小寒': 2,
  };

  // 节令顺序（一年中先后出现的顺序）
  const order = ['立春', '惊蛰', '清明', '立夏', '芒种', '小暑',
                 '立秋', '白露', '寒露', '立冬', '大雪', '小寒'];

  const birth = month * 1000000 + day * 10000 + hour * 100 + minute;

  // 找到出生时刻所在的节令区间
  for (let i = 0; i < order.length; i++) {
    const jqName = order[i];
    const jq = yj.items[JIEQI_INDEX[jqName as keyof typeof JIEQI_INDEX]];
    const jqTime = jq[0] * 1000000 + jq[1] * 10000 + jq[2] * 100 + jq[3];
    if (birth < jqTime) {
      // 在当前节令之前，属于上一个节令区间
      const prevName = order[(i - 1 + 12) % 12];
      return branchMap[prevName];
    }
  }
  // 在小寒之后到次年立春之前
  return branchMap['小寒']; // 丑月
}

// ═══════════════════════════════════════════════════════════════
// 四柱排盘
// ═══════════════════════════════════════════════════════════════

function getYearPillar(year: number, month: number = 1, day: number = 1, hour: number = 0, minute: number = 0): BaziPillar {
  const gzYear = getGanZhiYear(year, month, day, hour, minute);
  const off = gzYear - 1984;
  const si = ((off % 10) + 10) % 10 + 1;
  const bi = ((off % 12) + 12) % 12 + 1;
  const s = getStem(si); const b = getBranch(bi);
  return {
    stem: s.name, stemPinyin: s.pinyin, stemElement: s.element,
    branch: b.name, branchAnimal: b.animal, branchElement: b.element, hiddenStems: hiddenStems(bi),
  };
}

function getMonthPillar(year: number, month: number, day: number, hour: number = 0, minute: number = 0): BaziPillar {
  const yp = getYearPillar(year, month, day, hour, minute);
  const ysi = stemIndex(yp.stem);

  // 使用精确节气时刻计算月支
  const mbi = getMonthBranchByJieqi(year, month, day, hour, minute);

  // 月干计算：五虎遁月诀
  // 甲己之年丙作首，乙庚之岁戊为头，丙辛之岁寻庚起，丁壬壬位顺行流，戊癸之年甲字求
  const yearGanBase: Record<string, number> = {
    '甲': 3, '己': 3,  // 丙
    '乙': 5, '庚': 5,  // 戊
    '丙': 7, '辛': 7,  // 庚
    '丁': 9, '壬': 9,  // 壬
    '戊': 1, '癸': 1,  // 甲
  };
  const baseGan = yearGanBase[yp.stem] || 1;
  // 正月(寅月)的月干 = baseGan，然后依次顺推
  // mbi=3(寅)是正月，mbi=4(卯)是二月...
  const monthOffset = mbi - 3; // 寅月是0偏移
  const msi = (((baseGan - 1 + monthOffset) % 10) + 10) % 10 + 1;

  const s = getStem(msi); const b = getBranch(mbi);
  return {
    stem: s.name, stemPinyin: s.pinyin, stemElement: s.element,
    branch: b.name, branchAnimal: b.animal, branchElement: b.element, hiddenStems: hiddenStems(mbi),
  };
}

function getDayPillar(year: number, month: number, day: number): BaziPillar {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  const jd = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  const off = jd - 2415011; // 修正参考点：1899-12-22 = 甲子日
  const si = ((off % 10) + 10) % 10 + 1;
  const bi = ((off % 12) + 12) % 12 + 1;
  const s = getStem(si); const b = getBranch(bi);
  return {
    stem: s.name, stemPinyin: s.pinyin, stemElement: s.element,
    branch: b.name, branchAnimal: b.animal, branchElement: b.element, hiddenStems: hiddenStems(bi),
  };
}

function getHourPillar(dayStem: string, hour: number): BaziPillar {
  const bi = Math.floor(((hour + 1) % 24) / 2) + 1;
  const dsi = stemIndex(dayStem);
  // 五鼠遁时诀：甲己还加甲，乙庚丙作初，丙辛从戊起，丁壬庚子居，戊癸何方发，壬子是真途
  const hourGanBase: Record<number, number> = {
    1: 1, 6: 1,   // 甲己 -> 甲(1)
    2: 3, 7: 3,   // 乙庚 -> 丙(3)
    3: 5, 8: 5,   // 丙辛 -> 戊(5)
    4: 7, 9: 7,   // 丁壬 -> 庚(7)
    5: 9, 10: 9,  // 戊癸 -> 壬(9)
  };
  const baseGan = hourGanBase[dsi] || 1;
  // 子时(1) = baseGan, 丑时(2) = baseGan+1...
  const si = (((baseGan - 1 + bi - 1) % 10) + 10) % 10 + 1;
  const s = getStem(si); const b = getBranch(bi);
  return {
    stem: s.name, stemPinyin: s.pinyin, stemElement: s.element,
    branch: b.name, branchAnimal: b.animal, branchElement: b.element, hiddenStems: hiddenStems(bi),
  };
}

// ═══════════════════════════════════════════════════════════════
// 大运排法
// ═══════════════════════════════════════════════════════════════

/**
 * 计算出生日期到最近节气的天数差（用于起运岁数）— 使用精确节气时刻
 * 阳男阴女：顺数到下一个节令
 * 阴男阳女：逆数到上一个节令
 * 返回天数（用于 ÷3 计算起运岁数）
 */
function getDaysToJieqi(year: number, month: number, day: number, hour: number, minute: number, forward: boolean): number {
  const yj = getYearJieqi(year);
  if (!yj) {
    // 超出数据范围，回退到默认3天
    return 3;
  }

  // 节令列表（决定月柱的12个节令）
  const order = ['立春', '惊蛰', '清明', '立夏', '芒种', '小暑',
                 '立秋', '白露', '寒露', '立冬', '大雪', '小寒'];

  const birthTimestamp = new Date(year, month - 1, day, hour, minute).getTime();
  let minDiffMs = Infinity;
  let found = false;

  for (const jqName of order) {
    const jq = yj.items[JIEQI_INDEX[jqName as keyof typeof JIEQI_INDEX]];
    const jqTimestamp = new Date(year, jq[0] - 1, jq[1], jq[2], jq[3]).getTime();
    const diff = jqTimestamp - birthTimestamp;

    if (forward && diff > 0 && diff < minDiffMs) {
      minDiffMs = diff;
      found = true;
    } else if (!forward && diff < 0 && Math.abs(diff) < minDiffMs) {
      minDiffMs = Math.abs(diff);
      found = true;
    }
  }

  if (!found) {
    // 如果没找到（边界情况），可能跨年
    // 顺排：找次年的第一个节令（立春）
    if (forward) {
      const nextYj = getYearJieqi(year + 1);
      if (nextYj) {
        const nextLichun = nextYj.items[JIEQI_INDEX['立春']];
        const jqTimestamp = new Date(year + 1, nextLichun[0] - 1, nextLichun[1], nextLichun[2], nextLichun[3]).getTime();
        minDiffMs = jqTimestamp - birthTimestamp;
        found = true;
      }
    } else {
      // 逆排：找上一年的最后一个节令（小寒）
      const prevYj = getYearJieqi(year - 1);
      if (prevYj) {
        const prevXiaohan = prevYj.items[JIEQI_INDEX['小寒']];
        const jqTimestamp = new Date(year - 1, prevXiaohan[0] - 1, prevXiaohan[1], prevXiaohan[2], prevXiaohan[3]).getTime();
        minDiffMs = birthTimestamp - jqTimestamp;
        found = true;
      }
    }
  }

  if (!found) return 3;
  // 转换为天数（保留1位小数）
  return Math.round((minDiffMs / 86400000) * 10) / 10;
}

export function calculateDayun(
  yearStem: string,
  monthPillar: BaziPillar,
  gender: string,
  birthYear?: number,
  birthMonth?: number,
  birthDay?: number,
  birthHour?: number,
  birthMinute?: number
): DayunInfo[] {
  const isYangYear = STEM_YINYANG[yearStem] === 'yang';
  const isMale = gender === 'male' || gender === '男';

  // 阳年男命顺排，阴年男命逆排
  // 阳年女命逆排，阴年女命顺排
  const forward = (isYangYear && isMale) || (!isYangYear && !isMale);

  // 计算起运岁数（出生日到最近节气的天数 ÷ 3）
  let startAge = 0;
  if (birthYear && birthMonth && birthDay) {
    const days = getDaysToJieqi(birthYear, birthMonth, birthDay, birthHour || 0, birthMinute || 0, forward);
    startAge = Math.round((days / 3) * 10) / 10; // 保留1位小数
  }

  const dayun: DayunInfo[] = [];
  let currentSi = stemIndex(monthPillar.stem);
  let currentBi = branchIndex(monthPillar.branch);

  for (let i = 0; i < 8; i++) {
    if (forward) {
      currentSi = ((currentSi % 10) + 10) % 10 + 1;
      currentBi = ((currentBi % 12) + 12) % 12 + 1;
    } else {
      currentSi = currentSi === 1 ? 10 : currentSi - 1;
      currentBi = currentBi === 1 ? 12 : currentBi - 1;
    }
    const s = getStem(currentSi);
    const b = getBranch(currentBi);
    const sa = i === 0 ? startAge : Math.round((startAge + i * 10) * 10) / 10;
    const ea = Math.round((startAge + i * 10 + 9) * 10) / 10;
    dayun.push({
      ganzhi: `${s.name}${b.name}`,
      stem: s.name,
      branch: b.name,
      startAge: sa,
      endAge: ea,
      shiShen: '', // 需要结合日主计算
    });
  }

  return dayun;
}

// ═══════════════════════════════════════════════════════════════
// 喜用神分析
// ═══════════════════════════════════════════════════════════════

export function analyzeXiyongShen(pillars: FourPillars, counts: FiveElementsCount): XiyongShen {
  const dmEl = pillars.dayMaster.element;
  const total = counts.wood + counts.fire + counts.earth + counts.metal + counts.water;
  if (total === 0) {
    return { dayMasterStrength: '中和', xiyong: '平衡', jishen: '失衡', yongshen: '调和' };
  }

  // 计算日主得分（包含通根和生助）
  let dmScore = 0;
  // 日主本身
  dmScore += 1;
  // 月令（月支）对日主的生助
  const monthEl = pillars.month.branchElement;
  const monthSS = calculateShiShen(pillars.dayMaster.stem, pillars.month.stem);
  if (['比肩', '劫财', '正印', '偏印'].includes(monthSS)) dmScore += 1.5;
  // 日支对日主的生助
  const daySS = calculateShiShen(pillars.dayMaster.stem, pillars.day.stem);
  if (['比肩', '劫财', '正印', '偏印'].includes(daySS)) dmScore += 1;
  // 年柱和时柱
  [pillars.year, pillars.hour].forEach(p => {
    const ss = calculateShiShen(pillars.dayMaster.stem, p.stem);
    if (['比肩', '劫财', '正印', '偏印'].includes(ss)) dmScore += 0.5;
  });
  // 藏干
  const allHidden = [
    ...pillars.year.hiddenStems, ...pillars.month.hiddenStems,
    ...pillars.day.hiddenStems, ...pillars.hour.hiddenStems,
  ];
  allHidden.forEach(hs => {
    const ss = calculateShiShen(pillars.dayMaster.stem, hs);
    if (['比肩', '劫财', '正印', '偏印'].includes(ss)) dmScore += 0.3;
  });

  // 判断强弱
  let strength: '强' | '弱' | '中和';
  if (dmScore >= 3.5) strength = '强';
  else if (dmScore <= 1.5) strength = '弱';
  else strength = '中和';

  // 确定喜用神
  // 身强喜克泄耗（官杀、食伤、财星），身弱喜生扶（印星、比劫）
  const xiyongMap: Record<FiveElement, Record<string, string>> = {
    wood: { strong: '金、火、土', weak: '水、木', balanced: '平衡五行' },
    fire: { strong: '水、土、金', weak: '木、火', balanced: '平衡五行' },
    earth: { strong: '木、金、水', weak: '火、土', balanced: '平衡五行' },
    metal: { strong: '火、水、木', weak: '土、金', balanced: '平衡五行' },
    water: { strong: '土、木、火', weak: '金、水', balanced: '平衡五行' },
  };

  const jishenMap: Record<FiveElement, Record<string, string>> = {
    wood: { strong: '水、木', weak: '金、土', balanced: '偏枯之五行' },
    fire: { strong: '木、火', weak: '水、金', balanced: '偏枯之五行' },
    earth: { strong: '火、土', weak: '木、水', balanced: '偏枯之五行' },
    metal: { strong: '土、金', weak: '火、木', balanced: '偏枯之五行' },
    water: { strong: '金、水', weak: '土、火', balanced: '偏枯之五行' },
  };

  const strengthKey = strength === '强' ? 'strong' : strength === '弱' ? 'weak' : 'balanced';

  return {
    dayMasterStrength: strength,
    xiyong: xiyongMap[dmEl][strengthKey],
    jishen: jishenMap[dmEl][strengthKey],
    yongshen: strength === '强' ? '官杀、食伤、财星' : strength === '弱' ? '印星、比劫' : '调和',
  };
}

// ═══════════════════════════════════════════════════════════════
// 主入口
// ═══════════════════════════════════════════════════════════════

/**
 * 四柱排盘主入口
 * @param year 公历年份
 * @param month 公历月份（1-12）
 * @param day 公历日期
 * @param hour 出生小时（0-23）
 * @param minute 出生分钟（可选）
 * @param gender 性别（'male'|'female'，用于大运计算）
 * @param useZiShi 子时处理：'early'早子时(23-24算次日) 或 'same'当日（默认）
 * @param longitude 出生地经度（东经为正，不传则默认120°北京时间）
 */
export function calculateFourPillars(
  year: number, month: number, day: number, hour: number,
  minute: number = 0, gender?: string, useZiShi: 'early' | 'same' = 'same',
  longitude?: number
): FourPillars {
  // 真太阳时换算（如果提供了经度）
  let calcYear = year, calcMonth = month, calcDay = day, calcHour = hour, calcMinute = minute;
  if (longitude !== undefined && !isNaN(longitude)) {
    const solar = toSolarTime(year, month, day, hour, minute, longitude);
    calcYear = solar.year;
    calcMonth = solar.month;
    calcDay = solar.day;
    calcHour = solar.hour;
    calcMinute = solar.minute;
  }

  // 处理早子时（23:00-24:00算次日）
  if (useZiShi === 'early' && calcHour >= 23) {
    const nextDay = new Date(calcYear, calcMonth - 1, calcDay + 1);
    calcYear = nextDay.getFullYear();
    calcMonth = nextDay.getMonth() + 1;
    calcDay = nextDay.getDate();
  }

  const yp = getYearPillar(calcYear, calcMonth, calcDay, calcHour, calcMinute);
  const mp = getMonthPillar(calcYear, calcMonth, calcDay, calcHour, calcMinute);
  const dp = getDayPillar(calcYear, calcMonth, calcDay);
  const hp = getHourPillar(dp.stem, calcHour);

  return {
    year: yp, month: mp, day: dp, hour: hp,
    dayMaster: { stem: dp.stem, element: dp.stemElement, pinyin: dp.stemPinyin },
    nayin: getNayin(yp.stem, yp.branch),
  };
}

export function countFiveElements(p: FourPillars): FiveElementsCount {
  const c = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  const add = (e: FiveElement) => { c[e]++; };
  [p.year, p.month, p.day, p.hour].forEach(x => { add(x.stemElement); add(x.branchElement); });
  [...p.year.hiddenStems, ...p.month.hiddenStems, ...p.day.hiddenStems, ...p.hour.hiddenStems].forEach(hs => {
    const e = STEM_ELEMENT[hs] as FiveElement;
    if (e) c[e] += 0.5;
  });
  return c;
}

export function getElementPercentages(c: FiveElementsCount): FiveElementsCount {
  const t = c.wood + c.fire + c.earth + c.metal + c.water;
  if (t === 0) return c;
  return {
    wood: Math.round(c.wood / t * 100), fire: Math.round(c.fire / t * 100),
    earth: Math.round(c.earth / t * 100), metal: Math.round(c.metal / t * 100),
    water: Math.round(c.water / t * 100),
  };
}

export function getDayMasterPersonality(e: FiveElement): {
  title: string; description: string; strengths: string[]; challenges: string[];
} {
  const p: Record<FiveElement, any> = {
    wood: {
      title: '仁木之格', description: '如参天大树，向上生长，有领导力和创造力。仁慈正直，胸怀宽广，乐于助人。',
      strengths: ['富有创造力', '适应力强', '仁慈博爱', '坚韧不拔'],
      challenges: ['有时过于理想化', '容易犹豫不决', '对批评较敏感'],
    },
    fire: {
      title: '礼火之格', description: '如太阳烛照，热情洋溢，善于感染他人。待人真诚，充满活力，富有感染力。',
      strengths: ['热情洋溢', '表达能力强', '慷慨大方', '乐观积极'],
      challenges: ['容易急躁冲动', '耐心不足', '情绪波动较大'],
    },
    earth: {
      title: '信土之格', description: '如大地承载，稳重踏实，值得信赖。厚道守信，包容万物，给予他人安全感。',
      strengths: ['稳重可靠', '耐心细致', '务实理性', '包容力强'],
      challenges: ['有时过于保守', '变革意识较弱', '容易固执己见'],
    },
    metal: {
      title: '义金之格', description: '如精铁利刃，果断坚毅，追求完美。重情重义，原则性强，做事有条理。',
      strengths: ['果断坚毅', '公正理性', '执行力强', '追求完美'],
      challenges: ['有时过于刚硬', '情感表达不足', '对自己要求过高'],
    },
    water: {
      title: '智水之格', description: '如深海静流，智慧深邃，善于应变。聪明灵活，直觉敏锐，善于沟通协调。',
      strengths: ['智慧深邃', '灵活应变', '直觉敏锐', '善于沟通'],
      challenges: ['容易多思多虑', '有时缺乏主见', '情绪易受外界影响'],
    },
  };
  return p[e];
}

// 为四柱各柱标注十神
export function annotateShiShen(pillars: FourPillars): FourPillars {
  const dm = pillars.dayMaster.stem;
  const annotate = (p: BaziPillar): BaziPillar => ({
    ...p,
    shiShen: calculateShiShen(dm, p.stem),
  });
  return {
    ...pillars,
    year: annotate(pillars.year),
    month: annotate(pillars.month),
    day: annotate(pillars.day),
    hour: annotate(pillars.hour),
  };
}
