# MysticDAO AI Backend

AI-powered Traditional Chinese Divination API — 八字、风水、塔罗、易经。

## Tech Stack

- **Runtime**: Node.js 20+ / TypeScript (ESM)
- **Server**: Express 4 + CORS
- **Database**: SQLite3 + WAL mode
- **AI SDK**: OpenAI SDK v4 (兼容 Kimi / Moonshot / OpenAI)
- **Validation**: Zod

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and edit if needed
cp .env.example .env

# 3. Initialize database
npm run db:init

# 4. Start server (port 3001)
npm run dev
```

> No external API key required for local calculation mode. Uncomment keys in `.env` to enable AI interpretation.

## Database

- **Path**: `data/mysticdao.db` (auto-created)
- **Schema**: `scripts/schema.sql` — 11 tables for readings, history, favorites, feedback, analytics
- **WAL mode**: enabled for concurrent reads
- **GDPR**: IP addresses are SHA-256 hashed before storage; logs auto-purged after 90 days

```bash
# Rebuild database from schema
sqlite3 data/mysticdao.db < scripts/schema.sql

# Or use the init script (also enables WAL)
npm run db:init
```

## Project Structure

```
├── src/
│   ├── api/
│   │   ├── server.ts          # Express routes (bazi, fengshui, history, favorites, feedback)
│   │   └── middleware/        # rate-limit, auth
│   ├── lib/
│   │   ├── db/
│   │   │   ├── database.ts    # Schema + init + utilities
│   │   │   ├── bazi-dao.ts    # 八字 CRUD
│   │   │   ├── fengshui-dao.ts
│   │   │   └── history-dao.ts # history + favorites + feedback
│   │   └── divination/
│   │       ├── bazi.ts        # 八字排盘核心（精确节气 + 真太阳时）
│   │       ├── jieqi-table.ts # 1900-2100 节气精确时刻表 (NASA JPL DE440s)
│   │       ├── solar-time.ts  # 真太阳时换算 (Meeus 均时差)
│   │       ├── fengshui.ts    # 风水 / 命卦
│   │       ├── iching.ts      # 易经六爻
│   │       └── tarot.ts       # 塔罗
│   └── data/
│       └── cities.ts          # 40+ 中国主要城市经度表
├── scripts/
│   ├── schema.sql             # 完整数据库 Schema
│   └── init-db.ts             # 一键初始化数据库
├── data/                      # SQLite DB (gitignored — see schema.sql to recreate)
├── docs/                      # Algorithm whitepapers (溯源 / 精度 / 验证)
└── .env.example               # 环境变量模板
```

## Algorithm Precision

| Feature | Precision |
|--------|-----------|
| 日柱 | 儒略日法，基准 2415011 |
| 年柱 / 命卦 | 精确到分钟的立春时刻分界 |
| 月柱 | 精确到分钟的节气时刻分界 |
| 真太阳时 | 经度校正 + Meeus 均时差公式 |
| 节气表 | NASA JPL DE440s 星历，1900-2100 年 |
| 大运起运 | 精确到小数位起运岁数 |

See `docs/` for detailed whitepapers.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/bazi` | 八字排盘 + 自动保存 |
| POST | `/api/fengshui` | 风水分析 + 自动保存 |
| GET | `/api/history/:userId` | 查询历史记录 |
| GET | `/api/bazi-readings/:userId` | 查询八字记录 |
| GET | `/api/favorites/:userId` | 查询收藏 |
| POST | `/api/favorites` | 添加收藏 |
| DELETE | `/api/favorites` | 删除收藏 |

## Environment Variables

Copy `.env.example` to `.env` and customize:

```env
PORT=3001
# IP_SALT=mysticdao-salt-change-me   # 生产环境必须自定义
# OPENAI_API_KEY=sk-your-key         # 可选 — 本地计算模式无需
# KIMI_API_KEY=sk-kimi-your-key
# MOONSHOT_API_KEY=sk-your-key
```

## License

MIT
