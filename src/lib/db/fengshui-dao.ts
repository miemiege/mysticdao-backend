/**
 * Fengshui Readings DAO
 * 风水分析记录的数据库操作
 */
import { getDb, hashIp } from './database.js';
import type { FengshuiAnalysis } from '../divination/fengshui.js';

export interface FengshuiReadingInput {
  userId?: string;
  roomType: string;
  roomShape?: string;
  orientation: string;
  birthYear?: number;
  gender?: string;
  analysis: FengshuiAnalysis;
  aiInterpretation?: string;
  ip?: string;
}

export async function saveFengshuiReading(input: FengshuiReadingInput): Promise<number> {
  const db = getDb();
  const mg = input.analysis.minggua;
  const result = await db.run(
    `INSERT INTO fengshui_readings (
      user_id, room_type, room_shape, orientation,
      birth_year, gender, minggua_name, minggua_number,
      direction_luck_json, color_scheme_json, layout_advice_json,
      ai_interpretation, source_ip_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.userId || null,
    input.roomType,
    input.roomShape || null,
    input.orientation,
    input.birthYear ?? null,
    input.gender || null,
    mg?.name || null,
    mg?.number || null,
    input.analysis.directionLuck ? JSON.stringify(input.analysis.directionLuck) : null,
    input.analysis.colorScheme ? JSON.stringify(input.analysis.colorScheme) : null,
    input.analysis.layoutAdvice ? JSON.stringify(input.analysis.layoutAdvice) : null,
    input.aiInterpretation || null,
    input.ip ? hashIp(input.ip) : null
  );
  return result.lastID as number;
}

export async function getFengshuiReadingById(id: number) {
  const db = getDb();
  return db.get(`SELECT * FROM fengshui_readings WHERE id = ?`, id);
}

export async function getFengshuiReadingsByUser(userId: string, limit: number = 20, offset: number = 0) {
  const db = getDb();
  return db.all(
    `SELECT * FROM fengshui_readings WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    userId, limit, offset
  );
}
