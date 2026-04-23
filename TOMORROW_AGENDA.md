# MysticDAO × Kimi CLI 集成开发任务

> 📅 定时任务：明天上午 10:00
> 🎯 目标：让 MysticDAO 后端能够调用 Kimi CLI 的 `kimi-for-coding`（Kimi-k2.6）模型
> 👥 执行：AGENT 集群

---

## 背景

- **当前状态**：MysticDAO 后端 AI 解读已禁用（LOCAL-ONLY 模式），所有端点 <25ms 响应，本地计算数据正常。
- **问题根因**：`kimi-for-coding` 模型仅限 Coding Agent 内部使用，外部 HTTP API 返回 403。
- **调查发现**：
  - Kimi CLI 使用 OAuth JWT 认证（非 API Key）
  - Kimi CLI 内部通过 **ACP (Agent Communication Protocol)** 与 Kimi 服务器通信
  - 伪造请求头（`X-Msh-Platform: kimi_cli`）仍无法绕过限制
  - ACP 是 Kimi 私有协议，但 `kimi acp` 命令可启动 ACP Server

---

## 方案对比

| 维度 | 方案 B：MysticDAO → Kimi CLI ACP | 方案 C：MysticDAO ← Kimi CLI MCP |
|------|-----------------------------------|-----------------------------------|
| **架构** | MysticDAO 作为 ACP Client，连接 `kimi acp` | MysticDAO 作为 MCP Server，被 Kimi CLI 调用 |
| **通信方向** | MysticDAO 主动调用 Kimi CLI 获取 AI 解读 | Kimi CLI 主动调用 MysticDAO API |
| **协议** | ACP (Kimi 私有协议) | MCP (Model Context Protocol，行业标准) |
| **复杂度** | ⭐⭐⭐ 高（需逆向 ACP 协议） | ⭐⭐ 中（MCP 有标准 SDK） |
| **通用性** | 低（仅 Kimi CLI 可用） | 高（任何 MCP Client 可用） |
| **用户体验** | 传统 API 模式，前端无感 | 角色反转，用户通过 Kimi CLI 与 MysticDAO 交互 |
| **推荐度** | ⚠️ 备选 | ✅ **推荐** |

---

## 方案 C 详细设计（推荐）

### 核心思路

将 MysticDAO 后端包装为一个 **MCP Server**，提供以下 Tool：

| Tool 名称 | 功能 | 输入 | 输出 |
|-----------|------|------|------|
| `cast_iching` | 易经起卦 | method, question | 卦象数据 + AI 解读（由 Kimi CLI 生成） |
| `calculate_bazi` | 八字排盘 | 出生年月日时 | 四柱 + 五行 + AI 解读 |
| `draw_tarot` | 塔罗抽牌 | spreadType, question | 牌阵 + AI 解读 |
| `analyze_fengshui` | 风水分析 | roomType, orientation | 八卦分析 + AI 解读 |
| `calculate_love` | 八字合婚 | 两人出生信息 | 合婚分数 + AI 解读 |
| `get_daily_energy` | 每日运势 | date | 日柱能量 + AI 解读 |
| `get_compliance` | 合规内容 | type, lang | 免责声明/隐私政策/服务条款 |

**流程**：
1. 用户在前端提交请求 → MysticDAO 后端执行本地计算 → 返回结构化数据
2. Kimi CLI 通过 MCP 调用 MysticDAO 的 Tool → 获取结构化数据
3. Kimi CLI 使用 `kimi-for-coding` 模型生成 AI 解读 → 返回给用户

### 技术栈

- **MCP SDK**: `@modelcontextprotocol/sdk` (TypeScript)
- **传输层**: stdio（Kimi CLI 与 MCP Server 通过标准输入输出通信）
- **MysticDAO 暴露方式**: 两种方式可选
  1. **方式 C1**：MysticDAO 后端直接实现 MCP Server（stdio 模式）
  2. **方式 C2**：单独启动一个 MCP Bridge 进程，通过 HTTP 调用 MysticDAO 后端

### 文件变更计划

```
mysticdao/
├── src/
│   └── mcp/
│       ├── server.ts          # MCP Server 主入口
│       ├── tools/
│       │   ├── iching.ts      # 易经 Tool
│       │   ├── bazi.ts        # 八字 Tool
│       │   ├── tarot.ts       # 塔罗 Tool
│       │   ├── fengshui.ts    # 风水 Tool
│       │   ├── love.ts        # 合婚 Tool
│       │   └── daily.ts       # 每日运势 Tool
│       └── utils.ts           # MCP 工具封装
├── mcp-config.json            # Kimi CLI MCP 配置文件
└── package.json               # 添加 @modelcontextprotocol/sdk 依赖
```

### Kimi CLI 配置

用户需在 `~/.kimi/mcp.json` 中添加：

```json
{
  "mcpServers": {
    "mysticdao": {
      "command": "npx",
      "args": ["tsx", "/path/to/mysticdao/src/mcp/server.ts"],
      "env": {
        "MYSTICDAO_API_URL": "http://localhost:3001"
      }
    }
  }
}
```

### 开发任务分解

#### 任务 1：MCP Server 骨架（1-2h）
- [ ] 安装 `@modelcontextprotocol/sdk`
- [ ] 创建 `src/mcp/server.ts`，初始化 StdioServerTransport
- [ ] 定义所有 Tool 的 schema（name, description, inputSchema）
- [ ] 测试：手动运行 `kimi mcp test mysticdao`

#### 任务 2：本地计算 Tool 封装（2-3h）
- [ ] 每个 Tool 调用 MysticDAO 内部函数（不经过 HTTP，直接 import）
- [ ] 或：Tool 内部通过 `fetch` 调用 `localhost:3001/api/*`
- [ ] 统一错误处理格式

#### 任务 3：Kimi CLI 集成测试（1-2h）
- [ ] 编写 `mcp-config.json`
- [ ] 测试 Kimi CLI 调用各 Tool：`kimi mcp test mysticdao`
- [ ] 验证 Kimi CLI 能正确使用 `kimi-for-coding` 模型生成解读

#### 任务 4：前端适配（可选，1h）
- [ ] 前端显示 "AI 解读由 Kimi CLI 提供"
- [ ] 或：前端直接调用 MysticDAO API（本地计算），AI 解读由 Kimi CLI 独立提供

---

## 方案 B 详细设计（备选）

### 核心思路

逆向 Kimi CLI 的 ACP 协议，让 MysticDAO 作为 ACP Client 连接 `kimi acp`。

### 技术难点

1. ACP 是 Kimi 私有协议，无公开文档
2. 协议基于 `acp` Python 库，需要实现对应的 TypeScript 客户端
3. 认证机制复杂（OAuth + Device ID + 特殊请求头）
4. 协议可能随时变更

### 调查线索

- ACP Server 源码：`~/.local/share/uv/tools/kimi-cli/lib/python3.13/site-packages/kimi_cli/acp/server.py`
- ACP 使用 `acp` Python 库（可能基于 JSON-RPC 或类似协议）
- `kimi acp` 启动后监听 stdio 或 WebSocket

### 开发任务（高风险，不推荐优先执行）

#### 任务 B1：ACP 协议逆向（4-6h，可能失败）
- [ ] 分析 `kimi_cli/acp/server.py` 和 `kimi_cli/acp/session.py`
- [ ] 抓包分析 `kimi acp` 启动后的通信内容
- [ ] 尝试用 Python `acp` 库连接并记录消息格式

#### 任务 B2：TypeScript ACP Client（4-6h）
- [ ] 根据逆向结果实现 ACP Client
- [ ] 处理 OAuth Token 刷新（15 分钟过期）
- [ ] 处理 Device ID 生成和特殊请求头

---

## 推荐执行顺序

```
明天上午 10:00 开始
├── 10:00-12:00  方案 C 任务 1：MCP Server 骨架
├── 14:00-17:00  方案 C 任务 2：本地计算 Tool 封装
└── 17:00-18:00  方案 C 任务 3：Kimi CLI 集成测试
```

如果方案 C 在任务 3 验证失败（如 Kimi CLI 不支持自定义 MCP Server 调用本地模型），则下午切换到方案 B 的调查。

---

## 前置准备（今晚完成）

- [x] 方案 A 已部署（LOCAL-ONLY 模式）
- [ ] AGENT 集群需确认 Node.js 22 + tsx 环境可用
- [ ] AGENT 集群需安装 `@modelcontextprotocol/sdk`
- [ ] 准备测试命令：`kimi mcp add mysticdao ...`

---

## 验收标准

1. `kimi mcp test mysticdao` 返回所有 Tool 列表且连接成功
2. 在 Kimi CLI 中输入 "帮我算一卦"，Kimi CLI 调用 `cast_iching` Tool
3. Kimi CLI 使用 `kimi-for-coding` 模型生成易经解读
4. MysticDAO 本地计算数据 + Kimi AI 解读完整呈现给用户

---

*文档生成时间：2026-04-21*
*对应 BUGFIX_LOG.md #15-18*
