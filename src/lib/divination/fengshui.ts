// ═══════════════════════════════════════════════════════════════
// 八宅风水专业计算模块
// ═══════════════════════════════════════════════════════════════

export interface MingguaInfo {
  number: number;
  name: string;
  trigram: string;
  element: string;
  type: '东四命' | '西四命';
  yinYang: '阳' | '阴';
}

export interface DirectionLuck {
  direction: string;
  name: string;
  level: '大吉' | '吉' | '平' | '凶' | '大凶';
  description: string;
}

export interface FengshuiAnalysis {
  minggua?: MingguaInfo;
  roomType: string;
  orientation: string;
  directionLuck: DirectionLuck[];
  colorScheme: {
    main: string;
    accent: string;
    avoid: string;
  };
  layoutAdvice: string[];
  elementBalance: {
    dominant: string;
    lacking: string;
    remedy: string[];
  };
  // 兼容前端 API 格式
  sectors?: { name: string; direction: string; element: string; fortune: string; advice: string }[];
  shapeEffect?: string;
  mainElement?: string;
}

// ═══════════════════════════════════════════════════════════════
// 命卦计算
// ═══════════════════════════════════════════════════════════════

const GUA_INFO: Record<number, MingguaInfo> = {
  1: { number: 1, name: '坎命', trigram: '坎', element: '水', type: '东四命', yinYang: '阳' },
  2: { number: 2, name: '坤命', trigram: '坤', element: '土', type: '西四命', yinYang: '阴' },
  3: { number: 3, name: '震命', trigram: '震', element: '木', type: '东四命', yinYang: '阳' },
  4: { number: 4, name: '巽命', trigram: '巽', element: '木', type: '东四命', yinYang: '阴' },
  5: { number: 5, name: '艮命', trigram: '艮', element: '土', type: '西四命', yinYang: '阳' }, // 男命
  6: { number: 6, name: '乾命', trigram: '乾', element: '金', type: '西四命', yinYang: '阳' },
  7: { number: 7, name: '兑命', trigram: '兑', element: '金', type: '西四命', yinYang: '阴' },
  8: { number: 8, name: '艮命', trigram: '艮', element: '土', type: '西四命', yinYang: '阴' }, // 女命
  9: { number: 9, name: '离命', trigram: '离', element: '火', type: '东四命', yinYang: '阴' },
};

import { getYearJieqi, JIEQI_INDEX } from './jieqi-table.js';

/**
 * 判断日期是否在立春之前（用于年柱/命卦分界）— 使用精确时刻
 * 数据来源：NASA JPL DE440s 星历表
 */
function isBeforeLiChun(year: number, month: number, day: number, hour: number = 0, minute: number = 0): boolean {
  const yj = getYearJieqi(year);
  if (!yj) {
    // 超出数据范围，回退到简化判断
    if (month < 2) return true;
    if (month > 2) return false;
    return day < 4;
  }
  const lichun = yj.items[JIEQI_INDEX['立春']];
  const birth = month * 1000000 + day * 10000 + hour * 100 + minute;
  const lichunTime = lichun[0] * 1000000 + lichun[1] * 10000 + lichun[2] * 100 + lichun[3];
  return birth < lichunTime;
}

export function calculateMinggua(birthYear: number, gender: string, birthMonth?: number, birthDay?: number, birthHour?: number, birthMinute?: number): MingguaInfo {
  const isMale = gender === 'male' || gender === '男';
  // 考虑立春分界：立春前出生的算上一年
  const effectiveYear = (birthMonth && birthDay && isBeforeLiChun(birthYear, birthMonth, birthDay, birthHour || 0, birthMinute || 0))
    ? birthYear - 1 : birthYear;
  const yearDigits = effectiveYear % 100;

  let guaNum: number;
  if (isMale) {
    guaNum = (100 - yearDigits) % 9;
    if (guaNum === 0) guaNum = 9;
    // 男命5变2（坤命）
    if (guaNum === 5) guaNum = 2;
  } else {
    guaNum = (yearDigits - 4) % 9;
    if (guaNum <= 0) guaNum += 9;
    // 女命5变8（艮命）
    if (guaNum === 5) guaNum = 8;
  }

  return GUA_INFO[guaNum] || GUA_INFO[1];
}

// ═══════════════════════════════════════════════════════════════
// 吉凶方位（八宅法）
// ═══════════════════════════════════════════════════════════════

// 每个命卦对应的八方吉凶
const DIRECTION_LUCK_MAP: Record<number, DirectionLuck[]> = {
  1: [ // 坎命
    { direction: '北', name: '伏位', level: '平', description: '本命位，宜静不宜动，适合安放床位' },
    { direction: '南', name: '延年', level: '大吉', description: '最吉方位，利感情婚姻、人际关系' },
    { direction: '东南', name: '生气', level: '大吉', description: '第一吉方，利事业财运、健康康泰' },
    { direction: '东', name: '天医', level: '吉', description: '利健康、贵人运，适合安放床位或书桌' },
    { direction: '西南', name: '绝命', level: '大凶', description: '最凶方位，忌开门、安床、设灶' },
    { direction: '西', name: '祸害', level: '凶', description: '是非口舌、小人暗算，忌设大门' },
    { direction: '东北', name: '五鬼', level: '大凶', description: '火煞方位，忌设厨房、电器' },
    { direction: '西北', name: '六煞', level: '凶', description: '桃花劫、感情纠纷，忌设卧室' },
  ],
  2: [ // 坤命
    { direction: '西南', name: '伏位', level: '平', description: '本命位，宜静不宜动' },
    { direction: '西北', name: '延年', level: '大吉', description: '最吉方位，利感情婚姻' },
    { direction: '西', name: '生气', level: '大吉', description: '第一吉方，利事业财运' },
    { direction: '东北', name: '天医', level: '吉', description: '利健康、贵人运' },
    { direction: '北', name: '绝命', level: '大凶', description: '最凶方位，忌开门安床' },
    { direction: '东', name: '祸害', level: '凶', description: '是非口舌、小人暗算' },
    { direction: '东南', name: '五鬼', level: '大凶', description: '火煞方位，忌设厨房' },
    { direction: '南', name: '六煞', level: '凶', description: '桃花劫、感情纠纷' },
  ],
  3: [ // 震命
    { direction: '东', name: '伏位', level: '平', description: '本命位，宜静不宜动' },
    { direction: '东南', name: '延年', level: '大吉', description: '最吉方位，利感情婚姻' },
    { direction: '南', name: '生气', level: '大吉', description: '第一吉方，利事业财运' },
    { direction: '北', name: '天医', level: '吉', description: '利健康、贵人运' },
    { direction: '西', name: '绝命', level: '大凶', description: '最凶方位，忌开门安床' },
    { direction: '西南', name: '祸害', level: '凶', description: '是非口舌、小人暗算' },
    { direction: '西北', name: '五鬼', level: '大凶', description: '火煞方位，忌设厨房' },
    { direction: '东北', name: '六煞', level: '凶', description: '桃花劫、感情纠纷' },
  ],
  4: [ // 巽命
    { direction: '东南', name: '伏位', level: '平', description: '本命位，宜静不宜动' },
    { direction: '东', name: '延年', level: '大吉', description: '最吉方位，利感情婚姻' },
    { direction: '北', name: '生气', level: '大吉', description: '第一吉方，利事业财运' },
    { direction: '南', name: '天医', level: '吉', description: '利健康、贵人运' },
    { direction: '东北', name: '绝命', level: '大凶', description: '最凶方位，忌开门安床' },
    { direction: '西北', name: '祸害', level: '凶', description: '是非口舌、小人暗算' },
    { direction: '西', name: '五鬼', level: '大凶', description: '火煞方位，忌设厨房' },
    { direction: '西南', name: '六煞', level: '凶', description: '桃花劫、感情纠纷' },
  ],
  6: [ // 乾命
    { direction: '西北', name: '伏位', level: '平', description: '本命位，宜静不宜动' },
    { direction: '西南', name: '延年', level: '大吉', description: '最吉方位，利感情婚姻' },
    { direction: '东北', name: '生气', level: '大吉', description: '第一吉方，利事业财运' },
    { direction: '西', name: '天医', level: '吉', description: '利健康、贵人运' },
    { direction: '南', name: '绝命', level: '大凶', description: '最凶方位，忌开门安床' },
    { direction: '东南', name: '祸害', level: '凶', description: '是非口舌、小人暗算' },
    { direction: '东', name: '五鬼', level: '大凶', description: '火煞方位，忌设厨房' },
    { direction: '北', name: '六煞', level: '凶', description: '桃花劫、感情纠纷' },
  ],
  7: [ // 兑命
    { direction: '西', name: '伏位', level: '平', description: '本命位，宜静不宜动' },
    { direction: '东北', name: '延年', level: '大吉', description: '最吉方位，利感情婚姻' },
    { direction: '西北', name: '生气', level: '大吉', description: '第一吉方，利事业财运' },
    { direction: '西南', name: '天医', level: '吉', description: '利健康、贵人运' },
    { direction: '东', name: '绝命', level: '大凶', description: '最凶方位，忌开门安床' },
    { direction: '北', name: '祸害', level: '凶', description: '是非口舌、小人暗算' },
    { direction: '南', name: '五鬼', level: '大凶', description: '火煞方位，忌设厨房' },
    { direction: '东南', name: '六煞', level: '凶', description: '桃花劫、感情纠纷' },
  ],
  8: [ // 艮命（女命5）
    { direction: '东北', name: '伏位', level: '平', description: '本命位，宜静不宜动' },
    { direction: '西', name: '延年', level: '大吉', description: '最吉方位，利感情婚姻' },
    { direction: '西南', name: '生气', level: '大吉', description: '第一吉方，利事业财运' },
    { direction: '西北', name: '天医', level: '吉', description: '利健康、贵人运' },
    { direction: '东南', name: '绝命', level: '大凶', description: '最凶方位，忌开门安床' },
    { direction: '南', name: '祸害', level: '凶', description: '是非口舌、小人暗算' },
    { direction: '北', name: '五鬼', level: '大凶', description: '火煞方位，忌设厨房' },
    { direction: '东', name: '六煞', level: '凶', description: '桃花劫、感情纠纷' },
  ],
  9: [ // 离命
    { direction: '南', name: '伏位', level: '平', description: '本命位，宜静不宜动' },
    { direction: '北', name: '延年', level: '大吉', description: '最吉方位，利感情婚姻' },
    { direction: '东', name: '生气', level: '大吉', description: '第一吉方，利事业财运' },
    { direction: '东南', name: '天医', level: '吉', description: '利健康、贵人运' },
    { direction: '西北', name: '绝命', level: '大凶', description: '最凶方位，忌开门安床' },
    { direction: '东北', name: '祸害', level: '凶', description: '是非口舌、小人暗算' },
    { direction: '西南', name: '五鬼', level: '大凶', description: '火煞方位，忌设厨房' },
    { direction: '西', name: '六煞', level: '凶', description: '桃花劫、感情纠纷' },
  ],
};

export function getDirectionLuck(mingguaNum: number): DirectionLuck[] {
  return DIRECTION_LUCK_MAP[mingguaNum] || DIRECTION_LUCK_MAP[1];
}

// ═══════════════════════════════════════════════════════════════
// 方位五行
// ═══════════════════════════════════════════════════════════════

export function getOrientationElement(orientation: string): string {
  const map: Record<string, string> = {
    '北': '水', '南': '火', '东': '木', '西': '金',
    '东北': '土', '东南': '木', '西北': '金', '西南': '土',
    '北方': '水', '南方': '火', '东方': '木', '西方': '金',
    '东北方': '土', '东南方': '木', '西北方': '金', '西南方': '土',
    'North': '水', 'South': '火', 'East': '木', 'West': '金',
    'Northeast': '土', 'Southeast': '木', 'Northwest': '金', 'Southwest': '土',
  };
  return map[orientation] || '土';
}

export function getOrientationBagua(orientation: string): string {
  const map: Record<string, string> = {
    '北': '坎卦', '南': '离卦', '东': '震卦', '西': '兑卦',
    '东北': '艮卦', '东南': '巽卦', '西北': '乾卦', '西南': '坤卦',
    '北方': '坎卦', '南方': '离卦', '东方': '震卦', '西方': '兑卦',
    '东北方': '艮卦', '东南方': '巽卦', '西北方': '乾卦', '西南方': '坤卦',
  };
  return map[orientation] || '中宫';
}

// ═══════════════════════════════════════════════════════════════
// 房间类型风水建议
// ═══════════════════════════════════════════════════════════════

const ROOM_ADVICE: Record<string, { focus: string; keyPoints: string[]; avoid: string[] }> = {
  '卧室': {
    focus: '安眠养生、夫妻感情',
    keyPoints: [
      '床头宜靠实墙，忌靠窗或悬空',
      '床位最佳位于伏位或天医方',
      '卧室色调宜柔和，忌过于鲜艳',
      '保持空气流通，但忌风口直吹',
    ],
    avoid: ['镜子正对床位', '横梁压顶', '床头朝向凶方（绝命、五鬼）', '电器过多'],
  },
  '客厅': {
    focus: '聚财纳气、家庭和睦',
    keyPoints: [
      '沙发宜背靠实墙，形成靠山之势',
      '财位宜明亮整洁，可摆放招财物',
      '客厅为家中气口，宜宽敞明亮',
      '主沙发面向生气或延年方最佳',
    ],
    avoid: ['沙发背对大门', '财位堆放杂物', '尖锐物品外露', '光线昏暗'],
  },
  '书房': {
    focus: '文昌运、事业学业',
    keyPoints: [
      '书桌宜面向文昌位，背靠实墙',
      '书桌左手边宜有书架形成青龙位',
      '光线宜从左前方照射',
      '保持整洁有序，忌杂乱无章',
    ],
    avoid: ['书桌背对门窗', '座位上方有横梁', '正对厕所或厨房', '背后无靠'],
  },
  '厨房': {
    focus: '食禄、家宅安宁',
    keyPoints: [
      '炉灶不宜正对大门或卧室门',
      '水火不宜相冲（水槽与灶台不宜紧邻）',
      '厨房宜保持清洁，忌阴暗潮湿',
      '炉灶宜坐凶向吉',
    ],
    avoid: ['炉灶正对厕所', '开放式厨房火气外泄', '刀具外露', '冰箱正对炉灶'],
  },
  'Living Room': {
    focus: '聚财纳气、家庭和睦',
    keyPoints: [
      '沙发宜背靠实墙，形成靠山之势',
      '财位宜明亮整洁，可摆放招财物',
      '客厅为家中气口，宜宽敞明亮',
      '主沙发面向生气或延年方最佳',
    ],
    avoid: ['沙发背对大门', '财位堆放杂物', '尖锐物品外露', '光线昏暗'],
  },
  'Bedroom': {
    focus: '安眠养生、夫妻感情',
    keyPoints: [
      '床头宜靠实墙，忌靠窗或悬空',
      '床位最佳位于伏位或天医方',
      '卧室色调宜柔和，忌过于鲜艳',
      '保持空气流通，但忌风口直吹',
    ],
    avoid: ['镜子正对床位', '横梁压顶', '床头朝向凶方', '电器过多'],
  },
};

export function getRoomAdvice(roomType: string) {
  return ROOM_ADVICE[roomType] || ROOM_ADVICE['客厅'];
}

// ═══════════════════════════════════════════════════════════════
// 色彩搭配（基于五行）
// ═══════════════════════════════════════════════════════════════

export function getColorScheme(orientation: string, mingguaElement?: string) {
  const orientEl = getOrientationElement(orientation);

  const colorMap: Record<string, { main: string; accent: string; avoid: string }> = {
    '水': { main: '蓝色、黑色、深灰色', accent: '白色、银色（金生水）', avoid: '黄色、棕色（土克水）' },
    '火': { main: '红色、橙色、紫色', accent: '绿色、青色（木生火）', avoid: '黑色、深蓝（水克火）' },
    '木': { main: '绿色、青色、翠色', accent: '黑色、深蓝（水生木）', avoid: '白色、银色（金克木）' },
    '金': { main: '白色、银色、金色', accent: '黄色、棕色（土生金）', avoid: '红色、紫色（火克金）' },
    '土': { main: '黄色、棕色、米色', accent: '红色、橙色（火生土）', avoid: '绿色、青色（木克土）' },
  };

  return colorMap[orientEl] || colorMap['土'];
}

// ═══════════════════════════════════════════════════════════════
// 综合分析入口
// ═══════════════════════════════════════════════════════════════

export function analyzeFengshui(
  roomType: string,
  orientation: string,
  birthYear?: number,
  gender?: string,
  birthMonth?: number,
  birthDay?: number
): FengshuiAnalysis {
  const minggua = birthYear && gender ? calculateMinggua(birthYear, gender, birthMonth, birthDay) : undefined;
  const directionLuck = minggua ? getDirectionLuck(minggua.number) : getDirectionLuck(1);
  const roomAdvice = getRoomAdvice(roomType);
  const colors = getColorScheme(orientation, minggua?.element);
  const orientEl = getOrientationElement(orientation);

  // 五行平衡分析
  const elementRemedies: Record<string, string[]> = {
    '水': ['增加金属饰品（金生水）', '摆放鱼缸或水景', '使用蓝色、黑色装饰'],
    '火': ['增加木质家具（木生火）', '使用红色、橙色暖光', '摆放绿植助旺火气'],
    '木': ['增加水元素（水生木）', '多摆放绿植', '使用蓝绿色窗帘'],
    '金': ['增加土元素（土生金）', '使用陶瓷、水晶摆件', '保持空间明亮'],
    '土': ['增加火元素（火生土）', '使用暖色灯光', '摆放红色花卉'],
  };

  // 找出缺失的五行（简化版：假设房间朝向的五行过旺，需要平衡）
  const lackingMap: Record<string, string> = {
    '水': '金', '火': '木', '木': '水', '金': '土', '土': '火',
  };

  // 构建 sectors（兼容前端 API）
  const sectors = directionLuck.map(d => ({
    name: d.direction.replace(/方$/, ''),
    direction: d.direction,
    element: d.name,
    fortune: d.level,
    advice: d.description,
  }));

  return {
    minggua,
    roomType,
    orientation,
    directionLuck,
    colorScheme: colors,
    layoutAdvice: roomAdvice.keyPoints,
    elementBalance: {
      dominant: orientEl,
      lacking: lackingMap[orientEl] || '土',
      remedy: elementRemedies[orientEl] || ['保持整洁', '增加绿植', '引入自然光'],
    },
    sectors,
    shapeEffect: `该${roomType}朝向${orientation}，五行属${orientEl}。`,
    mainElement: orientEl,
  };
}
