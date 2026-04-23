-- MysticDAO Database Schema
-- SQLite3 — generated from mysticdao.db
-- Run: sqlite3 data/mysticdao.db < scripts/schema.sql

-- Access logs (GDPR compliant — IP hashed)
CREATE TABLE IF NOT EXISTS access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  query TEXT,
  user_agent TEXT,
  referer TEXT,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER NOT NULL,
  country_code TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON access_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_access_logs_path ON access_logs(path);

-- API usage counters per endpoint
CREATE TABLE IF NOT EXISTS api_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL UNIQUE,
  call_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  total_response_time_ms INTEGER DEFAULT 0,
  last_called_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Subscribers (legacy, extended with birth info)
CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT,
  phone TEXT,
  telegram_id TEXT,
  discord_id TEXT,
  channel TEXT NOT NULL DEFAULT 'email',
  language TEXT DEFAULT 'zh',
  timezone TEXT DEFAULT 'Asia/Shanghai',
  birth_date TEXT,
  birth_time TEXT,
  gender TEXT,
  interests TEXT,
  consent_given INTEGER DEFAULT 0,
  consent_at DATETIME,
  unsubscribed INTEGER DEFAULT 0,
  unsubscribed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  birth_longitude REAL,
  birth_city TEXT,
  birth_minute INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_subscribers_channel ON subscribers(channel);
CREATE INDEX IF NOT EXISTS idx_subscribers_unsubscribed ON subscribers(unsubscribed);

-- Daily aggregated stats
CREATE TABLE IF NOT EXISTS daily_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  total_requests INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  api_calls INTEGER DEFAULT 0,
  avg_response_time_ms INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  premium_views INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Compliance / audit log
CREATE TABLE IF NOT EXISTS compliance_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  user_id TEXT,
  ip_hash TEXT,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Content cache
CREATE TABLE IF NOT EXISTS content_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_type TEXT NOT NULL,
  language TEXT DEFAULT 'zh',
  date TEXT NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  tags TEXT,
  published INTEGER DEFAULT 0,
  published_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(content_type, language, date)
);

-- Bazi (八字) readings
CREATE TABLE IF NOT EXISTS bazi_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  name TEXT,
  gender TEXT,
  birth_year INTEGER NOT NULL,
  birth_month INTEGER NOT NULL,
  birth_day INTEGER NOT NULL,
  birth_hour INTEGER NOT NULL,
  birth_minute INTEGER DEFAULT 0,
  birth_longitude REAL,
  birth_city TEXT,
  solar_adjusted INTEGER DEFAULT 0,
  year_pillar TEXT,
  month_pillar TEXT,
  day_pillar TEXT,
  hour_pillar TEXT,
  day_master TEXT,
  nayin TEXT,
  dayun_json TEXT,
  xiyong TEXT,
  jishen TEXT,
  yongshen TEXT,
  five_elements_json TEXT,
  ai_interpretation TEXT,
  source_ip_hash TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_bazi_user_created ON bazi_readings(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_bazi_birth ON bazi_readings(birth_year, birth_month, birth_day);

-- Feng Shui readings
CREATE TABLE IF NOT EXISTS fengshui_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  room_type TEXT NOT NULL,
  room_shape TEXT,
  orientation TEXT NOT NULL,
  birth_year INTEGER,
  gender TEXT,
  minggua_name TEXT,
  minggua_number INTEGER,
  direction_luck_json TEXT,
  color_scheme_json TEXT,
  layout_advice_json TEXT,
  ai_interpretation TEXT,
  source_ip_hash TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fengshui_user_created ON fengshui_readings(user_id, created_at);

-- General reading history
CREATE TABLE IF NOT EXISTS reading_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  session_id TEXT,
  reading_type TEXT NOT NULL,
  input_params_json TEXT,
  result_summary TEXT,
  reading_id INTEGER,
  source_ip_hash TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_history_user_type ON reading_history(user_id, reading_type, created_at);
CREATE INDEX IF NOT EXISTS idx_history_session ON reading_history(session_id);

-- User favorites
CREATE TABLE IF NOT EXISTS user_favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  fav_type TEXT NOT NULL,
  reading_id INTEGER,
  title TEXT,
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, fav_type, reading_id)
);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON user_favorites(user_id, created_at);

-- Feedback / ratings
CREATE TABLE IF NOT EXISTS feedback_ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  reading_type TEXT NOT NULL,
  reading_id INTEGER,
  rating INTEGER CHECK(rating >= 1 AND rating <= 5),
  comment TEXT,
  tags TEXT,
  source_ip_hash TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
