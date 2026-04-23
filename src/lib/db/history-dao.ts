/**
 * Reading History & Favorites DAO
 * 全类型历史记录与收藏的数据库操作
 */
import { getDb, hashIp } from './database.js';

export interface HistoryInput {
  userId?: string;
  sessionId?: string;
  readingType: 'bazi' | 'fengshui' | 'daily' | 'love' | 'iching';
  inputParams?: Record<string, unknown>;
  resultSummary?: string;
  readingId?: number;
  ip?: string;
}

export async function saveHistory(input: HistoryInput): Promise<number> {
  const db = getDb();
  const result = await db.run(
    `INSERT INTO reading_history (
      user_id, session_id, reading_type, input_params_json,
      result_summary, reading_id, source_ip_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    input.userId || null,
    input.sessionId || null,
    input.readingType,
    input.inputParams ? JSON.stringify(input.inputParams) : null,
    input.resultSummary || null,
    input.readingId ?? null,
    input.ip ? hashIp(input.ip) : null
  );
  return result.lastID as number;
}

export async function getHistoryByUser(userId: string, type?: string, limit: number = 50, offset: number = 0) {
  const db = getDb();
  if (type) {
    return db.all(
      `SELECT * FROM reading_history WHERE user_id = ? AND reading_type = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      userId, type, limit, offset
    );
  }
  return db.all(
    `SELECT * FROM reading_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    userId, limit, offset
  );
}

export async function getHistoryBySession(sessionId: string) {
  const db = getDb();
  return db.all(
    `SELECT * FROM reading_history WHERE session_id = ? ORDER BY created_at DESC`,
    sessionId
  );
}

// ── Favorites ──

export interface FavoriteInput {
  userId: string;
  favType: 'bazi' | 'fengshui' | 'daily';
  readingId?: number;
  title?: string;
  note?: string;
}

export async function addFavorite(input: FavoriteInput): Promise<{ id: number; created: boolean }> {
  const db = getDb();
  try {
    const result = await db.run(
      `INSERT INTO user_favorites (user_id, fav_type, reading_id, title, note) VALUES (?, ?, ?, ?, ?)`,
      input.userId, input.favType, input.readingId ?? null, input.title || null, input.note || null
    );
    return { id: result.lastID as number, created: true };
  } catch (e: any) {
    // UNIQUE constraint violation → already favorited
    if (e.message?.includes('UNIQUE constraint failed')) {
      const existing = await db.get(
        `SELECT id FROM user_favorites WHERE user_id = ? AND fav_type = ? AND reading_id = ?`,
        input.userId, input.favType, input.readingId ?? null
      );
      return { id: existing?.id ?? 0, created: false };
    }
    throw e;
  }
}

export async function removeFavorite(userId: string, favType: string, readingId?: number): Promise<boolean> {
  const db = getDb();
  const result = await db.run(
    `DELETE FROM user_favorites WHERE user_id = ? AND fav_type = ? AND reading_id = ?`,
    userId, favType, readingId ?? null
  );
  return (result.changes ?? 0) > 0;
}

export async function getFavoritesByUser(userId: string, limit: number = 50, offset: number = 0) {
  const db = getDb();
  return db.all(
    `SELECT * FROM user_favorites WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    userId, limit, offset
  );
}

export async function isFavorited(userId: string, favType: string, readingId?: number): Promise<boolean> {
  const db = getDb();
  const row = await db.get(
    `SELECT 1 FROM user_favorites WHERE user_id = ? AND fav_type = ? AND reading_id = ?`,
    userId, favType, readingId ?? null
  );
  return !!row;
}
