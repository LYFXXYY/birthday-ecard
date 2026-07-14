# 外部监控守护进程（Watchdog）实现计划

## Context

当前系统监控是"自监控"——监控服务和业务服务跑在同一个 Node.js 进程中。如果进程崩溃，监控也一起挂掉，无法检测到故障。需要一个独立的外部监控进程，在主服务异常时仍能检测并记录告警。当前处于开发阶段，暂无外部推送目标（钉钉/邮件等），告警通过 log4js 日志文件 + SystemLog 数据库表输出。

## 架构

```
app.js (主进程 :3000)
  └─ fork() → watchdog.js (子进程)
                  ├─ 每30s执行3项健康检查（HTTP/心跳/数据库）
                  ├─ 状态转换时触发告警 → log4js + SystemLog
                  └─ 写入 watchdog.json 心跳
  ├─ 监听子进程 exit → 自动重启
  ├─ 周期性检查 watchdog.json → 假死时 kill + 重启
  └─ SIGTERM/SIGINT → 优雅关闭
```

## 实现步骤

### 1. 新建 `server/src/watchdog.js`

守护进程主文件，包含：

- **独立初始化**：自己加载 dotenv、配置 log4js（写入 `watchdog.log`）、建立 Sequelize 连接
- **三项健康检查**：
  - `checkHttpHealth()` — `GET /api/health`，用内置 `http` 模块，超时5s
  - `checkSenderHeartbeat()` — 读取 `heartbeats/sender.json`，超时25h
  - `checkDatabase()` — `sequelize.query('SELECT 1')`
- **状态去重**：每个检查项维护 `unknown/healthy/unhealthy` 状态机，仅状态转换时告警
- **告警输出**：Provider 模式，当前两个 provider：
  - `logFileProvider` — log4js 写入 `watchdog.log` + `error.log`
  - `dbLogProvider` — 写入 SystemLog 表（category='watchdog'）
  - 扩展点：未来在此数组追加 emailProvider/webhookProvider
- **自身心跳**：每轮检查后写入 `heartbeats/watchdog.json`
- **IPC 通信**：监听 `shutdown` 消息和 `disconnect` 事件优雅退出

### 2. 修改 `server/src/app.js`

- 新增 `import { fork } from 'child_process'`
- 实现 `startWatchdog()`：fork 守护进程，监听 exit 自动重启
- 实现 `startWatchdogMonitor()`：周期性检查 watchdog.json 心跳，假死时 kill 重启
- 实现 `gracefulShutdown()`：SIGTERM/SIGINT 处理，通知守护进程退出
- 在 `app.listen()` 回调中调用启动逻辑

### 3. 修改 `server/src/config/index.js`

在 config 对象中新增：

```javascript
watchdog: {
  enabled: process.env.WATCHDOG_ENABLED !== 'false',
  intervalSeconds: parseInt(process.env.WATCHDOG_INTERVAL) || 30,
  httpTimeoutMs: parseInt(process.env.WATCHDOG_HTTP_TIMEOUT) || 5000,
  restartDelayMs: parseInt(process.env.WATCHDOG_RESTART_DELAY) || 5000
}
```

### 4. 修改 `server/.env`

追加：
```
WATCHDOG_ENABLED=true
WATCHDOG_INTERVAL=30
WATCHDOG_HTTP_TIMEOUT=5000
WATCHDOG_RESTART_DELAY=5000
```

## 关键设计决策

- **不 import `heartbeatService.js` / `systemLogWriter.js`**：避免引入对主服务模块的依赖链，直接用 `fs` 读心跳文件、`SystemLog.create` 写日志
- **用内置 `http` 模块做健康检查**：守护进程尽量轻量，不依赖 axios
- **守护进程自己配置 log4js**：不复用 `logger.js`（它写入 `app.log`），守护进程写入独立的 `watchdog.log`
- **状态机去重**：只在状态转换时告警，不重复告警

## 验证方法

1. `npm run dev` 启动，观察日志确认 `[守护进程] 已启动`
2. Ctrl+C 停止主服务 → 确认守护进程检测到 HTTP 失败并记录告警
3. 重启主服务 → 确认守护进程检测到恢复并记录恢复通知
4. 检查 `server/heartbeats/watchdog.json` 正确更新
5. 检查 `server/logs/watchdog.log` 有告警日志
6. 查询 system_logs 表有 category='watchdog' 的记录
