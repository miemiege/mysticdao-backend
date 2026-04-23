/**
 * Bazi Readings DAO
 * 八字排盘记录的数据库操作
 */
import { getDb, hashIp } from './database.js';
import type { FourPillars, DayunInfo, XiyongShen, FiveElementsCount } from '../divination/bazi.js';

export interface BaziReadingInput {
  userId?: string;
  name?: string;
  gender?: string;
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  birthHour: number;
  birthMinute?: number;
  birthLongitude?: number;
  birthCity?: string;
  solarAdjusted?: boolean;
  pillars: FourPillars;
  dayun: DayunInfo[];
  xiyong?: XiyongShen;
  fiveElements?: FiveElementsCount;
  aiInterpretation?: string;
  ip?: string;
}

export async function saveBaziReading(input: BaziReadingInput): Promise<number> {
  const db = getDb();
  const result = await db.run(
    `INSERT INTO bazi_readings (
      user_id, name, gender,
      birth_year, birth_month, birth_day, birth_hour, birth_minute,
      birth_longitude, birth_city, solar_adjusted,
      year_pillar, month_pillar, day_pillar, hour_pillar,
      day_master, nayin, dayun_json, xiyong, jishen, yongshen,
      five_elements_json, ai_interpretation, source_ip_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.userId || null,
    input.name || null,
    input.gender || null,
    input.birthYear,
    input.birthMonth,
    input.birthDay,
    input.birthHour,
    input.birthMinute ?? 0,
    input.birthLongitude ?? null,
    input.birthCity || null,
    input.solarAdjusted ? 1 : 0,
    `${input.pillars.year.stem}${input.pillars.year.branch}`,
    `${input.pillars.month.stem}${input.pillars.month.branch}`,
    `${input.pillars.day.stem}${input.pillars.day.branch}`,
    `${input.pillars.hour.stem}${input.pillars.hour.branch}`,
    `${input.pillars.dayMaster.stem}(${input.pillars.dayMaster.element})`,
    input.pillars.nayin || null,
    JSON.stringify(input.dayun),
    input.xiyong?.xiyong || null,
    input.xiyong?.jishen || null,
    input.xiyong?.yongshen || null,
    input.fiveElements ? JSON.stringify(input.fiveElements) : null,
    input.aiInterpretation || null,
    input.ip ? hashIp(input.ip) : null
  );
  return result.lastID as number;
}

export async function getBaziReadingById(id: number) {
  const db = getDb();
  return db.get(`SELECT * FROM bazi_readings WHERE id = ?`, id);
}

export async function getBaziReadingsByUser(userId: string, limit: number = 20, offset: number = 0) {
  const db = getDb();
  return db.all(
    `SELECT * FROM bazi_readings WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    userId, limit, offset
  );
}

export async function deleteBaziReading(id: number, userId?: string): Promise<boolean> {
  const db = getDb();
  const sql = userId
    ? `DELETE FROM bazi_readings WHERE id = ? AND user_id = ?`
    : `DELETE FROM bazi_readings WHERE id = ?`;
  const params = userId ? [id, userId] : [id];
  const result = await db.run(sql, ...params);
  return (result.changes ?? 0) > 0;
}
