# 邮件接收与入库系统设计

## 目标

为 `email-server` 项目增加邮件接收与入库能力。Postfix 以 catch-all 方式将邮件统一投递到 `/var/mail/Maildir/new/`，后端通过 Linux `inotify`（JDK `WatchService`）实时监听该目录，解析 MIME 后将邮件存入对应用户的 INBOX，并按 Maildir 标准将原文件移入 `cur/`。

## 上下文

- 后端：Spring Boot 4.0.6 / Java 21 / Maven 多模块。
- 数据库：PostgreSQL + Spring Data JPA。
- 认证：Spring Security OAuth2 Resource Server + Keycloak。本地不保存用户表，用户身份以 Keycloak 为唯一来源。
- 当前已实现：仅 outbound 发件功能，发送时把记录写入 `MailboxType.SENT`。
- Postfix 已配置 catch-all，所有本域邮件落入 `/var/mail/Maildir/new/`。
- 项目已有 `Mail`、`Mailbox`、`MailRecipient` 实体；`MailboxType` 已预留 `INBOX` 但未使用。

## 架构

```
Postfix (catch-all)
    │
    ▼
/var/mail/Maildir/new/<unique>
    │
    ▼
MaildirWatcher (java.nio.file.WatchService → Linux inotify)
    │
    ▼
MaildirProcessor
    │
    ├── 等待/确认文件完整（Maildir 语义：Postfix 原子 mv 自 tmp/）
    ├── 用 Jakarta Mail 解析 MimeMessage
    ├── 提取 To / Cc / Bcc 中属于本域的地址
    ├── 对每个本域收件人解析目标 mailbox
    │      ├─ user@arorms.cn        → INBOX
    │      ├─ user+label@arorms.cn  → 同名 CUSTOM mailbox 或 fallback INBOX
    │      └─ 无本地 mailbox        → 丢弃
    ├── 普通邮件：创建 Mail + Attachment 元数据，移入 cur/
    │
    └── 退信：匹配原邮件 Message-ID，更新 MailRecipient.status = FAILED，
              并将退信本身投递到原发送人 INBOX
```

## 数据模型变更

### `Mailbox` 表

- 已有字段：`id`, `user_id`, `name`, `type`, `created_at`。
- 新增唯一索引：`(user_id, type)`，防止默认信箱重复创建。
- 默认信箱名称统一：
  - `INBOX` → name `"INBOX"`
  - `SENT`  → name `"Sent"`
  - `TRASH` → name `"Trash"`

### `Mail` 表

新增字段：

```java
@Column(name = "received_at")
private Instant receivedAt;          // server receive time

@Column(name = "delivered_to", length = 255)
private String deliveredTo;          // matched local recipient address

@Column(name = "reply_to", length = 255)
private String replyTo;              // Reply-To header

@Column(name = "text_content", columnDefinition = "TEXT")
private String textContent;          // text/plain body

@Column(name = "html_content", columnDefinition = "TEXT")
private String htmlContent;          // text/html body

@Column(name = "is_bounce")
private boolean bounce = false;      // whether this mail is a DSN/bounce
```

`rawPath` 继续保存原文件路径，处理后指向 `cur/` 下文件。

### `Attachment` 新表

```java
@Entity @Table(name = "attachments")
public class Attachment {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "mail_id", nullable = false)
    private Mail mail;

    @Column(length = 255)
    private String filename;

    @Column(length = 128)
    private String contentType;

    private Long size;

    @Column(length = 64)
    private String checksum;          // SHA-256 for future MINIO verification

    @Column(name = "storage_key", length = 512)
    private String storageKey;        // null until MINIO integration
}
```

当前阶段不上传真实文件，仅记录元数据。

### `MailRecipient` 复用

发送时记录每个收件人及其投递状态。收到退信时：

1. 解析出原邮件 `Message-ID`。
2. 定位原发送 `Mail` 及其 `MailRecipient`。
3. 设置 `status = FAILED`，`errorMessage = bounce reason`。

## 组件设计

### `MaildirWatcher`

- 实现 `SmartLifecycle`，在 Spring 上下文就绪后启动，关闭时取消监听。
- 使用 `WatchService` 注册 `/var/mail/Maildir/new/` 的 `ENTRY_CREATE` 事件。
- 事件触发后将文件路径提交给 `MaildirProcessor` 异步/同步处理。
- 因 Maildir 的 `tmp → new` 是原子 `mv`，`new/` 中文件出现即完整，无需长时间等待文件稳定。

### `MaildirProcessor`

职责：

1. 读取 `MimeMessage`。
2. 解析 `To`、`Cc`、`Bcc` 中本域地址。
3. 对每个地址调用 `MailboxResolver` 确定目标 mailbox。
4. 移动文件到 `cur/`（Maildir 标准：`new/<name>` → `cur/<name>:2,`）。
5. 持久化 `Mail` 与 `Attachment`。
6. 检测退信并调用 `BounceHandler`。

### `MailboxResolver`

输入：收件人地址（如 `alice+work@arorms.cn`）

逻辑：

1. 校验域名是否为本域。
2. 提取 local-part（`alice+work`）。
3. 按 `+` 拆分为 `username` 与 `label`。
4. 用 `username` 查找该用户的默认 `INBOX`（以此判断用户是否“注册”过邮箱服务）。
5. 若用户无 mailbox，返回 null（邮件丢弃）。
6. 若 `label` 存在，查找该用户同名的 `CUSTOM` mailbox；命中则返回，否则 fallback 到 `INBOX`。

### `MailboxService`

新增方法：

```java
@Transactional
public void ensureDefaultMailboxes(String userId) {
    // create INBOX, SENT, TRASH if absent
}
```

调用点：用户通过 Keycloak 登录后，后端 `AuthController.me()` 返回 Principal 前调用。若该 userId 已存在 mailbox 则跳过。

同时**移除** `MailService.send()` 中对 `SENT` 信箱的懒创建逻辑。

### `BounceHandler`

退信识别：

- `From: Mail Delivery System <MAILER-DAEMON@...>`
- `Auto-Submitted: auto-replied`
- `Content-Type: multipart/report; report-type=delivery-status`

匹配原邮件：

1. 优先读取 `In-Reply-To` / `References`。
2. 若缺失，解析内嵌的 `message/rfc822` 附件，读取其 `Message-ID`。
3. 根据 `Message-ID` 找到原 `Mail`，更新对应 `MailRecipient` 为 `FAILED`。
4. 将退信本身作为普通接收邮件存入原发送人的 INBOX，并设置 `bounce = true`。

## 文件生命周期

```text
/var/mail/Maildir/
├── tmp/          # Postfix 写入中（应用不直接操作）
├── new/          # 投递完成，等待 Watcher 处理
├── cur/          # 已解析并入库的邮件
└── dead-letter/  # 处理失败的邮件
```

- 成功：文件从 `new/` 移动到 `cur/<filename>:2,`。
- 失败（解析异常、DB 写入失败、文件系统错误）：文件移入 `dead-letter/`，记录错误日志。
- 幂等：以 Maildir 文件名为 key，处理前检查 `Mail.rawPath` 是否已存在，存在则跳过并清理重复文件。

## 用户解析策略

- 不实时查询 Keycloak Admin API。
- 以本地是否存在该 userId 的 mailbox 作为“是否已注册邮箱服务”的唯一判据。
- 首次 Keycloak 登录时懒创建默认 mailbox。
- 若邮件收件人无任何本地 mailbox，直接丢弃并记录 warn 日志。

## API 端点

仅暴露基础查询接口：

| 方法 | 端点 | 说明 |
|---|---|---|
| `GET` | `/api/mail/mailboxes` | 当前用户的所有信箱 |
| `GET` | `/api/mail/mailboxes/{id}/mails` | 某信箱邮件列表（支持分页） |
| `GET` | `/api/mail/mails/{id}` | 邮件详情，含附件元数据 |
| `PATCH` | `/api/mail/mails/{id}/read` | 标记为已读 |

权限：基于 Keycloak token 中的 `userId` 过滤，只能访问自己的 mailbox。

## 错误处理

| 场景 | 处理 |
|---|---|
| 收件人本地无 mailbox | 丢弃，记录 warn |
| MIME 解析失败 | 移入 `dead-letter/`，记录 error |
| DB 写入失败 | 移入 `dead-letter/`，记录 error |
| 文件移动失败 | 重试一次，仍失败则移入 `dead-letter/` |
| 退信无法匹配原邮件 | 作为普通邮件入发送人 INBOX，仅不更新原状态 |

## 运维注意事项

1. **权限**：Spring Boot 进程必须对 `/var/mail/Maildir/` 有读写权限。推荐以 `mail` 用户运行，或把运行用户加入 `mail` 组。
2. **单实例**：`WatchService` 适用于单实例。若后续多实例部署，需要引入分布式锁或消费队列避免重复处理。
3. **存储增长**：`cur/` 随时间增长，需制定归档/清理策略（超出当前范围）。
4. **数据库编码**：`textContent` / `htmlContent` 使用 `TEXT` 类型，确保 UTF-8。

## 未来扩展

- **MINIO 附件存储**：实现 `AttachmentService.upload()`，将附件上传后回填 `storageKey`。
- **邮件删除/移动**：增加 `DELETE /api/mail/mails/{id}`、`POST /api/mail/mails/{id}/move`。
- **全文搜索**：接入 Elasticsearch 或 PostgreSQL `tsvector`。
- **垃圾邮件过滤**：在 `MaildirProcessor` 中增加 SpamAssassin/Rspamd 集成点。
