/**
 * Access Logger Middleware
 * GDPR-compliant: IP hashed, async non-blocking
 * 
 * FIX v2: Express 4.x does NOT catch async middleware errors automatically.
 * Changed from async middleware to sync middleware with self-executing async function.
 * Added sensitive query parameter filtering.
 */

import { Request, Response, NextFunction } from 'express';
import { getDb, hashIp } from '../../lib/db/database.js';

// Sensitive query parameters that should never be logged
const SENSITIVE_PARAMS = ['token', 'password', 'secret', 'api_key', 'auth', 'credential', 'key'];

function sanitizeQuery(query: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(query)) {
    if (SENSITIVE_PARAMS.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function accessLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() 
            || req.socket.remoteAddress 
            || 'unknown';
    const ipHash = hashIp(ip);
    const path = req.path;
    const method = req.method;
    const query = JSON.stringify(sanitizeQuery(req.query));
    const ua = req.headers['user-agent'] || '';
    const referer = req.headers['referer'] || '';

    res.on('finish', () => {
      const duration = Date.now() - start;
      const status = res.statusCode;

      // FIX: Use self-executing function instead of async callback
      // to avoid unhandled promise rejection in Express 4.x
      (async () => {
        try {
          const db = getDb();

          // 1. Log access
          await db.run(
            `INSERT INTO access_logs (ip_hash, method, path, query, user_agent, referer, status_code, response_time_ms)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            ipHash, method, path, query, ua, referer, status, duration
          );

          // 2. Update API usage stats
          await db.run(`
            INSERT INTO api_usage (endpoint, call_count, error_count, total_response_time_ms, last_called_at)
            VALUES (?, 1, ?, ?, datetime('now'))
            ON CONFLICT(endpoint) DO UPDATE SET
              call_count = call_count + 1,
              error_count = error_count + ?,
              total_response_time_ms = total_response_time_ms + ?,
              last_called_at = datetime('now'),
              updated_at = datetime('now')
          `, path, status >= 400 ? 1 : 0, duration, status >= 400 ? 1 : 0, duration);

        } catch (e) {
          // Fail silently — never block request due to logging failure
          console.error('[Logger] Error:', e);
        }
      })();
    });

    next();
  };
}
