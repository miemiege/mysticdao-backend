# MysticDAO 后端 Bugfix 日志

## 测试轮次概览

| 轮次 | 日期 | 发现问题 | 已修复 | 状态 |
|------|------|----------|--------|------|
| 第一轮 | 2026-04-20 | 6+ | 6+ | ✅ 完成 |
| 第二轮 | 2026-04-21 | 5+ | 5+ | ✅ 完成 |
| 第三轮（发散思维） | 2026-04-21 | 4 | 3 | ⚠️ 1项待处理 |

---

## 第一轮：基础功能测试

### 1. Express 4.x async middleware 安全漏洞
**问题**：`async (req, res) => { ... }` 直接作为路由处理函数，未捕获的 Promise 错误会导致进程崩溃。
**修复**：添加 `asyncHandler` 包装函数，使用 `Promise.resolve(fn(...)).catch(next)` 模式。
**文件**：`src/api/server.ts`

### 2. `res.on('finish', async)` 无错误处理
**问题**：访问日志中间件在 `res.on('finish')` 中执行 async 数据库操作，无 try/catch，失败时崩溃。
**修复**：改为 sync 回调 + 自执行 async IIFE + try/catch。
**文件**：`src/api/middleware/logger.ts`

### 3. `analyzeFengShui` vs `analyzeFengshui` 拼写错误
**问题**：函数定义和调用处大小写不一致，导致 `undefined` 错误。
**修复**：统一为 `analyzeFengShui`。
**文件**：`src/api/server.ts`

### 4. AI 调用无超时
**问题**：`callAI` 无超时机制，AI 服务无响应时请求永久挂起。
**修复**：添加 `Promise.race` + 30 秒超时，超时返回友好消息。
**文件**：`src/api/server.ts`

### 5. 访问日志记录敏感参数
**问题**：`req.query` 可能包含 token、password 等敏感信息。
**修复**：添加 `filterSensitiveParams` 函数，自动删除敏感字段。
**文件**：`src/api/middleware/logger.ts`

### 6. 数据库初始化失败不退出
**问题**：`initDatabase()` 失败时服务继续运行，后续所有 DB 操作报错。
**修复**：添加 `process.exit(1)`。
**文件**：`src/api/server.ts`

---

## 第二轮：数据链路与合规测试

### 7. `daily_stats` 数据断链
**问题**：`daily_stats` 表数据不自动更新，与 `access_logs` 断链。
**修复**：每次请求后自动汇总更新 `daily_stats`。
**文件**：`src/lib/db/database.ts`

### 8. 服务优雅关闭缺失
**问题**：SIGINT/SIGTERM 时数据库连接未关闭，可能导致数据丢失。
**修复**：添加信号处理程序，关闭 DB 连接后退出。
**文件**：`src/api/server.ts`

### 9. zod 错误暴露（初次修复）
**问题**：zod 校验错误以完整 JSON 数组暴露内部字段名。
**修复**：添加全局错误处理中间件，隐藏 zod 内部细节。
**文件**：`src/api/server.ts`
**注**：初次修复未完全生效，因为各端点自己的 `try/catch` 先于全局中间件捕获了错误。

### 10. 虚假逻辑：姻缘
**问题**：`calculateCompatibility()` 使用 `Math.random()` 生成分数。
**修复**：改为基于天干五行 + 地支相合的真实计算。
**文件**：`src/api/server.ts`

### 11. 虚假逻辑：风水
**问题**：`analyzeFengShui()` 返回硬编码八卦，与输入无关。
**修复**：改为基于朝向/房间类型/个人五行的动态分析。
**文件**：`src/api/server.ts`

---

## 第三轮：发散思维全方位测试

### 12. HEXAGRAMS 数据致命错误（64卦 lines 重复/缺失）
**严重级别**：🔴 Critical
**问题**：`src/lib/data/hexagrams.ts` 中 64 卦的 `lines` 数组有 6 个组合缺失、6 个组合重复。`HEXAGRAMS.find()` 有约 9.4% 概率返回 `undefined`，导致 `Cannot read properties of undefined (reading 'number')`，IChing API 间歇性崩溃。
**根因**：原始数据文件中大量卦象的 `lines` 与 `trigramAbove/Below` 不匹配，且 #15 谦/#16 豫 的 trigram 被互换。
**修复**：
1. 根据标准八卦三爻定义重建所有 `lines`
2. 修正 #15 谦（下艮上坤）和 #16 豫（下坤上震）的 `trigramBelow/Above`
3. 修正对应的 `element` 字段
**验证**：Python 脚本验证 64 个 lines 组合唯一且完整（0 缺失，0 重复）。
**文件**：`src/lib/data/hexagrams.ts`

### 13. zod 错误暴露（彻底修复）
**严重级别**：🟡 Medium
**问题**：第一轮修复的全局错误处理中间件未生效，因为各端点自己的 `try/catch` 块直接返回 `e.message`，绕过了全局中间件。
**修复**：将 10 个端点的 `catch` 块统一修改为：先检查 `e.name === 'ZodError'`，如果是则返回友好消息；否则返回 `e.message`。
**验证**：所有无效输入（空 body、错误类型、无效枚举值）均返回 `"Invalid input format. Please check your request data."`。
**文件**：`src/api/server.ts`

### 14. 404 端点返回 HTML
**严重级别**：🟢 Low
**问题**：访问不存在的 API 端点时，Express 返回默认 HTML 错误页面，对 API 客户端不友好。
**修复**：在所有路由之后添加 catch-all 中间件，返回 JSON 404：`{ success: false, error: 'Endpoint not found' }`。
**文件**：`src/api/server.ts`

### 15. AI 调用 30 秒超时
**严重级别**：🟡 Medium
**问题**：`kimi-for-coding` 模型返回 403，但 `callAI` 耗时 30 秒才返回超时消息，严重影响用户体验。
**根因**：模块级 `client` 实例可能存在某种状态污染，导致 `client.chat.completions.create` 在 server.ts 环境下 30 秒内不 resolve（独立脚本 800ms 正常）。
**修复**：
1. `callAI` 每次调用创建新的 `OpenAI` 客户端（`freshClient`），避免模块级实例状态污染
2. `callAIStream` 同样改用每次创建新客户端
3. 超时时间从 120 秒缩短到 8 秒
**验证**：IChing/BaZi/FengShui 等 AI 端点均在 8 秒内返回（超时后返回友好降级消息）。

### 16. Love 端点仅支持嵌套对象格式
**严重级别**：🟢 Low
**问题**：`/api/love` 只接受 `{person1: {...}, person2: {...}}` 嵌套格式，前端可能发送扁平字段。
**修复**：自动检测扁平字段（`birthYear1/birthMonth1/...` 或 `birthDate1/...`）并转换为嵌套对象格式。
**验证**：扁平格式请求成功返回 compatibility score。

### 17. `/api/daily-energy` 缺少 try/catch
**严重级别**：🟡 Medium
**问题**：`daily-energy` 端点调用 `callAI` 但没有 try/catch，Express 4.x 无法捕获 async 错误，可能导致请求挂起。
**修复**：添加 try/catch，ZodError 返回友好消息，其他错误返回 500。

### 18. `/api/stream/:type` zod 错误暴露
**严重级别**：🟢 Low
**问题**：SSE 流式端点的 catch 块直接返回 `e.message`，zod 验证失败时暴露内部字段名。
**修复**：catch 块中检查 `e.name === 'ZodError'`，返回友好消息。

---

## 待处理问题

| 编号 | 问题 | 优先级 | 建议方案 |
|------|------|--------|----------|
| T1 | AI 模型 403 + 30秒延迟 | Medium | 更换可用模型，或改为异步任务 |
| T2 | `compliance_log` 表列名 `event_type` vs 代码中可能引用 `action_type` | Low | 检查所有引用该表的代码 |
| T3 | Love 端点请求体格式为嵌套对象，与前端可能不一致 | Low | 更新 API 文档，或添加扁平字段兼容 |
| T4 | `IP_SALT` 生产环境必须设置 | High | 部署时配置强随机盐值 |
| T5 | `ADMIN_SECRET` 未设置 | Medium | 部署时配置管理员密码 |

---

## 数据验证（第三轮测试后）

```
access_logs:    209 条
subscribers:    2 条
daily_stats:    1 条（2026-04-21）
api_usage:      10 端点统计
content_cache:  3 条（zh/en/ja）
compliance_log: 0 条（未触发年龄验证事件）
```

---

*最后更新：2026-04-21*
