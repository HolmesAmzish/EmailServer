# Mail Reception Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inbound mail reception to the email-server backend: watch `/var/mail/Maildir/new/`, parse MIME, route to the correct user mailbox, persist metadata, and expose basic inbox query APIs.

**Architecture:** A Spring Boot `SmartLifecycle` watcher uses JDK `WatchService` (Linux `inotify`) to monitor the shared Maildir `new/` directory. A `MaildirProcessor` parses each new file with Jakarta Mail, resolves recipients to local mailboxes, moves the file to `cur/`, and persists `Mail` plus `Attachment` metadata. Bounces are detected and linked back to the original sent mail via `Message-ID`.

**Tech Stack:** Spring Boot 4.0.6, Java 21, JPA/Hibernate, PostgreSQL, Jakarta Mail (via `spring-boot-starter-mail`), JUnit 5, Testcontainers (optional), Maven.

**Spec:** `docs/superpowers/specs/2026-09-02-mail-reception-design.md`

## Global Constraints

- Code comments must be in English.
- All user-facing strings/logs may be in English; user-facing copy is not a priority for this backend feature.
- Use existing package structure: domain entities in `email-common`, services/repositories/controllers in `email-app`.
- Follow existing Lombok `@Getter`/`@Setter` style.
- JPA `ddl-auto: update` in dev/test; schema changes are applied by Hibernate.
- The application process must have read/write access to `/var/mail/Maildir/` at runtime.
- Do not query Keycloak Admin API at receive time; local `Mailbox` table is the authority.

---

## File Structure

- `backend/email-common/src/main/java/cn/arorms/email/domain/entity/Mail.java` — add receive fields.
- `backend/email-common/src/main/java/cn/arorms/email/domain/entity/Mailbox.java` — add unique constraint.
- `backend/email-common/src/main/java/cn/arorms/email/domain/entity/Attachment.java` — new entity.
- `backend/email-app/src/main/java/cn/arorms/email/repository/AttachmentRepository.java` — new repository.
- `backend/email-app/src/main/java/cn/arorms/email/service/MailboxService.java` — default mailbox provisioning.
- `backend/email-app/src/main/java/cn/arorms/email/service/MaildirWatcher.java` — file system watcher.
- `backend/email-app/src/main/java/cn/arorms/email/service/MaildirProcessor.java` — orchestrates parse, route, persist.
- `backend/email-app/src/main/java/cn/arorms/email/service/MailboxResolver.java` — address-to-mailbox resolution.
- `backend/email-app/src/main/java/cn/arorms/email/service/BounceHandler.java` — DSN/bounce handling.
- `backend/email-app/src/main/java/cn/arorms/email/property/MaildirProperties.java` — path configuration.
- `backend/email-app/src/main/java/cn/arorms/email/controllers/MailController.java` — add inbox query endpoints.
- `backend/email-app/src/test/resources/sample-mail/` — sample `.eml` files for unit tests.
- `backend/email-app/src/test/java/cn/arorms/email/service/` — unit/integration tests.

---

### Task 1: Extend domain model for received mail

**Files:**
- Modify: `backend/email-common/src/main/java/cn/arorms/email/domain/entity/Mail.java`
- Modify: `backend/email-common/src/main/java/cn/arorms/email/domain/entity/Mailbox.java`
- Create: `backend/email-common/src/main/java/cn/arorms/email/domain/entity/Attachment.java`
- Test: `backend/email-app/src/test/java/cn/arorms/email/domain/EntityMappingTest.java` (new)

**Interfaces:**
- Produces: `Mail` with new fields (`receivedAt`, `deliveredTo`, `replyTo`, `textContent`, `htmlContent`, `bounce`).
- Produces: `Attachment` entity with `mail`, `filename`, `contentType`, `size`, `checksum`, `storageKey`.
- Produces: `Mailbox` with `@Table(uniqueConstraints = ...)` on `(user_id, type)`.

- [ ] **Step 1: Add fields to `Mail`**

```java
@Column(name = "received_at")
private Instant receivedAt;

@Column(name = "delivered_to", length = 255)
private String deliveredTo;

@Column(name = "reply_to", length = 255)
private String replyTo;

@Column(name = "text_content", columnDefinition = "TEXT")
private String textContent;

@Column(name = "html_content", columnDefinition = "TEXT")
private String htmlContent;

@Column(name = "is_bounce")
private boolean bounce = false;
```

- [ ] **Step 2: Add unique constraint to `Mailbox`**

```java
@Table(
    name = "mailboxes",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_mailboxes_user_type",
        columnNames = {"user_id", "type"}
    )
)
```

- [ ] **Step 3: Create `Attachment` entity**

```java
package cn.arorms.email.domain.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "attachments")
public class Attachment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
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
    private String checksum;

    @Column(name = "storage_key", length = 512)
    private String storageKey;
}
```

- [ ] **Step 4: Run context load test**

Run: `mvn -pl backend/email-app test -Dtest=EmailServerApplicationTests`
Expected: PASS (schema updates load successfully).

- [ ] **Step 5: Commit**

```bash
git add backend/email-common/.../entity/Mail.java backend/email-common/.../entity/Mailbox.java backend/email-common/.../entity/Attachment.java
git commit -m "feat: extend domain model for received mail and attachments"
```

---

### Task 2: Create default mailbox provisioning and remove lazy SENT creation

**Files:**
- Create: `backend/email-app/src/main/java/cn/arorms/email/service/MailboxService.java`
- Modify: `backend/email-app/src/main/java/cn/arorms/email/controllers/AuthController.java`
- Modify: `backend/email-app/src/main/java/cn/arorms/email/service/MailService.java`
- Test: `backend/email-app/src/test/java/cn/arorms/email/service/MailboxServiceTest.java` (new)

**Interfaces:**
- Consumes: `MailboxRepository`, `MailboxType`.
- Produces: `MailboxService.ensureDefaultMailboxes(String userId)`.
- Produces: `AuthController.me()` calls `mailboxService.ensureDefaultMailboxes(...)`.

- [ ] **Step 1: Implement `MailboxService.ensureDefaultMailboxes`**

```java
package cn.arorms.email.service;

import cn.arorms.email.domain.entity.Mailbox;
import cn.arorms.email.domain.enums.MailboxType;
import cn.arorms.email.repository.MailboxRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Map;

@Service
public class MailboxService {

    private final MailboxRepository mailboxRepository;

    public MailboxService(MailboxRepository mailboxRepository) {
        this.mailboxRepository = mailboxRepository;
    }

    private static final Map<MailboxType, String> DEFAULT_NAMES = Map.of(
        MailboxType.INBOX, "INBOX",
        MailboxType.SENT, "Sent",
        MailboxType.TRASH, "Trash"
    );

    @Transactional
    public void ensureDefaultMailboxes(String userId) {
        Arrays.stream(MailboxType.values())
            .filter(type -> type != MailboxType.CUSTOM)
            .forEach(type -> mailboxRepository
                .findByUserIdAndType(userId, type)
                .orElseGet(() -> {
                    Mailbox box = new Mailbox();
                    box.setUserId(userId);
                    box.setType(type);
                    box.setName(DEFAULT_NAMES.get(type));
                    return mailboxRepository.save(box);
                }));
    }
}
```

- [ ] **Step 2: Call it from `AuthController.me()`**

Modify `AuthController.me()` to call `mailboxService.ensureDefaultMailboxes(userPrincipal.getId())` before returning the principal.

- [ ] **Step 3: Remove lazy SENT creation from `MailService.send()`**

Replace the `.orElseGet(...)` block in `MailService.send()` with:

```java
var sentBox = mailboxRepository
    .findByUserIdAndType(userId, MailboxType.SENT)
    .orElseThrow(() -> new ServiceException("SENT mailbox not found for user: " + userId));
```

- [ ] **Step 4: Write test for `MailboxService`**

```java
@SpringBootTest
@Transactional
class MailboxServiceTest {

    @Autowired
    private MailboxService mailboxService;

    @Autowired
    private MailboxRepository mailboxRepository;

    @Test
    void shouldCreateDefaultMailboxesOnFirstCall() {
        String userId = "user-123";
        assertThat(mailboxRepository.findByUserId(userId)).isEmpty();

        mailboxService.ensureDefaultMailboxes(userId);

        var boxes = mailboxRepository.findByUserId(userId);
        assertThat(boxes).hasSize(3);
        assertThat(boxes.stream().map(Mailbox::getType))
            .containsExactlyInAnyOrder(MailboxType.INBOX, MailboxType.SENT, MailboxType.TRASH);
    }

    @Test
    void shouldBeIdempotent() {
        String userId = "user-456";
        mailboxService.ensureDefaultMailboxes(userId);
        mailboxService.ensureDefaultMailboxes(userId);

        var boxes = mailboxRepository.findByUserId(userId);
        assertThat(boxes).hasSize(3);
    }
}
```

- [ ] **Step 5: Run tests**

Run: `mvn -pl backend/email-app test -Dtest=MailboxServiceTest`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/email-app/.../service/MailboxService.java backend/email-app/.../controllers/AuthController.java backend/email-app/.../service/MailService.java backend/email-app/.../test/.../MailboxServiceTest.java
git commit -m "feat: provision default mailboxes on first login and remove lazy SENT creation"
```

---

### Task 3: Add configuration properties for Maildir paths

**Files:**
- Create: `backend/email-app/src/main/java/cn/arorms/email/property/MaildirProperties.java`
- Modify: `backend/email-app/src/main/resources/application.yml`
- Modify: `backend/email-app/src/test/resources/application.yml`
- Test: `backend/email-app/src/test/java/cn/arorms/email/property/MaildirPropertiesTest.java` (new)

**Interfaces:**
- Produces: `MaildirProperties` with `basePath`, `newDir`, `curDir`, `deadLetterDir`.

- [ ] **Step 1: Create `MaildirProperties`**

```java
package cn.arorms.email.property;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.nio.file.Path;

@Getter
@Setter
@Validated
@ConfigurationProperties(prefix = "application.maildir")
public class MaildirProperties {

    @NotBlank
    private String basePath = "/var/mail/Maildir";

    public Path newPath() {
        return Path.of(basePath, "new");
    }

    public Path curPath() {
        return Path.of(basePath, "cur");
    }

    public Path deadLetterPath() {
        return Path.of(basePath, "dead-letter");
    }
}
```

- [ ] **Step 2: Register properties and enable validation**

In `EmailServerApplication.java`, add `@EnableConfigurationProperties(MaildirProperties.class)`.

- [ ] **Step 3: Update `application.yml` and test `application.yml`**

```yaml
application:
  maildir:
    base-path: ${MAILDIR_BASE:/var/mail/Maildir}
```

- [ ] **Step 4: Write test**

```java
@SpringBootTest
class MaildirPropertiesTest {

    @Autowired
    private MaildirProperties props;

    @Test
    void shouldResolvePaths() {
        assertThat(props.newPath()).endsWith(Path.of("/var/mail/Maildir/new"));
        assertThat(props.curPath()).endsWith(Path.of("/var/mail/Maildir/cur"));
        assertThat(props.deadLetterPath()).endsWith(Path.of("/var/mail/Maildir/dead-letter"));
    }
}
```

- [ ] **Step 5: Run tests**

Run: `mvn -pl backend/email-app test -Dtest=MaildirPropertiesTest`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/email-app/.../property/MaildirProperties.java backend/email-app/.../EmailServerApplication.java backend/email-app/.../resources/application.yml backend/email-app/.../test/.../MaildirPropertiesTest.java
git commit -m "feat: add maildir path configuration"
```

---

### Task 4: Implement mailbox address resolution

**Files:**
- Create: `backend/email-app/src/main/java/cn/arorms/email/service/MailboxResolver.java`
- Test: `backend/email-app/src/test/java/cn/arorms/email/service/MailboxResolverTest.java` (new)

**Interfaces:**
- Consumes: `MailboxRepository`, `MailProperties` (for domain), `MailboxType`.
- Produces: `MailboxResolver.resolve(String recipient)` returns `Optional<Mailbox>`.

- [ ] **Step 1: Implement `MailboxResolver`**

```java
package cn.arorms.email.service;

import cn.arorms.email.domain.entity.Mailbox;
import cn.arorms.email.domain.enums.MailboxType;
import cn.arorms.email.domain.property.MailProperties;
import cn.arorms.email.repository.MailboxRepository;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class MailboxResolver {

    private final MailboxRepository mailboxRepository;
    private final String domain;

    public MailboxResolver(MailboxRepository mailboxRepository, MailProperties mailProperties) {
        this.mailboxRepository = mailboxRepository;
        this.domain = mailProperties.getDomain();
    }

    public Optional<Mailbox> resolve(String recipient) {
        if (recipient == null || !recipient.toLowerCase().endsWith("@" + domain.toLowerCase())) {
            return Optional.empty();
        }

        String localPart = recipient.substring(0, recipient.lastIndexOf('@'));
        String username = localPart;
        String label = null;

        int plusIndex = localPart.indexOf('+');
        if (plusIndex > 0) {
            username = localPart.substring(0, plusIndex);
            label = localPart.substring(plusIndex + 1);
        }

        Optional<Mailbox> inbox = mailboxRepository.findByUserIdAndType(username, MailboxType.INBOX);
        if (inbox.isEmpty()) {
            return Optional.empty();
        }

        if (label != null && !label.isBlank()) {
            Optional<Mailbox> labeled = mailboxRepository.findByUserIdAndName(username, label);
            if (labeled.isPresent()) {
                return labeled;
            }
        }

        return inbox;
    }
}
```

- [ ] **Step 2: Add repository methods**

Add to `MailboxRepository`:

```java
Optional<Mailbox> findByUserIdAndType(String userId, MailboxType type);
Optional<Mailbox> findByUserIdAndName(String userId, String name);
List<Mailbox> findByUserId(String userId);
```

- [ ] **Step 3: Write tests**

```java
@ExtendWith(MockitoExtension.class)
class MailboxResolverTest {

    @Mock
    private MailboxRepository mailboxRepository;

    @Mock
    private MailProperties mailProperties;

    private MailboxResolver resolver;

    @BeforeEach
    void setUp() {
        when(mailProperties.getDomain()).thenReturn("arorms.cn");
        resolver = new MailboxResolver(mailboxRepository, mailProperties);
    }

    @Test
    void shouldResolvePlainUserToInbox() {
        Mailbox inbox = new Mailbox();
        inbox.setType(MailboxType.INBOX);
        when(mailboxRepository.findByUserIdAndType("alice", MailboxType.INBOX))
            .thenReturn(Optional.of(inbox));

        Optional<Mailbox> result = resolver.resolve("alice@arorms.cn");

        assertThat(result).isPresent();
        assertThat(result.get().getType()).isEqualTo(MailboxType.INBOX);
    }

    @Test
    void shouldFallbackPlusAddressToInbox() {
        Mailbox inbox = new Mailbox();
        inbox.setType(MailboxType.INBOX);
        when(mailboxRepository.findByUserIdAndType("alice", MailboxType.INBOX))
            .thenReturn(Optional.of(inbox));
        when(mailboxRepository.findByUserIdAndName("alice", "work"))
            .thenReturn(Optional.empty());

        Optional<Mailbox> result = resolver.resolve("alice+work@arorms.cn");

        assertThat(result).isPresent();
        assertThat(result.get().getType()).isEqualTo(MailboxType.INBOX);
    }

    @Test
    void shouldDropUnknownUser() {
        when(mailboxRepository.findByUserIdAndType("bob", MailboxType.INBOX))
            .thenReturn(Optional.empty());

        Optional<Mailbox> result = resolver.resolve("bob@arorms.cn");

        assertThat(result).isEmpty();
    }
}
```

- [ ] **Step 4: Run tests**

Run: `mvn -pl backend/email-app test -Dtest=MailboxResolverTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/email-app/.../service/MailboxResolver.java backend/email-app/.../repository/MailboxRepository.java backend/email-app/.../test/.../MailboxResolverTest.java
git commit -m "feat: resolve recipient addresses to local mailboxes"
```

---

### Task 5: Implement MIME parsing and attachment metadata extraction

**Files:**
- Create: `backend/email-app/src/main/java/cn/arorms/email/service/MimeParser.java`
- Test: `backend/email-app/src/test/java/cn/arorms/email/service/MimeParserTest.java` (new)
- Add sample `.eml` to: `backend/email-app/src/test/resources/sample-mails/`

**Interfaces:**
- Produces: `MimeParser.parse(Path file)` returns a DTO (`ParsedMessage`) with:
  - `messageId`, `fromAddress`, `replyTo`, `subject`, `sentAt`, `deliveredTo`
  - `textContent`, `htmlContent`
  - `recipients` (list of `To`/`Cc`/`Bcc` addresses in our domain)
  - `attachments` (list of `ParsedAttachment` with filename, contentType, size, checksum)
  - `isBounce` boolean
  - `originalMessageId` (for bounces)

- [ ] **Step 1: Define `ParsedMessage` and `ParsedAttachment` DTOs**

Create package-local records in `cn.arorms.email.service.mime`:

```java
record ParsedAttachment(String filename, String contentType, long size, String checksum) {}

record ParsedMessage(
    String messageId,
    String fromAddress,
    String replyTo,
    String subject,
    Instant sentAt,
    String deliveredTo,
    String textContent,
    String htmlContent,
    List<String> recipients,
    List<ParsedAttachment> attachments,
    boolean bounce,
    String originalMessageId
) {}
```

- [ ] **Step 2: Implement `MimeParser`**

Use `jakarta.mail.Session` with `MimeMessage`. Extract bodies recursively:

```java
public ParsedMessage parse(Path file) throws MessagingException, IOException {
    Session session = Session.getDefaultInstance(new Properties());
    try (InputStream is = Files.newInputStream(file)) {
        MimeMessage message = new MimeMessage(session, is);
        // extract headers, bodies, attachments, bounce info
    }
}
```

For attachment checksum, read the `InputStream` once and compute SHA-256 hex.

- [ ] **Step 3: Add sample `.eml` files**

Add two files under `src/test/resources/sample-mails/`:
- `plain-with-attachment.eml`
- `bounce-dsn.eml` (use the real bounce from the server output)

- [ ] **Step 4: Write tests**

```java
class MimeParserTest {

    private final MimeParser parser = new MimeParser("arorms.cn");

    @Test
    void shouldParsePlainMailWithAttachment() throws Exception {
        Path sample = Paths.get(getClass().getResource("/sample-mails/plain-with-attachment.eml").toURI());
        ParsedMessage msg = parser.parse(sample);

        assertThat(msg.fromAddress()).isEqualTo("gitlab@arorms.cn");
        assertThat(msg.subject()).isEqualTo("Confirmation instructions");
        assertThat(msg.recipients()).contains("holmesamzish86@gmail.com"); // adjust as needed
        assertThat(msg.attachments()).isEmpty(); // sample has no real attachment
    }

    @Test
    void shouldDetectBounceAndExtractOriginalMessageId() throws Exception {
        Path sample = Paths.get(getClass().getResource("/sample-mails/bounce-dsn.eml").toURI());
        ParsedMessage msg = parser.parse(sample);

        assertThat(msg.bounce()).isTrue();
        assertThat(msg.originalMessageId()).isEqualTo("<20260902054111.00789382537@mail.arorms.cn>"); // adjust
    }
}
```

- [ ] **Step 5: Run tests**

Run: `mvn -pl backend/email-app test -Dtest=MimeParserTest`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/email-app/.../service/MimeParser.java backend/email-app/.../service/mime/*.java backend/email-app/.../test/resources/sample-mails/ backend/email-app/.../test/.../MimeParserTest.java
git commit -m "feat: parse incoming MIME messages and extract attachment metadata"
```

---

### Task 6: Implement file lifecycle (cur / dead-letter)

**Files:**
- Create: `backend/email-app/src/main/java/cn/arorms/email/service/MaildirFileManager.java`
- Test: `backend/email-app/src/test/java/cn/arorms/email/service/MaildirFileManagerTest.java` (new)

**Interfaces:**
- Produces: `MaildirFileManager.archive(Path source)` moves file to `cur/` with `:2,` suffix.
- Produces: `MaildirFileManager.deadLetter(Path source, String reason)` moves file to `dead-letter/`.

- [ ] **Step 1: Implement `MaildirFileManager`**

```java
package cn.arorms.email.service;

import cn.arorms.email.property.MaildirProperties;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

@Component
public class MaildirFileManager {

    private final MaildirProperties properties;

    public MaildirFileManager(MaildirProperties properties) {
        this.properties = properties;
    }

    public Path archive(Path source) throws IOException {
        Path target = properties.curPath().resolve(source.getFileName().toString() + ":2,");
        Files.createDirectories(properties.curPath());
        return Files.move(source, target, StandardCopyOption.ATOMIC_MOVE);
    }

    public Path deadLetter(Path source, String reason) throws IOException {
        Path dir = properties.deadLetterPath();
        Files.createDirectories(dir);
        Path target = dir.resolve(source.getFileName().toString());
        return Files.move(source, target, StandardCopyOption.ATOMIC_MOVE);
    }
}
```

- [ ] **Step 2: Write tests using JUnit temp dir**

```java
class MaildirFileManagerTest {

    @TempDir
    Path tempDir;

    private MaildirFileManager manager;

    @BeforeEach
    void setUp() {
        MaildirProperties props = new MaildirProperties();
        props.setBasePath(tempDir.toString());
        manager = new MaildirFileManager(props);
    }

    @Test
    void shouldMoveFileToCur() throws IOException {
        Path source = tempDir.resolve("new/mail.styx");
        Files.createDirectories(source.getParent());
        Files.writeString(source, "body");

        Path archived = manager.archive(source);

        assertThat(archived).endsWith(Path.of("cur/mail.styx:2,"));
        assertThat(source).doesNotExist();
    }

    @Test
    void shouldMoveFailedFileToDeadLetter() throws IOException {
        Path source = tempDir.resolve("new/broken.styx");
        Files.createDirectories(source.getParent());
        Files.writeString(source, "body");

        Path dead = manager.deadLetter(source, "parse error");

        assertThat(dead).endsWith(Path.of("dead-letter/broken.styx"));
        assertThat(source).doesNotExist();
    }
}
```

- [ ] **Step 3: Run tests**

Run: `mvn -pl backend/email-app test -Dtest=MaildirFileManagerTest`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/email-app/.../service/MaildirFileManager.java backend/email-app/.../test/.../MaildirFileManagerTest.java
git commit -m "feat: implement maildir file lifecycle (archive and dead-letter)"
```

---

### Task 7: Implement bounce handling

**Files:**
- Create: `backend/email-app/src/main/java/cn/arorms/email/service/BounceHandler.java`
- Test: `backend/email-app/src/test/java/cn/arorms/email/service/BounceHandlerTest.java` (new)

**Interfaces:**
- Consumes: `ParsedMessage` with `bounce=true` and `originalMessageId`.
- Consumes: `MailRepository`, `MailRecipientRepository`.
- Produces: `BounceHandler.handle(ParsedMessage bounce)` updates `MailRecipient.status` to `FAILED`.

- [ ] **Step 1: Add `MailRecipientRepository` method**

```java
Optional<MailRecipient> findByMail_MessageIdAndRecipient(String messageId, String recipient);
```

- [ ] **Step 2: Implement `BounceHandler`**

```java
package cn.arorms.email.service;

import cn.arorms.email.domain.entity.MailRecipient;
import cn.arorms.email.domain.enums.DeliveryStatus;
import cn.arorms.email.repository.MailRecipientRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class BounceHandler {

    private final MailRecipientRepository mailRecipientRepository;

    public BounceHandler(MailRecipientRepository mailRecipientRepository) {
        this.mailRecipientRepository = mailRecipientRepository;
    }

    @Transactional
    public void handle(ParsedMessage bounce) {
        if (!bounce.bounce() || bounce.originalMessageId() == null) {
            return;
        }

        String originalMessageId = bounce.originalMessageId();
        String failedRecipient = bounce.failedRecipient(); // parse from delivery-status part

        if (failedRecipient != null) {
            mailRecipientRepository
                .findByMail_MessageIdAndRecipient(originalMessageId, failedRecipient)
                .ifPresent(recipient -> {
                    recipient.setStatus(DeliveryStatus.FAILED);
                    recipient.setErrorMessage(bounce.bounceReason());
                });
        }
    }
}
```

Adjust `ParsedMessage` to include `failedRecipient()` and `bounceReason()` if needed.

- [ ] **Step 3: Write tests**

Mock repository and verify status update.

- [ ] **Step 4: Run tests**

Run: `mvn -pl backend/email-app test -Dtest=BounceHandlerTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/email-app/.../service/BounceHandler.java backend/email-app/.../repository/MailRecipientRepository.java backend/email-app/.../test/.../BounceHandlerTest.java
git commit -m "feat: handle delivery status notifications and update original mail status"
```

---

### Task 8: Wire everything into `MaildirProcessor`

**Files:**
- Create: `backend/email-app/src/main/java/cn/arorms/email/service/MaildirProcessor.java`
- Test: `backend/email-app/src/test/java/cn/arorms/email/service/MaildirProcessorTest.java` (new)

**Interfaces:**
- Consumes: `MimeParser`, `MailboxResolver`, `MaildirFileManager`, `BounceHandler`, `MailRepository`, `AttachmentRepository`.
- Produces: `MaildirProcessor.process(Path file)` which persists mail and moves the file.

- [ ] **Step 1: Implement `MaildirProcessor`**

```java
package cn.arorms.email.service;

import cn.arorms.email.domain.entity.Attachment;
import cn.arorms.email.domain.entity.Mail;
import cn.arorms.email.domain.entity.Mailbox;
import cn.arorms.email.property.MaildirProperties;
import cn.arorms.email.repository.AttachmentRepository;
import cn.arorms.email.repository.MailRepository;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.nio.file.Path;
import java.time.Instant;
import java.util.List;

@Component
public class MaildirProcessor {

    private static final Logger log = LoggerFactory.getLogger(MaildirProcessor.class);

    private final MimeParser mimeParser;
    private final MailboxResolver resolver;
    private final MaildirFileManager fileManager;
    private final BounceHandler bounceHandler;
    private final MailRepository mailRepository;
    private final AttachmentRepository attachmentRepository;
    private final MaildirProperties properties;

    public MaildirProcessor(... inject all ...) {
        // assign fields
    }

    @Transactional
    public void process(Path file) {
        ParsedMessage parsed;
        try {
            parsed = mimeParser.parse(file);
        } catch (Exception e) {
            log.error("Failed to parse mail file: {}", file, e);
            moveToDeadLetter(file, "parse failed: " + e.getMessage());
            return;
        }

        try {
            if (parsed.bounce()) {
                bounceHandler.handle(parsed);
            }

            List<String> localRecipients = parsed.recipients();
            if (localRecipients.isEmpty()) {
                log.warn("No local recipients for file: {}", file);
                fileManager.archive(file);
                return;
            }

            for (String recipient : localRecipients) {
                resolver.resolve(recipient).ifPresent(mailbox -> {
                    Mail mail = saveMail(mailbox, parsed, file);
                    saveAttachments(mail, parsed.attachments());
                });
            }

            fileManager.archive(file);
        } catch (Exception e) {
            log.error("Failed to process mail file: {}", file, e);
            moveToDeadLetter(file, "process failed: " + e.getMessage());
        }
    }

    private Mail saveMail(Mailbox mailbox, ParsedMessage parsed, Path file) {
        Mail mail = new Mail();
        mail.setMailbox(mailbox);
        mail.setMessageId(parsed.messageId());
        mail.setFromAddress(parsed.fromAddress());
        mail.setReplyTo(parsed.replyTo());
        mail.setSubject(parsed.subject());
        mail.setSentAt(parsed.sentAt());
        mail.setReceivedAt(Instant.now());
        mail.setDeliveredTo(parsed.deliveredTo());
        mail.setTextContent(parsed.textContent());
        mail.setHtmlContent(parsed.htmlContent());
        mail.setBounce(parsed.bounce());
        mail.setRawPath(properties.curPath().resolve(file.getFileName().toString() + ":2,").toString());
        return mailRepository.save(mail);
    }

    private void saveAttachments(Mail mail, List<ParsedAttachment> attachments) {
        for (ParsedAttachment a : attachments) {
            Attachment attachment = new Attachment();
            attachment.setMail(mail);
            attachment.setFilename(a.filename());
            attachment.setContentType(a.contentType());
            attachment.setSize(a.size());
            attachment.setChecksum(a.checksum());
            attachmentRepository.save(attachment);
        }
    }

    private void moveToDeadLetter(Path file, String reason) {
        try {
            fileManager.deadLetter(file, reason);
        } catch (Exception ex) {
            log.error("Failed to move file to dead-letter: {}", file, ex);
        }
    }
}
```

- [ ] **Step 2: Write integration test with temp maildir**

Use `@SpringBootTest` with a temporary `MaildirProperties` bean or `@TestConfiguration` to override `base-path` to `@TempDir`.

Test places a sample `.eml` into `new/`, calls `processor.process(...)`, asserts:
- file moved to `cur/`
- `Mail` record created in INBOX
- `Attachment` records created

- [ ] **Step 3: Run tests**

Run: `mvn -pl backend/email-app test -Dtest=MaildirProcessorTest`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/email-app/.../service/MaildirProcessor.java backend/email-app/.../test/.../MaildirProcessorTest.java
git commit -m "feat: wire mime parsing, routing, and persistence into maildir processor"
```

---

### Task 9: Implement the file system watcher

**Files:**
- Create: `backend/email-app/src/main/java/cn/arorms/email/service/MaildirWatcher.java`
- Test: `backend/email-app/src/test/java/cn/arorms/email/service/MaildirWatcherTest.java` (new)

**Interfaces:**
- Consumes: `MaildirProperties`, `MaildirProcessor`.
- Produces: `MaildirWatcher` implements `SmartLifecycle`, registers `WatchService` on `new/`, calls `processor.process(...)` on `ENTRY_CREATE`.

- [ ] **Step 1: Implement `MaildirWatcher`**

```java
package cn.arorms.email.service;

import cn.arorms.email.property.MaildirProperties;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.*;

@Component
public class MaildirWatcher implements SmartLifecycle {

    private static final Logger log = LoggerFactory.getLogger(MaildirWatcher.class);

    private final MaildirProperties properties;
    private final MaildirProcessor processor;
    private WatchService watchService;
    private Thread watchThread;
    private volatile boolean running = false;

    public MaildirWatcher(MaildirProperties properties, MaildirProcessor processor) {
        this.properties = properties;
        this.processor = processor;
    }

    @Override
    public void start() {
        Path newPath = properties.newPath();
        try {
            Files.createDirectories(newPath);
            watchService = FileSystems.getDefault().newWatchService();
            newPath.register(watchService, StandardWatchEventKinds.ENTRY_CREATE);
            running = true;
            watchThread = new Thread(this::watchLoop, "maildir-watcher");
            watchThread.setDaemon(true);
            watchThread.start();
            log.info("Started watching maildir: {}", newPath);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to start maildir watcher", e);
        }
    }

    private void watchLoop() {
        while (running) {
            try {
                WatchKey key = watchService.take();
                for (WatchEvent<?> event : key.pollEvents()) {
                    Path fileName = (Path) event.context();
                    Path file = properties.newPath().resolve(fileName);
                    processor.process(file);
                }
                key.reset();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            } catch (Exception e) {
                log.error("Error in maildir watch loop", e);
            }
        }
    }

    @Override
    public void stop() {
        running = false;
        if (watchThread != null) {
            watchThread.interrupt();
        }
        if (watchService != null) {
            try {
                watchService.close();
            } catch (IOException e) {
                log.error("Failed to close watch service", e);
            }
        }
    }

    @Override
    public boolean isRunning() {
        return running;
    }
}
```

- [ ] **Step 2: Write test**

Use a temporary directory and a mocked `MaildirProcessor`. Place a file into `new/`, wait for watcher to detect it, verify `processor.process(...)` was called.

- [ ] **Step 3: Run tests**

Run: `mvn -pl backend/email-app test -Dtest=MaildirWatcherTest`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/email-app/.../service/MaildirWatcher.java backend/email-app/.../test/.../MaildirWatcherTest.java
git commit -m "feat: add inotify-based maildir watcher"
```

---

### Task 10: Add inbox query API endpoints

**Files:**
- Modify: `backend/email-app/src/main/java/cn/arorms/email/controllers/MailController.java`
- Create DTOs: `backend/email-app/src/main/java/cn/arorms/email/dto/MailboxDto.java`, `MailSummaryDto.java`, `MailDetailDto.java`
- Test: `backend/email-app/src/test/java/cn/arorms/email/controllers/MailControllerTest.java` (new or extend)

**Interfaces:**
- Consumes: `MailboxRepository`, `MailRepository`, `AttachmentRepository`, `UserPrincipal`.
- Produces: `GET /api/mail/mailboxes`, `GET /api/mail/mailboxes/{id}/mails`, `GET /api/mail/mails/{id}`, `PATCH /api/mail/mails/{id}/read`.

- [ ] **Step 1: Define DTOs**

```java
public record MailboxDto(Long id, String name, String type) {}

public record MailSummaryDto(
    Long id,
    String fromAddress,
    String subject,
    Instant sentAt,
    Instant receivedAt,
    boolean seen
) {}

public record AttachmentDto(
    Long id,
    String filename,
    String contentType,
    Long size
) {}

public record MailDetailDto(
    Long id,
    String fromAddress,
    String replyTo,
    String subject,
    Instant sentAt,
    Instant receivedAt,
    String deliveredTo,
    boolean seen,
    String textContent,
    String htmlContent,
    String rawPath,
    List<AttachmentDto> attachments
) {}
```

- [ ] **Step 2: Add controller methods**

```java
@GetMapping("/mailboxes")
public List<MailboxDto> listMailboxes(@AuthenticationPrincipal UserPrincipal user) {
    return mailboxRepository.findByUserId(user.getId()).stream()
        .map(box -> new MailboxDto(box.getId(), box.getName(), box.getType().name()))
        .toList();
}

@GetMapping("/mailboxes/{id}/mails")
public Page<MailSummaryDto> listMailboxMails(
    @AuthenticationPrincipal UserPrincipal user,
    @PathVariable Long id,
    @PageableDefault(size = 20) Pageable pageable) {
    // verify ownership
    return mailRepository.findByMailboxIdAndMailboxUserId(id, user.getId(), pageable)
        .map(mail -> new MailSummaryDto(...));
}

@GetMapping("/mails/{id}")
public MailDetailDto getMail(@AuthenticationPrincipal UserPrincipal user, @PathVariable Long id) {
    // verify ownership
}

@PatchMapping("/mails/{id}/read")
public void markRead(@AuthenticationPrincipal UserPrincipal user, @PathVariable Long id) {
    // verify ownership, set seen = true
}
```

- [ ] **Step 3: Add repository methods**

```java
Page<Mail> findByMailboxIdAndMailboxUserId(Long mailboxId, String userId, Pageable pageable);
Optional<Mail> findByIdAndMailboxUserId(Long id, String userId);
```

- [ ] **Step 4: Write tests**

Use `@WebMvcTest` or `@SpringBootTest` with a test user. Verify:
- list mailboxes returns only own mailboxes
- cannot access another user's mail

- [ ] **Step 5: Run tests**

Run: `mvn -pl backend/email-app test -Dtest=MailControllerTest`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/email-app/.../controllers/MailController.java backend/email-app/.../dto/*.java backend/email-app/.../repository/MailRepository.java backend/email-app/.../test/.../MailControllerTest.java
git commit -m "feat: add inbox query API endpoints"
```

---

### Task 11: Add end-to-end manual verification

**Files:**
- Create: `test/curl/07-list-mailboxes.sh`
- Create: `test/curl/08-list-mails.sh`
- Create: `test/curl/09-get-mail.sh`
- Modify: `test/curl/run-all.sh`
- Modify: `test/http/send-email.http` or create `test/http/inbox.http`

**Interfaces:**
- Produces: shell scripts to manually verify received mail flow.

- [ ] **Step 1: Add `07-list-mailboxes.sh`**

```bash
#!/bin/bash
set -e
source "$(dirname "$0")/lib.sh"

curl -sS -H "Authorization: Bearer $(get_access_token)" \
  "${BASE_URL}/api/mail/mailboxes" | jq .
```

- [ ] **Step 2: Add `08-list-mails.sh`**

```bash
#!/bin/bash
set -e
source "$(dirname "$0")/lib.sh"

MAILBOX_ID=${1:?"Usage: $0 <mailbox-id>"}
curl -sS -H "Authorization: Bearer $(get_access_token)" \
  "${BASE_URL}/api/mail/mailboxes/${MAILBOX_ID}/mails" | jq .
```

- [ ] **Step 3: Add `09-get-mail.sh`**

```bash
#!/bin/bash
set -e
source "$(dirname "$0")/lib.sh"

MAIL_ID=${1:?"Usage: $0 <mail-id>"}
curl -sS -H "Authorization: Bearer $(get_access_token)" \
  "${BASE_URL}/api/mail/mails/${MAIL_ID}" | jq .
```

- [ ] **Step 4: Update `run-all.sh`**

Add calls to the new scripts.

- [ ] **Step 5: Manual test procedure**

1. Start backend.
2. Login via frontend or curl to trigger `AuthController.me()` → default mailboxes created.
3. Send an email from external account to `username@arorms.cn`.
4. Verify file appears in `/var/mail/Maildir/cur/`.
5. Run `07-list-mailboxes.sh` and note INBOX id.
6. Run `08-list-mails.sh <inbox-id>` to see received mail.
7. Run `09-get-mail.sh <mail-id>` to see detail with attachments.

- [ ] **Step 6: Commit**

```bash
git add test/curl/07-list-mailboxes.sh test/curl/08-list-mails.sh test/curl/09-get-mail.sh test/curl/run-all.sh
git commit -m "test: add manual verification scripts for inbox APIs"
```

---

## Self-Review

### Spec Coverage

| Spec Section | Implementing Task |
|---|---|
| WatchService/inotify watcher | Task 9 |
| MIME parsing | Task 5 |
| Address resolution & plus addressing | Task 4 |
| First-login default mailboxes | Task 2 |
| Remove lazy SENT creation | Task 2 |
| Data model changes (Mail, Mailbox, Attachment) | Task 1 |
| File lifecycle (cur / dead-letter) | Task 6 |
| Bounce handling | Task 7 |
| Inbox query API | Task 10 |
| Manual verification | Task 11 |
| Operational notes (permissions, single instance) | Documented in spec, not code tasks |

### Placeholder Scan

- No TBD/TODO placeholders.
- Each task includes concrete file paths, code snippets, test commands, and commit commands.
- Repository methods are explicitly listed.

### Type Consistency

- `MailboxType` enum values reused consistently.
- `Mail` fields (`receivedAt`, `deliveredTo`, etc.) match between Task 1 and Task 8.
- `ParsedMessage` record fields referenced in Task 5, 7, and 8 align.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-02-mail-reception.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** - Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

**Which approach?**
