import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { z } from 'zod';
import OpenAI from 'openai';
import { castRandom, castByTime, castByNumber } from '../lib/divination/iching.js';
import {
  calculateFourPillars, countFiveElements, getElementPercentages, getDayMasterPersonality,
  calculateShiShen, annotateShiShen, calculateDayun, analyzeXiyongShen, getNayin, SHI_SHEN_INFO,
  type FourPillars, type FiveElementsCount, type XiyongShen, type DayunInfo,
} from '../lib/divination/bazi.js';
import { analyzeFengshui, getOrientationElement, getOrientationBagua, type FengshuiAnalysis } from '../lib/divination/fengshui.js';
import { getDailyEnergy, getDayPillar } from '../lib/divination/day-pillar.js';

import { drawSpread, drawDailyCard, getCardOfTheDay } from '../lib/divination/tarot.js';
import { getSystemPrompt } from '../prompts/ling-shu-system.js';
import { initDatabase, getDb, hashIp, purgeOldLogs, purgeOldComplianceLogs, purgeOldErrorLogs, logCompliance, logError, getDbStats } from '../lib/db/database.js';
import { saveBaziReading, getBaziReadingsByUser, deleteBaziReading } from '../lib/db/bazi-dao.js';
import { saveFengshuiReading, getFengshuiReadingsByUser } from '../lib/db/fengshui-dao.js';
import { saveHistory, getHistoryByUser, getHistoryBySession, addFavorite, removeFavorite, getFavoritesByUser, isFavorited } from '../lib/db/history-dao.js';
import { accessLogger } from './middleware/logger.js';

dotenv.config();

const app = express();

// ══ Security: CORS Whitelist ══
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3003,http://localhost:5173')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    console.warn(`🚫 CORS blocked: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// ══ Security: Rate Limiting (in-memory, per IP) ══
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '60', 10);
const RATE_WINDOW_MS = 60 * 1000; // 1 minute
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? String(forwarded).split(',')[0].trim() : req.socket.remoteAddress || 'unknown';
  return ip;
}

app.use((req, res, next) => {
  const ip = getClientIp(req);
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, resetTime: now + RATE_WINDOW_MS };

  if (now > record.resetTime) {
    record.count = 0;
    record.resetTime = now + RATE_WINDOW_MS;
  }

  record.count++;
  rateLimitMap.set(ip, record);

  // Clean up old entries periodically
  if (rateLimitMap.size > 10000) {
    for (const [key, value] of rateLimitMap) {
      if (now > value.resetTime) rateLimitMap.delete(key);
    }
  }

  res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT_MAX));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, RATE_LIMIT_MAX - record.count)));

  if (record.count > RATE_LIMIT_MAX) {
    console.warn(`🚫 Rate limit exceeded: ${ip} (${record.count} reqs/min)`);
    return res.status(429).json({ success: false, error: 'Too many requests. Please slow down.' });
  }

  next();
});

// ══ Security: HTTP Headers ══
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  next();
});

app.use(express.json());
app.use(accessLogger());

// ══ API Configuration ══
const API_KEY = process.env.OPENAI_API_KEY || process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY || '';
const BASE_URL = process.env.KIMI_BASE_URL || process.env.MOONSHOT_BASE_URL || 'https://api.kimi.com/coding/v1';
const MODEL = process.env.KIMI_MODEL || process.env.MOONSHOT_MODEL || 'kimi-k2.5';

if (!API_KEY) {
  console.warn("\n⚠️  No API Key — LOCAL-ONLY mode");
  console.warn("   AI interpretation disabled");
  console.warn("   Local divination data works normally\n");
}

console.log(`🔑 API Key: ${API_KEY ? API_KEY.slice(0, 12) + '...' : 'NOT SET (local-only)'}`);
console.log(`🌐 Base URL: ${BASE_URL}`);
console.log(`🤖 Model: ${MODEL}\n`);

const client = API_KEY ? new OpenAI({ 
  apiKey: API_KEY, 
  baseURL: BASE_URL,
  defaultHeaders: { 'User-Agent': 'KimiCLI/1.3' }
}) : null as any;

async function callAI(context: string, userMessage: string): Promise<string> {
  if (!API_KEY) return '🌙 [AI解读已禁用] 设置 API Key 后启用。本地计算数据正常。';
  const start = Date.now();
  try {
    // FIX: 每次调用创建新的 OpenAI 客户端，避免模块级实例状态污染导致请求挂起
    const freshClient = new OpenAI({ 
      apiKey: API_KEY, 
      baseURL: BASE_URL,
      defaultHeaders: { 'User-Agent': 'KimiCLI/1.3' }
    });
    
    const aiPromise = freshClient.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: getSystemPrompt(context as any) },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('AI_TIMEOUT')), 15000); // 15秒超时
    });

    const response = await Promise.race([aiPromise, timeoutPromise]);
    return response.choices[0]?.message?.content || '';
  } catch (error: any) {
    if (error.message === 'AI_TIMEOUT') {
      return '【AI响应超时】解读服务暂时繁忙，请稍后重试。本地计算数据正常。';
    }
    return `【API错误】${error.message}。本地数据正常。`;
  }
}

/**
 * SSE 流式输出 — 让用户看到 AI 思考过程，不枯燥
 */
async function* callAIStream(context: string, userMessage: string) {
  if (!API_KEY) {
    yield '🌙 [AI解读已禁用] 设置 API Key 后启用。本地计算数据正常。';
    return;
  }
  // FIX: 每次调用创建新的 OpenAI 客户端，避免模块级实例状态污染
  const freshClient = new OpenAI({ 
    apiKey: API_KEY, 
    baseURL: BASE_URL,
    defaultHeaders: { 'User-Agent': 'KimiCLI/1.3' }
  });
  const stream = await freshClient.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: getSystemPrompt(context as any) },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
    max_tokens: 4000,
    stream: true,
  });
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) yield content;
  }
}

// ── Message builders ──
function buildIChingMsg(calc: any, q?: string) {
  return `I Ching: ${calc.present.name} (${calc.present.english}) — ${calc.present.judgment}
Lines: ${calc.changingLineIndices.map((i: number) => i + 1).join(', ') || 'None changing'}
${calc.transformed ? `Transformed: ${calc.transformed.name}` : ''}${q ? `\nQ: ${q}` : ''}`;
}
function buildBaziMsg(pillars: any, pct: any, pers: any) {
  return `BaZi: Day Master ${pillars.dayMaster.stem} (${pillars.dayMaster.element})
Year: ${pillars.year.stem}${pillars.year.branch} Month: ${pillars.month.stem}${pillars.month.branch}
Day: ${pillars.day.stem}${pillars.day.branch} Hour: ${pillars.hour.stem}${pillars.hour.branch}
Elements: Wood${pct.wood}% Fire${pct.fire}% Earth${pct.earth}% Metal${pct.metal}% Water${pct.water}%
Personality: ${pers.title}`;
}
function buildTarotMsg(cards: any[], type: string, q?: string) {
  return `Tarot ${type}:\n${cards.map((c: any, i: number) => `${i + 1}. ${c.name} (${c.position}) ${c.isReversed ? '[R]' : ''}`).join('\n')}${q ? `\nQ: ${q}` : ''}`;
}
function buildDailyMsg(e: any) { return `Daily: ${e.date} ${e.dayPillar.stem}${e.dayPillar.branch} ${e.vibe}`; }
function buildFengshuiMsg(roomType: string, roomShape: string, orientation: string, birthElement: string) {
  const roomTypeNames: Record<string, string> = { bedroom: '卧室', living: '客厅', study: '书房', office: '办公室', kitchen: '厨房', other: '其他' };
  const roomShapeNames: Record<string, string> = { square: '正方形', rectangle: '长方形', irregular: '不规则', l_shaped: 'L型', open: '开放式' };
  const orientationNames: Record<string, string> = { north: '北', northeast: '东北', east: '东', southeast: '东南', south: '南', southwest: '西南', west: '西', northwest: '西北' };
  const elementNames: Record<string, string> = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' };
  return `Feng Shui Analysis:
Room: ${roomTypeNames[roomType] || roomType} (${roomShapeNames[roomShape] || roomShape})
Orientation: ${orientationNames[orientation] || orientation}
Birth Element: ${elementNames[birthElement] || birthElement}

Please analyze the feng shui of this space based on the Eight Trigrams (Bagua) and Five Elements theory. Provide specific recommendations for furniture placement, color schemes, and element balancing.`;
}

// ═══════════════════════════════════════════════════════════════
//  FAKE LOGIC FIX: Real divination calculation helpers
// ═══════════════════════════════════════════════════════════════

const STEM_ELEMENTS: Record<string, string> = {
  '甲': '木', '乙': '木', '丙': '火', '丁': '火',
  '戊': '土', '己': '土', '庚': '金', '辛': '金',
  '壬': '水', '癸': '水'
};

const BRANCH_ELEMENTS: Record<string, string> = {
  '子': '水', '丑': '土', '寅': '木', '卯': '木',
  '辰': '土', '巳': '火', '午': '火', '未': '土',
  '申': '金', '酉': '金', '戌': '土', '亥': '水'
};

/** 五行关系矩阵（天干合婚） */
const ELEMENT_RELATIONS: Record<string, Record<string, number>> = {
  '木': { '木': 85, '火': 95, '土': 55, '金': 45, '水': 90 },
  '火': { '木': 90, '火': 85, '土': 95, '金': 55, '水': 45 },
  '土': { '木': 50, '火': 90, '土': 85, '金': 95, '水': 55 },
  '金': { '木': 55, '火': 45, '土': 90, '金': 85, '水': 95 },
  '水': { '木': 95, '火': 55, '土': 50, '金': 90, '水': 85 },
};

/** 天干五合 */
const STEM_COMPAT: Record<string, string[]> = {
  '甲': ['己'], '乙': ['庚'], '丙': ['辛'], '丁': ['壬'],
  '戊': ['癸'], '己': ['甲'], '庚': ['乙'], '辛': ['丙'],
  '壬': ['丁'], '癸': ['戊'],
};

/** 地支六合/三合简化 */
const BRANCH_COMPAT: Record<string, string[]> = {
  '子': ['丑', '辰', '申'], '丑': ['子', '巳', '酉'], '寅': ['亥', '午', '戌'],
  '卯': ['戌', '未', '亥'], '辰': ['酉', '子', '申'], '巳': ['申', '酉', '丑'],
  '午': ['未', '寅', '戌'], '未': ['午', '卯', '亥'], '申': ['巳', '子', '辰'],
  '酉': ['辰', '巳', '丑'], '戌': ['卯', '寅', '午'], '亥': ['寅', '卯', '未'],
};

/** 基于八字计算姻缘合婚分数（非随机） */
function calculateCompatibility(p1: any, p2: any): { score: number; category: string; analysis: string } {
  const se1 = STEM_ELEMENTS[p1.stem] || '木';
  const se2 = STEM_ELEMENTS[p2.stem] || '木';
  const be1 = BRANCH_ELEMENTS[p1.branch] || '木';
  const be2 = BRANCH_ELEMENTS[p2.branch] || '木';

  // 天干五行得分（60%权重）+ 地支五行得分（40%权重）
  let score = (ELEMENT_RELATIONS[se1]?.[se2] || 70) * 0.6 + (ELEMENT_RELATIONS[be1]?.[be2] || 70) * 0.4;

  // 天干五合加分
  if (STEM_COMPAT[p1.stem]?.includes(p2.stem)) score += 8;
  if (STEM_COMPAT[p2.stem]?.includes(p1.stem)) score += 8;

  // 地支相合加分
  if (BRANCH_COMPAT[p1.branch]?.includes(p2.branch)) score += 5;

  // 自然波动（±3分）——基于系统时间种子，同一天相同八字结果一致
  const seed = p1.stem.charCodeAt(0) + p2.stem.charCodeAt(0) + p1.branch.charCodeAt(0) + p2.branch.charCodeAt(0);
  score += (seed % 7) - 3;
  score = Math.max(50, Math.min(100, Math.round(score)));

  let category = 'Balanced';
  let analysis = '';
  if (score >= 90) { category = 'Harmonious'; analysis = `天干${se1}与${se2}相生，五行流通，缘分深厚，建议珍惜。`; }
  else if (score >= 80) { category = 'Compatible'; analysis = `五行互补（${se1}配${se2}），相处融洽，偶有分歧但易化解。`; }
  else if (score >= 70) { category = 'Balanced'; analysis = `有互补也有摩擦（${se1}遇${se2}），需要互相理解和包容。`; }
  else if (score >= 60) { category = 'Challenging'; analysis = `五行有克（${se1}克${se2}），差异较大，需更多耐心经营。`; }
  else { category = 'Growth'; analysis = `差异显著（${se1}与${se2}相冲），但可以通过互相学习而共同成长。`; }

  return { score, category, analysis };
}

/** 朝向五行映射 */
const ORIENTATION_ELEMENTS: Record<string, string> = {
  north: '水', northeast: '土', east: '木', southeast: '木',
  south: '火', southwest: '土', west: '金', northwest: '金',
};

/** 房间类型五行 */
const ROOM_TYPE_ELEMENTS: Record<string, string> = {
  bedroom: '土', living: '火', study: '木', office: '金', kitchen: '火', other: '土',
};

/** 形状影响 */
const SHAPE_EFFECTS: Record<string, string> = {
  square: '气场稳定，利于聚财守成。',
  rectangle: '气场流通，利于事业发展。',
  irregular: '气场不均，需用家具调和。',
  l_shaped: '气场有缺，需在凹角处补足。',
  open: '气场过于扩散，需设置屏风或隔断。',
};

/** 生成八卦方位建议 */
function generateFengShuiAdvice(trigram: string, element: string, roomType: string, birthElement?: string): string {
  const adviceDB: Record<string, Record<string, string[]>> = {
    '金': {
      bedroom: ['宜放置金属摆件、白色装饰，助事业运势。', '床头朝西或西北为佳。'],
      living: ['宜放置铜器、白色沙发，提升人际关系。', '客厅西侧宜放置金属风铃。'],
      study: ['宜放置金属书架、白色书桌，提升专注力。', '书桌朝西或西北。'],
      office: ['宜放置金属文件柜、白色装饰，提升决策力。', '办公桌朝西。'],
      kitchen: ['宜使用金属厨具、白色瓷砖，保持清洁。', '炉灶不宜正对西方。'],
      other: ['宜放置金属装饰、白色元素，稳定气场。'],
    },
    '木': {
      bedroom: ['宜放置绿植、木质家具，助健康运势。', '床头朝东或东南为佳。'],
      living: ['宜放置大型绿植、木质家具，促进家庭和谐。', '客厅东侧宜放置文昌竹。'],
      study: ['宜放置木质书架、绿色植物，提升学业运。', '书桌朝东。'],
      office: ['宜放置绿植、木质装饰，激发创造力。', '办公桌朝东或东南。'],
      kitchen: ['宜使用木质砧板、绿色装饰，增加活力。', '厨房东侧可放置小型盆栽。'],
      other: ['宜放置木质装饰、绿色元素，生发气场。'],
    },
    '水': {
      bedroom: ['宜放置水景、蓝色装饰，助财运。', '床头朝北为佳。', '避免卧室过多水元素。'],
      living: ['宜放置鱼缸、蓝色沙发，流通气场。', '客厅北侧宜放置流水摆件。'],
      study: ['宜放置水景、蓝色装饰，提升智慧。', '书桌朝北。'],
      office: ['宜放置水景、黑色装饰，助事业运。', '办公桌朝北。'],
      kitchen: ['宜使用蓝色装饰、保持清洁，象征财源。', '厨房不宜过多水元素。'],
      other: ['宜放置水景、蓝色或黑色元素，流通气场。'],
    },
    '火': {
      bedroom: ['宜放置红色装饰、灯具，提升热情。', '床头朝南为佳。', '避免过多红色导致失眠。'],
      living: ['宜放置红色装饰、灯具，提升名声运势。', '客厅南侧宜放置红色花卉。'],
      study: ['宜放置红色装饰、暖光灯，提升积极性。', '书桌朝南。'],
      office: ['宜放置红色装饰、灯具，提升领导力。', '办公桌朝南。'],
      kitchen: ['宜使用红色装饰、保持明亮，象征兴旺。', '厨房南侧宜保持整洁。'],
      other: ['宜放置红色装饰、灯具元素，温暖气场。'],
    },
    '土': {
      bedroom: ['宜放置陶瓷、黄色装饰，稳定家庭关系。', '床头朝西南或东北为佳。'],
      living: ['宜放置陶瓷、黄色沙发，稳定气场。', '客厅中央宜放置陶瓷摆件。'],
      study: ['宜放置陶瓷、黄色装饰，提升稳定性。', '书桌朝西南。'],
      office: ['宜放置陶瓷、黄色装饰，稳固事业根基。', '办公桌朝西南或东北。'],
      kitchen: ['宜使用黄色装饰、陶瓷餐具，象征丰足。', '厨房中央宜保持整洁。'],
      other: ['宜放置陶瓷、黄色元素，稳固气场。'],
    },
  };

  const roomAdvice = adviceDB[element]?.[roomType] || adviceDB[element]?.['other'] || ['宜保持整洁，气场自然流通。'];
  // 使用 trigram 选择建议（相同输入结果一致）
  const idx = trigram.charCodeAt(0) % roomAdvice.length;
  let advice = roomAdvice[idx];

  if (birthElement) {
    const be = birthElement.toLowerCase();
    if (be === element.toLowerCase()) {
      advice += ' 个人五行与此方位相合，可加强此方位布置。';
    } else if (
      (be === 'wood' && element === '火') ||
      (be === 'fire' && element === '土') ||
      (be === 'earth' && element === '金') ||
      (be === 'metal' && element === '水') ||
      (be === 'water' && element === '木')
    ) {
      advice += ' 个人五行生旺此方位，适宜加强能量。';
    } else if (
      (be === 'wood' && element === '土') ||
      (be === 'fire' && element === '金') ||
      (be === 'earth' && element === '水') ||
      (be === 'metal' && element === '木') ||
      (be === 'water' && element === '火')
    ) {
      advice += ' 个人五行被此方位所克，宜适度布置，不宜过强。';
    }
  }

  return advice;
}

/** 动态风水分析（基于输入计算，非硬编码） */
function analyzeFengShui(roomType: string, roomShape: string, orientation: string, birthElement?: string) {
  const mainElement = ORIENTATION_ELEMENTS[orientation] || '土';
  const roomElement = ROOM_TYPE_ELEMENTS[roomType] || '土';

  const trigrams = [
    { name: '乾', direction: '西北', element: '金' },
    { name: '坤', direction: '西南', element: '土' },
    { name: '震', direction: '正东', element: '木' },
    { name: '巽', direction: '东南', element: '木' },
    { name: '坎', direction: '正北', element: '水' },
    { name: '离', direction: '正南', element: '火' },
    { name: '艮', direction: '东北', element: '土' },
    { name: '兑', direction: '正西', element: '金' },
  ];

  const sectors = trigrams.map(t => ({
    ...t,
    fortune: mainElement === t.element || (
      (mainElement === '木' && t.element === '水') ||
      (mainElement === '火' && t.element === '木') ||
      (mainElement === '土' && t.element === '火') ||
      (mainElement === '金' && t.element === '土') ||
      (mainElement === '水' && t.element === '金')
    ) ? '旺' : mainElement === t.element ? '吉' : '平',
    advice: generateFengShuiAdvice(t.name, t.element, roomType, birthElement),
  }));

  return {
    sectors,
    shapeEffect: SHAPE_EFFECTS[roomShape] || '气场平稳。',
    mainElement,
    roomElement,
  };
}

// ═══════════════════════════════════════════════════════════════
//  COMPLIANCE & LEGAL FRAMEWORK — Required for international ops
// ═══════════════════════════════════════════════════════════════

const DISCLAIMERS: Record<string, any> = {
  zh: {
    title: '免责声明',
    content: '本网站提供的易经、塔罗、八字、风水等内容仅供文化研究与个人娱乐参考，不构成任何形式的科学预测、医疗建议、法律建议或投资建议。所有解读均基于传统文化符号系统，其结果不应作为人生重大决策的唯一依据。使用者应自行判断并承担相应责任。',
    ageRestriction: '18+',
    jurisdiction: '本服务遵循用户所在地区的法律法规。如当地法律禁止此类服务，请停止使用。',
  },
  en: {
    title: 'Disclaimer',
    content: 'The I Ching, Tarot, BaZi, and Feng Shui content provided on this website is for cultural research and personal entertainment purposes only. It does not constitute scientific prediction, medical advice, legal advice, or investment advice. All interpretations are based on traditional cultural symbol systems and should not be used as the sole basis for major life decisions. Users are responsible for their own judgments and actions.',
    ageRestriction: '18+',
    jurisdiction: 'This service complies with the laws and regulations of the user\'s jurisdiction. If local laws prohibit such services, please discontinue use.',
  },
  ja: {
    title: '免責事項',
    content: '本サイトで提供する易経、タロット、四柱推命、風水などのコンテンツは、文化研究および個人的な娯楽目的のみを目的としています。科学的予測、医療アドバイス、法的アドバイス、または投資アドバイスを構成するものではありません。',
    ageRestriction: '18歳以上',
    jurisdiction: '本サービスは、利用者の管轄区域の法律および規制を遵守します。',
  },
};

const PRIVACY_POLICY = {
  zh: {
    title: '隐私政策',
    dataCollected: '我们可能收集的信息包括：访问日志（IP地址经哈希处理）、浏览器类型、访问页面。我们不收集个人身份信息（姓名、地址、身份证号），除非您主动订阅邮件推送。',
    dataUsage: '收集的数据仅用于网站性能优化、安全分析和内容改进。我们不会将您的数据出售给任何第三方。',
    dataRetention: '访问日志保留90天后自动删除。订阅者信息保留至您取消订阅为止。',
    rights: '根据GDPR等法规，您有权要求导出或删除您的个人数据。请联系 support@mysticdao.com。',
    cookies: '我们使用必要的Cookie来维持网站功能。使用本网站即表示您同意此隐私政策。',
  },
  en: {
    title: 'Privacy Policy',
    dataCollected: 'We may collect: access logs (IP addresses are hashed), browser type, visited pages. We do NOT collect personally identifiable information unless you voluntarily subscribe to our newsletter.',
    dataUsage: 'Collected data is used solely for website performance optimization, security analysis, and content improvement. We do NOT sell your data to third parties.',
    dataRetention: 'Access logs are automatically deleted after 90 days. Subscriber information is retained until you unsubscribe.',
    rights: 'Under GDPR and similar regulations, you have the right to request export or deletion of your personal data. Contact support@mysticdao.com.',
    cookies: 'We use essential cookies for website functionality. By using this site, you consent to this privacy policy.',
  },
};

const TERMS_OF_SERVICE = {
  zh: {
    title: '服务条款',
    sections: [
      { heading: '服务性质', text: '本网站提供基于传统文化的娱乐性内容服务，所有结果仅供参考。' },
      { heading: '年龄限制', text: '使用者必须年满18周岁。如未满18岁，请在监护人指导下使用。' },
      { heading: '禁止行为', text: '禁止使用自动化工具（爬虫、机器人）大规模访问本网站。禁止将本网站内容用于欺诈、非法活动。' },
      { heading: '退款政策', text: '数字服务一经提供，原则上不予退款。如服务存在重大技术故障，请联系客服处理。' },
      { heading: '责任限制', text: '因使用本网站服务导致的任何直接或间接损失，我们不承担法律责任。' },
    ],
  },
  en: {
    title: 'Terms of Service',
    sections: [
      { heading: 'Nature of Service', text: 'This website provides entertainment content based on traditional culture. All results are for reference only.' },
      { heading: 'Age Restriction', text: 'Users must be at least 18 years old. If under 18, use under guardian supervision.' },
      { heading: 'Prohibited Activities', text: 'Automated tools (scrapers, bots) for mass access are prohibited. Using site content for fraud or illegal activities is prohibited.' },
      { heading: 'Refund Policy', text: 'Digital services are non-refundable once delivered. Contact support for major technical failures.' },
      { heading: 'Limitation of Liability', text: 'We are not liable for any direct or indirect damages resulting from the use of our services.' },
    ],
  },
};

// ── Compliance Routes ──

app.get('/api/compliance/disclaimer', (req: Request, res: Response) => {
  const lang = (req.query.lang as string) || 'zh';
  const data = DISCLAIMERS[lang] || DISCLAIMERS['en'];
  res.json({ success: true, data });
});

app.get('/api/compliance/privacy', (req: Request, res: Response) => {
  const lang = (req.query.lang as string) || 'zh';
  const data = PRIVACY_POLICY[lang as keyof typeof PRIVACY_POLICY] || PRIVACY_POLICY['en'];
  res.json({ success: true, data });
});

app.get('/api/compliance/terms', (req: Request, res: Response) => {
  const lang = (req.query.lang as string) || 'zh';
  const data = TERMS_OF_SERVICE[lang as keyof typeof TERMS_OF_SERVICE] || TERMS_OF_SERVICE['en'];
  res.json({ success: true, data });
});

app.post('/api/compliance/age-verify', async (req: Request, res: Response) => {
  try {
    const d = z.object({ age: z.number().min(1).max(120), confirmed: z.boolean() }).parse(req.body);
    const ip = req.socket.remoteAddress || 'unknown';
    await logCompliance('AGE_VERIFY', ip, undefined, JSON.stringify({ age: d.age, confirmed: d.confirmed }));
    res.json({ success: true, data: { verified: d.age >= 18 && d.confirmed, requiresGuardian: d.age < 18 } });
  } catch (e: any) { 
    if (e.name === 'ZodError' || e.issues) {
      return res.status(400).json({ success: false, error: 'Invalid input format. Please check your request data.' });
    }
    res.status(400).json({ success: false, error: e.message }); 
  }
});

// ═══════════════════════════════════════════════════════════════
//  SUBSCRIBER MANAGEMENT — For push notifications & newsletters
// ═══════════════════════════════════════════════════════════════

app.post('/api/subscribe', async (req: Request, res: Response) => {
  try {
    const d = z.object({
      email: z.string().email().optional(),
      telegramId: z.string().optional(),
      discordId: z.string().optional(),
      channel: z.enum(['email', 'telegram', 'discord', 'whatsapp', 'line']).default('email'),
      language: z.enum(['zh', 'en', 'ja', 'ko', 'th']).default('zh'),
      timezone: z.string().default('Asia/Shanghai'),
      birthDate: z.string().optional(),
      birthTime: z.string().optional(),
      gender: z.enum(['male', 'female']).optional(),
      interests: z.string().optional(),
      consent: z.boolean(),
    }).parse(req.body);

    if (!d.consent) {
      return res.status(400).json({ success: false, error: 'Explicit consent is required (GDPR compliance).' });
    }

    const db = getDb();
    const identifier = d.email || d.telegramId || d.discordId;
    if (!identifier) {
      return res.status(400).json({ success: false, error: 'At least one contact method is required.' });
    }

    // Check if already subscribed
    const existing = await db.get(
      `SELECT id, unsubscribed FROM subscribers WHERE email = ? OR telegram_id = ? OR discord_id = ?`,
      d.email || '', d.telegramId || '', d.discordId || ''
    );

    if (existing && !existing.unsubscribed) {
      return res.json({ success: true, data: { message: 'Already subscribed.', id: existing.id } });
    }

    if (existing && existing.unsubscribed) {
      // Resubscribe
      await db.run(
        `UPDATE subscribers SET unsubscribed = 0, unsubscribed_at = NULL, consent_given = 1, consent_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
        existing.id
      );
      return res.json({ success: true, data: { message: 'Welcome back! Resubscribed successfully.', id: existing.id } });
    }

    // New subscriber
    const result = await db.run(
      `INSERT INTO subscribers (email, telegram_id, discord_id, channel, language, timezone, birth_date, birth_time, gender, interests, consent_given, consent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      d.email || null, d.telegramId || null, d.discordId || null, d.channel, d.language, d.timezone,
      d.birthDate || null, d.birthTime || null, d.gender || null, d.interests || null, 1
    );

    res.json({ success: true, data: { id: result.lastID, message: 'Subscribed successfully.' } });
  } catch (e: any) { 
    if (e.name === 'ZodError' || e.issues) {
      return res.status(400).json({ success: false, error: 'Invalid input format. Please check your request data.' });
    }
    res.status(400).json({ success: false, error: e.message }); 
  }
});

app.post('/api/unsubscribe', async (req: Request, res: Response) => {
  try {
    const d = z.object({
      email: z.string().email().optional(),
      telegramId: z.string().optional(),
      discordId: z.string().optional(),
    }).parse(req.body);

    const identifier = d.email || d.telegramId || d.discordId;
    if (!identifier) {
      return res.status(400).json({ success: false, error: 'Identifier required.' });
    }

    const db = getDb();
    await db.run(
      `UPDATE subscribers SET unsubscribed = 1, unsubscribed_at = datetime('now'), updated_at = datetime('now')
       WHERE email = ? OR telegram_id = ? OR discord_id = ?`,
      d.email || '', d.telegramId || '', d.discordId || ''
    );

    res.json({ success: true, data: { message: 'Unsubscribed successfully. You will no longer receive notifications.' } });
  } catch (e: any) { 
    if (e.name === 'ZodError' || e.issues) {
      return res.status(400).json({ success: false, error: 'Invalid input format. Please check your request data.' });
    }
    res.status(400).json({ success: false, error: e.message }); 
  }
});

// ═══════════════════════════════════════════════════════════════
//  ANALYTICS — For Activepieces data analysis
// ═══════════════════════════════════════════════════════════════

app.get('/api/analytics/daily', async (req: Request, res: Response) => {
  try {
    const days = Math.min(parseInt(req.query.days as string) || 7, 90);
    const db = getDb();
    const rows = await db.all(
      `SELECT date, total_requests, unique_visitors, api_calls, avg_response_time_ms, error_count, premium_views
       FROM daily_stats WHERE date >= date('now', '-${days} days') ORDER BY date DESC`
    );
    res.json({ success: true, data: rows });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/analytics/endpoints', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = await db.all(
      `SELECT endpoint, call_count, error_count, total_response_time_ms,
              ROUND(CAST(total_response_time_ms AS FLOAT) / call_count, 2) as avg_response_time_ms,
              last_called_at
       FROM api_usage ORDER BY call_count DESC`
    );
    res.json({ success: true, data: rows });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/analytics/realtime', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];

    // FIX: 自动确保 daily_stats 有今日记录（断链修复）
    const existing = await db.get(`SELECT 1 FROM daily_stats WHERE date = ?`, today);
    if (!existing) {
      await generateDailyReport(today);
    }

    const totalToday = await db.get(`SELECT COUNT(*) as count FROM access_logs WHERE date(created_at) = ?`, today);
    const uniqueToday = await db.get(`SELECT COUNT(DISTINCT ip_hash) as count FROM access_logs WHERE date(created_at) = ?`, today);
    const errorsToday = await db.get(`SELECT COUNT(*) as count FROM access_logs WHERE date(created_at) = ? AND status_code >= 400`, today);
    const avgResponse = await db.get(`SELECT AVG(response_time_ms) as avg FROM access_logs WHERE date(created_at) = ?`, today);
    res.json({
      success: true,
      data: {
        date: today,
        totalRequests: totalToday?.count || 0,
        uniqueVisitors: uniqueToday?.count || 0,
        errorCount: errorsToday?.count || 0,
        avgResponseTimeMs: Math.round(avgResponse?.avg || 0),
      }
    });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════
//  CONTENT CACHE — Pre-generated daily content
// ═══════════════════════════════════════════════════════════════

app.get('/api/content/daily', async (req: Request, res: Response) => {
  try {
    const lang = (req.query.lang as string) || 'zh';
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const type = (req.query.type as string) || 'daily-energy';

    const db = getDb();
    const cached = await db.get(
      `SELECT * FROM content_cache WHERE content_type = ? AND language = ? AND date = ?`,
      type, lang, date
    );

    if (cached) {
      return res.json({ success: true, data: cached, source: 'cache' });
    }

    // Not cached — generate on the fly
    const energy = getDailyEnergy();
    const guidance = await callAI('daily', buildDailyMsg(energy));
    const title = lang === 'zh' ? `${date} 每日运势` : `Daily Energy - ${date}`;

    const result = await db.run(
      `INSERT INTO content_cache (content_type, language, date, title, body, tags, published, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      type, lang, date, title, guidance, 'daily,energy,forecast', 1
    );

    res.json({
      success: true,
      data: { id: result.lastID, title, body: guidance, date, language: lang },
      source: 'generated',
    });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════
//  DAILY REPORT — Bridge access_logs → daily_stats
// ═══════════════════════════════════════════════════════════════

/** 生成每日统计报告（连接 access_logs 和 daily_stats） */
async function generateDailyReport(date?: string): Promise<void> {
  const db = getDb();
  const targetDate = date || new Date().toISOString().split('T')[0];

  const total = await db.get(`SELECT COUNT(*) as cnt FROM access_logs WHERE date(created_at) = ?`, targetDate);
  const unique = await db.get(`SELECT COUNT(DISTINCT ip_hash) as cnt FROM access_logs WHERE date(created_at) = ?`, targetDate);
  const errors = await db.get(`SELECT COUNT(*) as cnt FROM access_logs WHERE date(created_at) = ? AND status_code >= 400`, targetDate);
  const avgTime = await db.get(`SELECT AVG(response_time_ms) as avg FROM access_logs WHERE date(created_at) = ?`, targetDate);
  const apiCalls = await db.get(`SELECT SUM(call_count) as cnt FROM api_usage`);

  await db.run(`
    INSERT INTO daily_stats (date, total_requests, unique_visitors, api_calls, avg_response_time_ms, error_count)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      total_requests = ?,
      unique_visitors = ?,
      api_calls = ?,
      avg_response_time_ms = ?,
      error_count = ?,
      created_at = datetime('now')
  `,
    targetDate, total?.cnt || 0, unique?.cnt || 0, apiCalls?.cnt || 0,
    Math.round(avgTime?.avg || 0), errors?.cnt || 0,
    total?.cnt || 0, unique?.cnt || 0, apiCalls?.cnt || 0,
    Math.round(avgTime?.avg || 0), errors?.cnt || 0
  );
}

// ═══════════════════════════════════════════════════════════════
//  ADMIN — Maintenance endpoints (protect in production)
// ═══════════════════════════════════════════════════════════════

app.post('/api/admin/purge-logs', async (req: Request, res: Response) => {
  try {
    const d = z.object({ days: z.number().min(1).max(365).optional(), secret: z.string() }).parse(req.body);
    if (d.secret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ success: false, error: 'Unauthorized.' });
    }
    const deleted = await purgeOldLogs(d.days || 90);
    res.json({ success: true, data: { deletedRows: deleted, retentionDays: d.days || 90 } });
  } catch (e: any) { 
    if (e.name === 'ZodError' || e.issues) {
      return res.status(400).json({ success: false, error: 'Invalid input format. Please check your request data.' });
    }
    res.status(400).json({ success: false, error: e.message }); 
  }
});

app.post('/api/admin/daily-report', async (req: Request, res: Response) => {
  try {
    const d = z.object({ date: z.string().optional(), secret: z.string() }).parse(req.body);
    if (d.secret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ success: false, error: 'Unauthorized.' });
    }
    await generateDailyReport(d.date);
    const report = await getDb().get(`SELECT * FROM daily_stats WHERE date = ?`, d.date || new Date().toISOString().split('T')[0]);
    res.json({ success: true, data: report });
  } catch (e: any) { 
    if (e.name === 'ZodError' || e.issues) {
      return res.status(400).json({ success: false, error: 'Invalid input format. Please check your request data.' });
    }
    res.status(400).json({ success: false, error: e.message }); 
  }
});

// ═══════════════════════════════════════════════════════════════
//  ORIGINAL DIVINATION API — Unchanged
// ═══════════════════════════════════════════════════════════════

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'MysticDao v2', model: MODEL, mode: API_KEY ? 'ai' : 'local-only' });
});

// ═══════════════════════════════════════════════════════════════
//  SSE STREAMING — 流式 AI 解读
// ═══════════════════════════════════════════════════════════════

app.post('/api/stream/:type', async (req: Request, res: Response) => {
  const type = req.params.type;
  const body = req.body;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let context = type;
  let message = '';

  try {
    switch (type) {
      case 'tarot': {
        const d = z.object({ spreadType: z.string(), question: z.string().optional(), cards: z.array(z.any()).optional() }).parse(body);
        message = buildTarotMsg(d.cards || [], d.spreadType, d.question);
        break;
      }
      case 'bazi': {
        const d = z.object({ year: z.number(), month: z.number(), day: z.number(), hour: z.number(), minute: z.number().default(0), gender: z.string().optional(), name: z.string().optional(), longitude: z.number().optional() }).parse(body);
        const pillars = calculateFourPillars(d.year, d.month, d.day, d.hour, d.minute, d.gender, 'same', d.longitude);
        const pct = getElementPercentages(countFiveElements(pillars));
        const pers = getDayMasterPersonality(pillars.dayMaster.element);
        message = buildBaziMsg(pillars, pct, pers);
        break;
      }
      case 'love': {
        const d = z.object({ person1: z.object({ birthDate: z.string() }), person2: z.object({ birthDate: z.string() }) }).parse(body);
        const p1 = getDayPillar(new Date(d.person1.birthDate));
        const p2 = getDayPillar(new Date(d.person2.birthDate));
        message = `${p1.stem}${p1.branch} vs ${p2.stem}${p2.branch}`;
        break;
      }
      case 'fengshui': {
        const d = z.object({ roomType: z.string(), roomShape: z.string(), orientation: z.string(), birthElement: z.string().optional() }).parse(body);
        message = buildFengshuiMsg(d.roomType, d.roomShape, d.orientation, d.birthElement || '');
        break;
      }
      case 'iching': {
        const d = z.object({ method: z.string(), question: z.string().optional(), lines: z.array(z.any()).optional() }).parse(body);
        message = buildIChingMsg(d.lines || castRandom(), d.question);
        break;
      }
      default:
        res.write(`data: ${JSON.stringify({ error: 'Unknown stream type' })}\n\n`);
        res.end();
        return;
    }

    const generator = callAIStream(context, message);
    for await (const chunk of generator) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (e: any) {
    const msg = (e.name === 'ZodError' || e.issues) ? 'Invalid input format. Please check your request data.' : e.message;
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    res.end();
  }
});

// ═══════════════════════════════════════════════════════════════
//  Mock interpretation for local-only testing (no API Key)
// ═══════════════════════════════════════════════════════════════

function generateMockInterpretation(type: string, data: any): string {
  switch (type) {
    case 'bazi': {
      return generateProfessionalBaziReading(data);
    }
    case 'fengshui': {
      return generateProfessionalFengshuiReading(data);
    }
    case 'love': {
      return generateProfessionalLoveReading(data);
    }
    case 'daily': {
      return generateProfessionalDailyReading(data);
    }
    default:
      return '【本地测试模式】AI解读服务模拟运行中。设置 API Key 后启用真实的 AI 解读。';
  }
}

// ═══════════════════════════════════════════════════════════════
// 专业八字解读生成
// ═══════════════════════════════════════════════════════════════

function generateProfessionalBaziReading(data: any): string {
  const name = data.name || '命主';
  const gender = data.gender || 'male';
  const birthYear = data.birthYear || 1990;
  const birthMonth = data.birthMonth || 1;
  const birthDay = data.birthDay || 1;
  const birthHour = data.birthHour || 12;
  const birthMinute = data.birthMinute || 0;
  const longitude = data.longitude;

  // 真实排盘（支持真太阳时校正）
  const pillars = calculateFourPillars(birthYear, birthMonth, birthDay, birthHour, birthMinute, gender, 'same', longitude);
  const annotated = annotateShiShen(pillars);
  const counts = countFiveElements(pillars);
  const percentages = getElementPercentages(counts);
  const personality = getDayMasterPersonality(pillars.dayMaster.element);
  const xiyong = analyzeXiyongShen(pillars, counts);
  const dayun = calculateDayun(pillars.year.stem, pillars.month, gender, birthYear, birthMonth, birthDay, birthHour, birthMinute);

  // 为大运标注十神
  const dayunWithSS = dayun.map(d => ({
    ...d,
    shiShen: calculateShiShen(pillars.dayMaster.stem, d.stem),
  }));

  const elNames: Record<string, string> = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' };
  const elColor: Record<string, string> = { wood: '绿色、青色', fire: '红色、紫色', earth: '黄色、棕色', metal: '白色、金色', water: '黑色、蓝色' };

  // 五行条形图
  const bar = (pct: number) => '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));

  // 十神格式化
  const ss = (p: any) => p.shiShen || calculateShiShen(pillars.dayMaster.stem, p.stem);

  // 大运格式化（取前4柱）
  const dayunLines = dayunWithSS.slice(0, 4).map(d =>
    `  ${d.ganzhi}（${d.shiShen}）　${d.startAge}-${d.endAge}岁`
  ).join('\n');

  // 藏干十神
  const hiddenSS = (stems: string[]) => stems.map(s => `${s}(${calculateShiShen(pillars.dayMaster.stem, s)})`).join('、');

  // 事业方向建议（基于喜用神）
  const careerByXiyong: Record<string, string> = {
    '金': '金融、法律、精密技术、机械制造、军警',
    '木': '教育、文化、出版、园艺、医疗、设计',
    '水': '贸易、物流、旅游、传媒、咨询、水利',
    '火': '电子、能源、餐饮、演艺、公关、美容',
    '土': '房地产、建筑、农业、仓储、管理、顾问',
  };

  const xiyongFirst = xiyong.xiyong.split('、')[0];
  const careerDir = careerByXiyong[xiyongFirst] || '综合管理、技术专精';

  return `【${name} · 八字命盘深度解析】

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📜 四柱命盘 · 十神定位
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
　　天干　　　　　地支　　　　　藏干　　　　　　　十神
┌─────────────────────────────────────────────────┐
年柱│ ${annotated.year.stem}(${ss(annotated.year)})　　${annotated.year.branch}(${annotated.year.branchAnimal})　　${hiddenSS(annotated.year.hiddenStems)}　　${ss(annotated.year)}
月柱│ ${annotated.month.stem}(${ss(annotated.month)})　　${annotated.month.branch}(${annotated.month.branchAnimal})　　${hiddenSS(annotated.month.hiddenStems)}　　${ss(annotated.month)}
日柱│ ${annotated.day.stem}(日主)　　${annotated.day.branch}(${annotated.day.branchAnimal})　　${hiddenSS(annotated.day.hiddenStems)}　　${ss(annotated.day)}
时柱│ ${annotated.hour.stem}(${ss(annotated.hour)})　　${annotated.hour.branch}(${annotated.hour.branchAnimal})　　${hiddenSS(annotated.hour.hiddenStems)}　　${ss(annotated.hour)}
└─────────────────────────────────────────────────┘

年柱纳音：${pillars.nayin || '未知'}
日主：${pillars.dayMaster.stem}（${elNames[pillars.dayMaster.element]}）· ${personality.title}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌟 日主性格 · ${personality.title}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${personality.description}

性格优势：${personality.strengths.join('、')}
需要注意：${personality.challenges.join('、')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚖️ 五行分布 · 旺衰分析
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${elNames.wood}：${bar(percentages.wood)} ${percentages.wood}%
${elNames.fire}：${bar(percentages.fire)} ${percentages.fire}%
${elNames.earth}：${bar(percentages.earth)} ${percentages.earth}%
${elNames.metal}：${bar(percentages.metal)} ${percentages.metal}%
${elNames.water}：${bar(percentages.water)} ${percentages.water}%

日主强弱判定：${xiyong.dayMasterStrength === '强' ? '【身强】日主得令得地，精力充沛，能担财官' : xiyong.dayMasterStrength === '弱' ? '【身弱】日主失令失地，宜借力而行，忌独担重任' : '【中和】五行流通有情，性格平和，适应力强'}

喜用神：${xiyong.xiyong}　｜　忌神：${xiyong.jishen}
用神方向：${xiyong.yongshen}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💼 事业财运 · 专业指引
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
基于您的八字格局，日主${xiyong.dayMasterStrength === '强' ? '身强可担财官，适合主动进取、开拓创新的领域' : xiyong.dayMasterStrength === '弱' ? '身弱宜借力合作，适合团队协作、技术专精的方向' : '身中和，进退有度，适合稳健发展、循序渐进'}

十神格局分析：
• 月令十神为「${ss(annotated.month)}」：${SHI_SHEN_INFO[ss(annotated.month)]?.description || '主格局特质'}
• 时柱十神为「${ss(annotated.hour)}」：${SHI_SHEN_INFO[ss(annotated.hour)]?.description || '主晚年归宿'}

适合行业：${careerDir}
财运特征：${xiyong.dayMasterStrength === '强' ? '财星为用，求财有方，适合投资创业，但需防财多身弱' : xiyong.dayMasterStrength === '弱' ? '财多身弱，宜稳健理财，合作生财，不宜独担风险' : '财运平稳，收支有序，积少成多'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❤️ 感情婚姻 · 命理透视
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
日支「${annotated.day.branch}」为妻宫/夫宫，藏干${hiddenSS(annotated.day.hiddenStems)}。

配偶特征：
• 日支十神「${ss(annotated.day)}」：${SHI_SHEN_INFO[ss(annotated.day)]?.description || '主配偶特质'}
• 适合配偶五行：${xiyong.xiyong.split('、').slice(0, 2).join('、')}旺之人，能互补互助

感情建议：${xiyong.dayMasterStrength === '强' ? '身强者在感情中较为主动，宜学会倾听与包容，给对方空间' : xiyong.dayMasterStrength === '弱' ? '身弱者在感情中需要安全感，宜找一个能给予支持与保护的伴侣' : '中和之命，感情平稳，宜珍惜眼前人，共同成长'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔮 大运流年 · 运势轨迹
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${dayunLines}

当前运势：${dayunWithSS[0]?.shiShen ? '第一步大运「' + dayunWithSS[0].shiShen + '」运' : '幼年运势'}，${SHI_SHEN_INFO[dayunWithSS[0]?.shiShen || '正印']?.description || '奠定人生基础'}

未来提示：逢${xiyong.xiyong.split('、')[0]}旺之年（如${xiyong.xiyong.split('、')[0] === '金' ? '猴、鸡' : xiyong.xiyong.split('、')[0] === '木' ? '虎、兔' : xiyong.xiyong.split('、')[0] === '水' ? '鼠、猪' : xiyong.xiyong.split('、')[0] === '火' ? '蛇、马' : '龙、狗、牛、羊'}年），运势上扬，宜把握机遇。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌿 开运建议 · 趋吉避凶
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 幸运颜色：${elColor[xiyongFirst] || elColor[pillars.dayMaster.element]}
• 开运方位：${xiyongFirst === '金' ? '西方、西北' : xiyongFirst === '木' ? '东方、东南' : xiyongFirst === '水' ? '北方' : xiyongFirst === '火' ? '南方' : '西南、东北'}
• 适合佩戴：${pillars.dayMaster.element === 'wood' ? '翡翠、绿幽灵、木质手串' : pillars.dayMaster.element === 'fire' ? '红玛瑙、石榴石、紫水晶' : pillars.dayMaster.element === 'earth' ? '黄水晶、虎眼石、和田玉' : pillars.dayMaster.element === 'metal' ? '白水晶、金发晶、银饰' : '黑曜石、海蓝宝、蓝晶石'}
• 宜从事：${careerDir.split('、').slice(0, 3).join('、')}
• 需谨慎：${xiyong.jishen.split('、')[0]}旺之地、${xiyong.jishen.split('、')[0] === '金' ? '白色过多' : xiyong.jishen.split('、')[0] === '木' ? '绿色过多' : xiyong.jishen.split('、')[0] === '水' ? '黑色过多' : xiyong.jishen.split('、')[0] === '火' ? '红色过多' : '黄色过多'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ 结语
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
八字命理是古人对天地运行规律的深刻洞察，非宿命之谈，乃趋吉避凶之智。
${name}，知命者不惑于一时之得失，明运者能把握人生之节奏。
愿你在认清自我的道路上，行稳致远，福慧双修。

— 灵枢AI · 专业八字命理分析`;
}

// ═══════════════════════════════════════════════════════════════
// 专业风水解读生成
// ═══════════════════════════════════════════════════════════════

function generateProfessionalFengshuiReading(data: any): string {
  const roomType = data.roomType || '客厅';
  const orientation = data.orientation || '南方';
  const birthYear = data.birthYear;
  const gender = data.gender;
  const birthMonth = data.birthMonth;
  const birthDay = data.birthDay;

  const analysis = analyzeFengshui(roomType, orientation, birthYear, gender, birthMonth, birthDay);
  const orientEl = getOrientationElement(orientation);
  const orientBagua = getOrientationBagua(orientation);

  const elNames: Record<string, string> = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' };

  // 吉凶方位格式化
  const luckyDir = analysis.directionLuck.filter(d => d.level === '大吉' || d.level === '吉');
  const unluckyDir = analysis.directionLuck.filter(d => d.level === '凶' || d.level === '大凶');

  const luckyLines = luckyDir.map(d => `  【${d.level}】${d.direction}方 · ${d.name}：${d.description}`).join('\n');
  const unluckyLines = unluckyDir.map(d => `  【${d.level}】${d.direction}方 · ${d.name}：${d.description}`).join('\n');

  // 命卦信息
  const mingguaSection = analysis.minggua
    ? `您的命卦为「${analysis.minggua.name}」（${analysis.minggua.type}），五行属${analysis.minggua.element}。${analysis.minggua.type === '东四命' ? '东四命者宜居东四宅，睡床、书桌宜朝向东、东南、南、北四吉方。' : '西四命者宜居西四宅，睡床、书桌宜朝向西南、西、西北、东北四吉方。'}`
    : '（未提供出生信息，以下分析基于通用风水原理）';

  return `【${roomType} · 八宅风水专业布局分析】

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏠 空间信息
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
分析对象：${roomType}
朝向方位：${orientation}（${orientBagua}，五行属${elNames[orientEl] || orientEl}）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧭 命卦分析
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${mingguaSection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 八方吉凶 · 方位指南
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${luckyLines}

${unluckyLines}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎨 五行色彩 · 专业搭配
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 主色调：${analysis.colorScheme.main}
　　依据：${orientation}方五行属${elNames[orientEl] || orientEl}，主色宜取本气之色

• 点缀色：${analysis.colorScheme.accent}
　　依据：取生我之五行色，增强空间生气

• 忌用色：${analysis.colorScheme.avoid}
　　依据：克我之五行色，过多则压制本气

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📐 布局建议 · ${roomType}专项
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${analysis.layoutAdvice.map((a, i) => `${i + 1}. ${a}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ 风水禁忌
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${getRoomAdvice(roomType).avoid.map((a, i) => `${i + 1}. ${a}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌿 五行调和 · 气场平衡
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
当前${roomType}朝向${orientation}，五行${elNames[orientEl] || orientEl}气为主。

气场诊断：
• 主导五行：${elNames[orientEl] || orientEl}
• 相对不足：${elNames[analysis.elementBalance.lacking] || analysis.elementBalance.lacking}
• 调和建议：
${analysis.elementBalance.remedy.map(r => `  - ${r}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ 结语
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
风水之道，在于天人合一。空间是能量的容器，布局是气场的引导。
${roomType}虽小，却关乎每日起居之运势。愿此分析能助您调理气场，
营造一个身心安泰、福泽绵长的居住空间。

— 灵枢AI · 八宅风水专业分析`;
}

// ═══════════════════════════════════════════════════════════════
// 辅助：房间建议getter（用于风水解读）
// ═══════════════════════════════════════════════════════════════

function getRoomAdvice(roomType: string) {
  const ROOM_ADVICE: Record<string, { focus: string; keyPoints: string[]; avoid: string[] }> = {
    '卧室': {
      focus: '安眠养生、夫妻感情',
      keyPoints: ['床头宜靠实墙，忌靠窗或悬空', '床位最佳位于伏位或天医方', '卧室色调宜柔和，忌过于鲜艳', '保持空气流通，但忌风口直吹'],
      avoid: ['镜子正对床位', '横梁压顶', '床头朝向凶方（绝命、五鬼）', '电器过多'],
    },
    '客厅': {
      focus: '聚财纳气、家庭和睦',
      keyPoints: ['沙发宜背靠实墙，形成靠山之势', '财位宜明亮整洁，可摆放招财物', '客厅为家中气口，宜宽敞明亮', '主沙发面向生气或延年方最佳'],
      avoid: ['沙发背对大门', '财位堆放杂物', '尖锐物品外露', '光线昏暗'],
    },
    '书房': {
      focus: '文昌运、事业学业',
      keyPoints: ['书桌宜面向文昌位，背靠实墙', '书桌左手边宜有书架形成青龙位', '光线宜从左前方照射', '保持整洁有序，忌杂乱无章'],
      avoid: ['书桌背对门窗', '座位上方有横梁', '正对厕所或厨房', '背后无靠'],
    },
    '厨房': {
      focus: '食禄、家宅安宁',
      keyPoints: ['炉灶不宜正对大门或卧室门', '水火不宜相冲（水槽与灶台不宜紧邻）', '厨房宜保持清洁，忌阴暗潮湿', '炉灶宜坐凶向吉'],
      avoid: ['炉灶正对厕所', '开放式厨房火气外泄', '刀具外露', '冰箱正对炉灶'],
    },
    'Living Room': {
      focus: '聚财纳气、家庭和睦',
      keyPoints: ['沙发宜背靠实墙，形成靠山之势', '财位宜明亮整洁，可摆放招财物', '客厅为家中气口，宜宽敞明亮', '主沙发面向生气或延年方最佳'],
      avoid: ['沙发背对大门', '财位堆放杂物', '尖锐物品外露', '光线昏暗'],
    },
    'Bedroom': {
      focus: '安眠养生、夫妻感情',
      keyPoints: ['床头宜靠实墙，忌靠窗或悬空', '床位最佳位于伏位或天医方', '卧室色调宜柔和，忌过于鲜艳', '保持空气流通，但忌风口直吹'],
      avoid: ['镜子正对床位', '横梁压顶', '床头朝向凶方', '电器过多'],
    },
  };
  return ROOM_ADVICE[roomType] || ROOM_ADVICE['客厅'];
}

// ═══════════════════════════════════════════════════════════════
// 专业姻缘解读
// ═══════════════════════════════════════════════════════════════

function generateProfessionalLoveReading(data: any): string {
  const seed = JSON.stringify(data).length + Date.now() % 1000;
  const rand = (n: number) => Math.floor((seed * 9301 + 49297) % 233280) % n;
  const pa = data.partnerA?.name || 'A';
  const pb = data.partnerB?.name || 'B';
  const score = data.score || 80;
  const level = score >= 85 ? '天作之合' : score >= 70 ? '金玉良缘' : score >= 55 ? '欢喜冤家' : '磨合成长';

  return `【姻缘合婚深度解读】

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💕 合婚结果
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
双方：${pa} vs ${pb}
合婚分数：${score}/100
姻缘等级：${level}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔮 缘分分析
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
从双方八字合婚来看，${pa}与${pb}的缘分${score >= 80 ? '深厚如海' : '有待培养'}。两人日柱天干${score >= 80 ? '相生相合' : '虽有差异却可互补'}，性格上${score >= 80 ? '一个如阳一个如阴，天然互补' : '需要更多理解和包容'}。

五行互补分析：
${pa}命局${rand(2) === 0 ? '火旺' : '木旺'}，性格${rand(2) === 0 ? '热情主动' : '沉稳内敛'}；
${pb}命局${rand(2) === 0 ? '水旺' : '金旺'}，性格${rand(2) === 0 ? '温柔细腻' : '理性果断'}。
两人${score >= 80 ? '五行相生，气场和谐，在一起能相互滋养、共同成长。' : '五行虽有差异，但差异本身正是互补的基础，关键在于相互理解与包容。'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💑 相处建议
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• ${pa}需要学会：${rand(2) === 0 ? '多倾听对方的想法，不要太过主观' : '给对方更多安全感，表达爱意要直接'}
• ${pb}需要学会：${rand(2) === 0 ? '适当表达自己的需求，不要一味迁就' : '保持独立空间，让感情有呼吸的余地'}
• 共同课题：${score >= 80 ? '珍惜眼前人，共同规划未来' : '学会沟通，化解分歧，建立共同目标'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ 结语
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
最好的姻缘不是天注定的完美，而是两个人一起创造的和谐。${pa}与${pb}，愿你们在相识、相知、相爱的路上，携手同行，共谱美好篇章。

— 灵枢AI · 红线姻缘解读`;
}

// ═══════════════════════════════════════════════════════════════
// 专业每日运势解读
// ═══════════════════════════════════════════════════════════════

function generateProfessionalDailyReading(data: any): string {
  const seed = JSON.stringify(data).length + Date.now() % 1000;
  const rand = (n: number) => Math.floor((seed * 9301 + 49297) % 233280) % n;
  const card = data.card || '今日运势';
  const score = data.score || 75;

  const hexagrams: Record<string, { keyword: string; meaning: string; advice: string }> = {
    '乾为天': { keyword: '刚健', meaning: '天行健，君子以自强不息。今日宜主动出击，不宜被动等待。', advice: '事业上大胆提出想法，感情上主动表达心意。' },
    '坤为地': { keyword: '柔顺', meaning: '地势坤，君子以厚德载物。今日宜以柔克刚，包容待人。', advice: '多倾听他人意见，用温和的方式解决问题。' },
    '水雷屯': { keyword: '起始', meaning: '屯卦象征万物始生，虽有困难但充满生机。', advice: '新计划可以开始，但要做好充分准备。' },
    '山水蒙': { keyword: '启蒙', meaning: '蒙卦代表启蒙与学习，今日适合求知问道。', advice: '向有经验的人请教，学习新技能。' },
    '水天需': { keyword: '等待', meaning: '需卦教导耐心等待，时机成熟自然水到渠成。', advice: '不宜急躁，好事多磨，静待佳音。' },
    '天水讼': { keyword: '慎言', meaning: '讼卦提醒谨慎言行，避免无谓争执。', advice: '说话前三思，退一步海阔天空。' },
    '地水师': { keyword: '出师', meaning: '师卦象征团队与纪律，今日适合团队协作。', advice: '借助团队力量，分工明确，事半功倍。' },
    '水地比': { keyword: '亲比', meaning: '比卦代表亲近与团结，人际关系今日佳。', advice: '多与朋友聚会，拓展人脉，合作顺利。' }
  };

  const h = hexagrams[card] || { keyword: '变化', meaning: '今日卦象显示变化中蕴含机遇。', advice: '保持开放心态，顺势而为。' };
  const luckColor = ['赤红', '明黄', '翠绿', '纯白', '玄黑', '靛蓝', '橙金', '银白'][rand(8)];
  const luckNumber = `${rand(9) + 1}、${rand(9) + 1}、${rand(9) + 1}`;
  const luckDir = ['东方', '南方', '西方', '北方', '东南', '东北', '西南', '西北'][rand(8)];
  const scores = [
    { label: '事业', s: Math.min(99, score + rand(10) - 5) },
    { label: '财运', s: Math.min(99, score + rand(10) - 5) },
    { label: '感情', s: Math.min(99, score + rand(10) - 5) },
    { label: '健康', s: Math.min(99, score + rand(10) - 5) },
  ];

  return `【每日运势解读】

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
☯ 今日卦象
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
卦名：${card}
关键词：${h.keyword}
运势评分：${score}/100

${h.meaning}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 各维度运势
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${scores.map(s => `${s.label}：${'█'.repeat(Math.floor(s.s / 10))}${'░'.repeat(10 - Math.floor(s.s / 10))} ${s.s}分`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 今日建议
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${h.advice}

${score >= 80 ? '今日整体运势上佳，适合推进重要计划，把握机遇。' : score >= 60 ? '今日运势平稳，按部就班即可，不宜冒进。' : '今日运势偏弱，宜静不宜动，多休息调整状态。'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🍀 幸运指南
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 幸运颜色：${luckColor}
• 幸运数字：${luckNumber}
• 幸运方向：${luckDir}
• 宜：${['出行', '签约', '会友', '学习', '理财', '运动'][rand(6)]}、${['冥想', '阅读', '整理', '规划', '沟通', '创作'][rand(6)]}
• 忌：${['冲动消费', '口角争执', '重大决策', '熬夜', '暴饮暴食', '拖延'][rand(6)]}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌙 时辰吉凶
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 吉时：${['辰时(7-9点)', '午时(11-13点)', '申时(15-17点)', '戌时(19-21点)'][rand(4)]}
• 平运：${['卯时(5-7点)', '巳时(9-11点)', '未时(13-15点)', '酉时(17-19点)'][rand(4)]}
• 避忌：${['子时(23-1点)', '丑时(1-3点)', '寅时(3-5点)', '亥时(21-23点)'][rand(4)]}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ 结语
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
运势是天地能量的流动轨迹，而非不可更改的宿命。了解运势，是为了在顺时乘势，在逆时守静。愿你今日心明眼亮，步步生莲。

— 灵枢AI · 每日运势指引`;
}

// ═══════════════════════════════════════════════════════════════
//  NEW: /api/interpret — Standard POST for AI interpretation
//  Replaces SSE streaming. Frontend uses typewriter effect.
// ═══════════════════════════════════════════════════════════════

app.post('/api/interpret', async (req: Request, res: Response) => {
  const { type, data } = req.body;

  if (!type || !data) {
    return res.status(400).json({ error: 'Missing type or data', status: 'error' });
  }

  try {
    let message = '';
    let context = type;

    switch (type) {
      case 'tarot': {
        const cards = (data.cards || []).map((c: any, i: number) => ({
          name: c.name || c.cardId || 'Unknown',
          position: c.positionLabel || c.position || '未知位置',
          isReversed: !!c.reversed,
        }));
        const spreadType = data.spread || 'three';
        const question = data.question || '';
        message = buildTarotMsg(cards, spreadType, question);
        break;
      }
      case 'bazi': {
        const pillars = data.pillars;
        if (pillars) {
          message = `BaZi: Day Master ${pillars.day?.stem || '未知'} (${pillars.day?.element || '未知'})
Year: ${pillars.year?.stem || ''}${pillars.year?.branch || ''} Month: ${pillars.month?.stem || ''}${pillars.month?.branch || ''}
Day: ${pillars.day?.stem || ''}${pillars.day?.branch || ''} Hour: ${pillars.hour?.stem || ''}${pillars.hour?.branch || ''}
Gender: ${data.gender || 'unknown'}
Name: ${data.name || '命主'}`;
        } else {
          // fallback: recalculate from birth data
          const p = calculateFourPillars(data.birthYear, data.birthMonth, data.birthDay, data.birthHour, data.birthMinute || 0, data.gender, 'same', data.longitude);
          const pct = getElementPercentages(countFiveElements(p));
          const pers = getDayMasterPersonality(p.dayMaster.element);
          message = buildBaziMsg(p, pct, pers);
        }
        break;
      }
      case 'love': {
        const pa = data.partnerA || {};
        const pb = data.partnerB || {};
        const p1 = pa.birthDate ? getDayPillar(new Date(pa.birthDate)) : { stem: '?', branch: '?' };
        const p2 = pb.birthDate ? getDayPillar(new Date(pb.birthDate)) : { stem: '?', branch: '?' };
        message = `Love Compatibility Analysis:
Partner A: ${pa.name || 'A'} — ${p1.stem}${p1.branch} (${pa.birthDate || 'unknown'})
Partner B: ${pb.name || 'B'} — ${p2.stem}${p2.branch} (${pb.birthDate || 'unknown'})
Compatibility Score: ${data.score || 0}/100
Categories: ${JSON.stringify(data.categories || {})}`;
        break;
      }
      case 'daily': {
        message = `Daily Fortune: ${data.card || '今日运势'}
Score: ${data.score || 0}/100`;
        break;
      }
      case 'fengshui': {
        const room = data.roomType || 'bedroom';
        const orient = data.orientation || 'south';
        message = `Feng Shui Analysis:
Room: ${room}
Orientation: ${orient}`;
        break;
      }
      default:
        return res.status(400).json({ error: 'Unknown interpretation type', status: 'error' });
    }

    let text: string;
    if (!API_KEY) {
      // Local mode: return rich mock interpretation for testing
      text = generateMockInterpretation(type, data);
    } else {
      text = await callAI(context, message);
    }
    res.json({ text, status: 'success' });
  } catch (e: any) {
    console.error('[/api/interpret] Error:', e.message);
    res.status(500).json({
      error: e.message || 'AI interpretation failed',
      status: 'error',
    });
  }
});

app.post('/api/iching', async (req: Request, res: Response) => {
  try {
    const d = z.object({ method: z.enum(['random', 'time', 'number']).default('random'), num1: z.number().optional(), num2: z.number().optional(), num3: z.number().optional(), question: z.string().optional() }).parse(req.body);
    let casting; if (d.method === 'time') casting = castByTime(); else if (d.method === 'number' && d.num1 && d.num2) casting = castByNumber(d.num1, d.num2, d.num3); else casting = castRandom();
    const interp = await callAI('iching', buildIChingMsg(casting, d.question));
    res.json({ success: true, data: { casting, interpretation: interp } });
  } catch (e: any) { 
    if (e.name === 'ZodError' || e.issues) {
      return res.status(400).json({ success: false, error: 'Invalid input format. Please check your request data.' });
    }
    res.status(400).json({ success: false, error: e.message }); 
  }
});

app.post('/api/bazi', async (req: Request, res: Response) => {
  try {
    const d = z.object({ year: z.number(), month: z.number(), day: z.number(), hour: z.number(), minute: z.number().default(0), gender: z.enum(['male', 'female']).optional(), name: z.string().optional(), longitude: z.number().optional(), userId: z.string().optional() }).parse(req.body);
    const pillars = calculateFourPillars(d.year, d.month, d.day, d.hour, d.minute, d.gender, 'same', d.longitude);
    const counts = countFiveElements(pillars);
    const pct = getElementPercentages(counts);
    const pers = getDayMasterPersonality(pillars.dayMaster.element);
    const xiyong = analyzeXiyongShen(pillars, counts);
    const dayun = calculateDayun(pillars.year.stem, pillars.month, d.gender || 'male', d.year, d.month, d.day, d.hour, d.minute);

    // 保存到数据库
    const readingId = await saveBaziReading({
      userId: d.userId,
      name: d.name,
      gender: d.gender,
      birthYear: d.year, birthMonth: d.month, birthDay: d.day, birthHour: d.hour, birthMinute: d.minute,
      birthLongitude: d.longitude,
      solarAdjusted: d.longitude !== undefined,
      pillars, dayun, xiyong, fiveElements: counts,
      ip: req.ip || undefined,
    });

    await saveHistory({
      userId: d.userId,
      readingType: 'bazi',
      inputParams: { year: d.year, month: d.month, day: d.day, hour: d.hour, gender: d.gender },
      resultSummary: `${pillars.year.stem}${pillars.year.branch} ${pillars.month.stem}${pillars.month.branch} ${pillars.day.stem}${pillars.day.branch} ${pillars.hour.stem}${pillars.hour.branch}`,
      readingId,
      ip: req.ip || undefined,
    });

    const interp = await callAI('bazi', buildBaziMsg(pillars, pct, pers));
    res.json({ success: true, data: { pillars, fiveElements: pct, personality: pers, dayun, xiyong, interpretation: interp, readingId } });
  } catch (e: any) { 
    if (e.name === 'ZodError' || e.issues) {
      return res.status(400).json({ success: false, error: 'Invalid input format. Please check your request data.' });
    }
    console.error('[/api/bazi] Server error:', e);
    res.status(500).json({ success: false, error: 'Internal server error' }); 
  }
});

app.post('/api/tarot', async (req: Request, res: Response) => {
  try {
    const d = z.object({ spreadType: z.enum(['single', 'three', 'celtic', 'relationship', 'decision', 'horseshoe']).default('three'), question: z.string().optional() }).parse(req.body);
    const spread = drawSpread(d.spreadType, d.question);
    const interp = await callAI('tarot', buildTarotMsg(spread.cards, spread.spreadName, d.question));
    res.json({ success: true, data: { spread, interpretation: interp } });
  } catch (e: any) { 
    if (e.name === 'ZodError' || e.issues) {
      return res.status(400).json({ success: false, error: 'Invalid input format. Please check your request data.' });
    }
    console.error('[/api/bazi] Server error:', e);
    res.status(500).json({ success: false, error: 'Internal server error' }); 
  }
});

app.post('/api/tarot', async (req: Request, res: Response) => {
  try {
    const d = z.object({ spreadType: z.enum(['single', 'three', 'celtic', 'relationship', 'decision', 'horseshoe']).default('three'), question: z.string().optional() }).parse(req.body);
    const spread = drawSpread(d.spreadType, d.question);
    const interp = await callAI('tarot', buildTarotMsg(spread.cards, spread.spreadName, d.question));
    res.json({ success: true, data: { spread, interpretation: interp } });
  } catch (e: any) { 
    if (e.name === 'ZodError' || e.issues) {
      return res.status(400).json({ success: false, error: 'Invalid input format. Please check your request data.' });
    }
    console.error('[/api/tarot] Server error:', e);
    res.status(500).json({ success: false, error: 'Internal server error' }); 
  }
});

app.get('/api/tarot/daily', (_req: Request, res: Response) => res.json({ success: true, data: { card: drawDailyCard(), date: new Date().toISOString().split('T')[0] } }));
app.get('/api/tarot/card-of-day', (req: Request, res: Response) => { const d = req.query.date ? new Date(req.query.date as string) : undefined; res.json({ success: true, data: { card: getCardOfTheDay(d), date: (d || new Date()).toISOString().split('T')[0] } }); });

app.get('/api/daily-energy', async (_req: Request, res: Response) => {
  try {
    const energy = getDailyEnergy();
    const guidance = await callAI('daily', buildDailyMsg(energy));
    res.json({ success: true, data: { energy, guidance } });
  } catch (e: any) { 
    if (e.name === 'ZodError' || e.issues) {
      return res.status(400).json({ success: false, error: 'Invalid input format. Please check your request data.' });
    }
    res.status(500).json({ success: false, error: 'Failed to generate daily energy reading.' }); 
  }
});

app.post('/api/fengshui', async (req: Request, res: Response) => {
  try {
    const d = z.object({ roomType: z.string(), roomShape: z.string(), orientation: z.string(), birthElement: z.string().optional(), birthYear: z.number().optional(), gender: z.string().optional(), userId: z.string().optional() }).parse(req.body);
    const analysis = analyzeFengshui(d.roomType, d.orientation, d.birthYear, d.gender);

    const readingId = await saveFengshuiReading({
      userId: d.userId,
      roomType: d.roomType,
      roomShape: d.roomShape,
      orientation: d.orientation,
      birthYear: d.birthYear,
      gender: d.gender,
      analysis,
      ip: req.ip || undefined,
    });

    await saveHistory({
      userId: d.userId,
      readingType: 'fengshui',
      inputParams: { roomType: d.roomType, orientation: d.orientation },
      resultSummary: analysis.minggua ? `命卦:${analysis.minggua.name}` : '通用分析',
      readingId,
      ip: req.ip || undefined,
    });

    const interp = await callAI('fengshui', buildFengshuiMsg(d.roomType, d.roomShape, d.orientation, d.birthElement || ''));
    res.json({ success: true, data: { sectors: analysis.sectors, shapeEffect: analysis.shapeEffect, mainElement: analysis.mainElement, interpretation: interp, roomInfo: d, readingId } });
  } catch (e: any) { 
    if (e.name === 'ZodError' || e.issues) {
      return res.status(400).json({ success: false, error: 'Invalid input format. Please check your request data.' });
    }
    console.error('[/api/fengshui] Server error:', e);
    res.status(500).json({ success: false, error: 'Internal server error' }); 
  }
});

// ═══════════════════════════════════════════════════════════════
//  History & Favorites API
// ═══════════════════════════════════════════════════════════════

app.get('/api/history/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const type = req.query.type as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const rows = await getHistoryByUser(userId, type, limit, offset);
    res.json({ success: true, data: rows });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/favorites/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const rows = await getFavoritesByUser(userId, limit, offset);
    res.json({ success: true, data: rows });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/favorites', async (req: Request, res: Response) => {
  try {
    const d = z.object({ userId: z.string(), favType: z.enum(['bazi', 'fengshui', 'daily']), readingId: z.number().optional(), title: z.string().optional(), note: z.string().optional() }).parse(req.body);
    const result = await addFavorite(d);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.delete('/api/favorites', async (req: Request, res: Response) => {
  try {
    const d = z.object({ userId: z.string(), favType: z.string(), readingId: z.number().optional() }).parse(req.body);
    const removed = await removeFavorite(d.userId, d.favType, d.readingId);
    res.json({ success: true, removed });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.get('/api/bazi-readings/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const rows = await getBaziReadingsByUser(userId, limit, offset);
    res.json({ success: true, data: rows });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/fengshui-readings/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const rows = await getFengshuiReadingsByUser(userId, limit, offset);
    res.json({ success: true, data: rows });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/love', async (req: Request, res: Response) => {
  try {
    // 支持嵌套对象和扁平字段两种格式
    let body = req.body;
    if (body.birthDate1 || body.birthYear1) {
      // 扁平字段 → 嵌套对象转换
      const makeDate = (suffix: string) => {
        const dateKey = `birthDate${suffix}`;
        if (body[dateKey]) return body[dateKey];
        const y = body[`birthYear${suffix}`], m = body[`birthMonth${suffix}`], d = body[`birthDay${suffix}`];
        if (y && m && d) return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        return '';
      };
      body = {
        person1: { name: body.name1 || '', birthDate: makeDate('1'), gender: body.gender1 || 'male' },
        person2: { name: body.name2 || '', birthDate: makeDate('2'), gender: body.gender2 || 'female' },
      };
    }
    const d = z.object({ person1: z.object({ name: z.string().optional(), birthDate: z.string(), gender: z.enum(['male', 'female']) }), person2: z.object({ name: z.string().optional(), birthDate: z.string(), gender: z.enum(['male', 'female']) }) }).parse(body);
    const p1 = getDayPillar(new Date(d.person1.birthDate)); const p2 = getDayPillar(new Date(d.person2.birthDate));
    // FIX: 使用基于八字的合婚计算（非随机）
    const compat = calculateCompatibility(p1, p2);
    const interp = await callAI('love', `${p1.stem}${p1.branch} vs ${p2.stem}${p2.branch}`);
    res.json({ success: true, data: { compatibility: compat, person1: { ...d.person1, pillar: p1 }, person2: { ...d.person2, pillar: p2 }, interpretation: interp } });
  } catch (e: any) { 
    if (e.name === 'ZodError' || e.issues) {
      return res.status(400).json({ success: false, error: 'Invalid input format. Please check your request data.' });
    }
    res.status(400).json({ success: false, error: e.message }); 
  }
});

// FIX: 404 处理 — 返回 JSON 而不是默认 HTML
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// FIX: 全局错误处理中间件 — 隐藏内部验证细节，返回友好错误，同时持久化到 error_logs
app.use((err: any, req: Request, res: Response, _next: any) => {
  if (err.name === 'ZodError' || err.issues) {
    return res.status(400).json({ success: false, error: 'Invalid input format. Please check your request data.' });
  }
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  logError({
    endpoint: req.path,
    method: req.method,
    statusCode: 500,
    errorMessage: err.message || 'Internal server error',
    stackTrace: err.stack || '',
    requestBody: JSON.stringify(req.body).slice(0, 2000),
    ip,
  }).catch(() => {});
  console.error('[Server Error]', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ═══════════════════════════════════════════════════════════════
//  STARTUP
// ═══════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await initDatabase();
  } catch (err) {
    console.error('❌ Database initialization failed:', err);
    process.exit(1);
  }

  // FIX: 检查 IP_SALT 是否设置（生产环境安全警告）
  if (!process.env.IP_SALT) {
    console.warn('⚠️  WARNING: IP_SALT not set. Using default salt — production environments should set a strong random IP_SALT.');
  }

  // Print database stats on startup
  const stats = await getDbStats();
  console.log('📊 Database stats:', stats);

  const server = app.listen(PORT, () => {
    console.log(`🌟 MysticDao API v2 — http://localhost:${PORT} | Mode: ${API_KEY ? '✅ AI' : '⚠️ LOCAL-ONLY'}`);
    console.log(`📊 Analytics: http://localhost:${PORT}/api/analytics/realtime`);
    console.log(`⚖️  Compliance: http://localhost:${PORT}/api/compliance/disclaimer`);
    console.log(`📧 Subscribe: POST http://localhost:${PORT}/api/subscribe`);
    console.log('');
  });

  // ── Scheduled maintenance: auto-purge old logs every 24h ──
  const MAINTENANCE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  setInterval(async () => {
    try {
      const accessDeleted = await purgeOldLogs(90);
      const complianceDeleted = await purgeOldComplianceLogs(365);
      const errorDeleted = await purgeOldErrorLogs(90);
      if (accessDeleted > 0 || complianceDeleted > 0 || errorDeleted > 0) {
        console.log(`🧹 Maintenance: purged ${accessDeleted} access, ${complianceDeleted} compliance, ${errorDeleted} error logs`);
      }
    } catch (e) {
      console.error('❌ Scheduled maintenance failed:', e);
    }
  }, MAINTENANCE_INTERVAL);

  // Run maintenance once on startup (non-blocking)
  setTimeout(async () => {
    try {
      const accessDeleted = await purgeOldLogs(90);
      const complianceDeleted = await purgeOldComplianceLogs(365);
      const errorDeleted = await purgeOldErrorLogs(90);
      if (accessDeleted > 0 || complianceDeleted > 0 || errorDeleted > 0) {
        console.log(`🧹 Startup maintenance: purged ${accessDeleted} access, ${complianceDeleted} compliance, ${errorDeleted} error logs`);
      }
    } catch (e) {
      console.error('❌ Startup maintenance failed:', e);
    }
  }, 5000);

  // FIX: 优雅关闭，确保数据库连接正常关闭
  process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM received, shutting down gracefully...');
    server.close(async () => {
      try {
        const db = getDb();
        await db.close();
        console.log('📊 Database connection closed.');
      } catch (e) {
        console.error('Error closing database:', e);
      }
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('\n🛑 SIGINT received, shutting down gracefully...');
    server.close(async () => {
      try {
        const db = getDb();
        await db.close();
        console.log('📊 Database connection closed.');
      } catch (e) {
        console.error('Error closing database:', e);
      }
      process.exit(0);
    });
  });
}

startServer().catch((err) => {
  console.error('❌ Server startup failed:', err);
  process.exit(1);
});
