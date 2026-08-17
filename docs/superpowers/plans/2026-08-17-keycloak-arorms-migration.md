# Keycloak & arorms Libraries Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bespoke local JWT/password auth in email-server with Keycloak federated authentication using the shared `arorms-common` and `arorms-security` libraries, deleting the `email-security` and `email-redis` modules.

**Architecture:** Backend becomes a stateless resource server that validates Keycloak-issued JWTs via `arorms-security`. The frontend will perform OIDC directly against Keycloak. Local `User` table is removed; mailbox ownership is keyed by the Keycloak subject UUID. `arorms-common` provides shared exceptions and `PageResponse`.

**Tech Stack:** Java 21, Maven, Spring Boot 4.0.6, Spring Security OAuth2 Resource Server, Keycloak, `cn.arorms.framework:arorms-common:1.0-SNAPSHOT`, `cn.arorms.framework:arorms-security:1.0-SNAPSHOT`.

## Global Constraints

- Group ID for all local modules: `cn.arorms.email`
- All local packages remain under `cn.arorms.email.*`
- Authentication: Keycloak-issued JWT, RS256, issuer + audience validation
- Authorization: `/api/mail/**` requires authentication; all other requests permitAll; no role distinction in this phase
- Backend does NOT expose login/register endpoints; frontend talks directly to Keycloak
- Error responses use `arorms-common` `BaseExceptionHandler` (simple string bodies); local `ErrorBody` JSON format is removed
- `Mailbox` ownership stored as `String ownerSubject` (Keycloak UUID), no local `User` table
- Old local data can be dropped; the application will recreate mailboxes lazily per user

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/pom.xml` | Modify | Remove `email-security` and `email-redis` child modules |
| `backend/email-common/pom.xml` | Modify | Add `arorms-common` dependency |
| `backend/email-app/pom.xml` | Modify | Remove `email-security`/`email-redis` deps; add `arorms-security` dependency |
| `backend/email-security/` | Delete | Entire module removed |
| `backend/email-redis/` | Delete | Entire module removed |
| `backend/email-common/.../entity/User.java` | Delete | No local users |
| `backend/email-common/.../repository/UserRepository.java` | Delete | No local users |
| `backend/email-common/.../dto/LoginRequest.java` | Delete | Local login DTO |
| `backend/email-common/.../dto/RegisterRequest.java` | Delete | Local register DTO |
| `backend/email-common/.../dto/TokenResponse.java` | Delete | Local token DTO |
| `backend/email-common/.../dto/UserInfoResponse.java` | Delete | Local user info DTO |
| `backend/email-common/.../property/JwtProperties.java` | Delete | Local JWT config |
| `backend/email-common/.../exception/ErrorBody.java` | Delete | Local JSON error body |
| `backend/email-common/.../exception/Duplicate*Exception.java` | Delete | Registration-specific |
| `backend/email-common/.../exception/Invalid*Exception.java` | Delete | Registration/verification-specific |
| `backend/email-common/.../exception/RateLimitedException.java` | Delete | Rate-limit-specific |
| `backend/email-common/.../entity/Mailbox.java` | Modify | Replace `User owner` FK with `String ownerSubject` |
| `backend/email-common/.../repository/MailboxRepository.java` | Modify | `findByOwnerSubjectAndType` |
| `backend/email-app/.../config/SecurityConfig.java` | Create | Keycloak resource server filter chain |
| `backend/email-app/.../web/AuthController.java` | Delete | No local auth endpoints |
| `backend/email-app/.../service/AuthService.java` | Delete | No local auth service |
| `backend/email-app/.../service/AuthLoginResult.java` | Delete | No local token minting |
| `backend/email-app/.../web/SendCodeRequest.java` | Delete | No verification code flow |
| `backend/email-app/.../web/error/GlobalExceptionHandler.java` | Delete | Use `arorms-common` handler |
| `backend/email-app/.../web/MailController.java` | Modify | Use `UserPrincipal` from arorms-security |
| `backend/email-app/.../service/MailService.java` | Modify | Use `UserPrincipal`; remove `UserRepository` |
| `backend/email-app/.../resources/application.yml` | Modify | Keycloak issuer/audience; remove JWT/Redis/verification props |
| `backend/email-app/src/test/http/auth-flow.http` | Delete | Obsolete local auth test |
| `backend/email-app/src/test/resources/application.yml` | Create | Exclude arorms-security auto-config for context-load test |

---

### Task 1: Restructure Maven Modules

**Files:**
- Modify: `backend/pom.xml`
- Delete: `backend/email-security/`, `backend/email-redis/`

**Interfaces:**
- Produces: parent POM with only `email-common` and `email-app` modules

- [ ] **Step 1: Edit parent POM modules**

```xml
<modules>
    <module>email-common</module>
    <module>email-app</module>
</modules>
```

- [ ] **Step 2: Remove module directories and stage deletions**

```bash
git rm -r backend/email-security backend/email-redis
```

- [ ] **Step 3: Validate POM structure**

```bash
mvn -q -f backend/pom.xml validate
```

Expected: `BUILD SUCCESS`

- [ ] **Step 4: Commit**

```bash
git add backend/pom.xml
git commit -m "refactor(modules): remove email-security and email-redis modules"
```

---

### Task 2: Add arorms-common to email-common

**Files:**
- Modify: `backend/email-common/pom.xml`

**Interfaces:**
- Consumes: `cn.arorms.framework:arorms-common:1.0-SNAPSHOT` from local Maven repo
- Produces: `email-common` transitively provides `arorms-common` to `email-app`

- [ ] **Step 1: Add dependency**

```xml
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
    <dependency>
        <groupId>com.fasterxml.jackson.core</groupId>
        <artifactId>jackson-annotations</artifactId>
    </dependency>
    <dependency>
        <groupId>cn.arorms.framework</groupId>
        <artifactId>arorms-common</artifactId>
        <version>1.0-SNAPSHOT</version>
    </dependency>
</dependencies>
```

- [ ] **Step 2: Validate email-common POM resolves**

```bash
mvn -q -f backend/email-common/pom.xml validate
```

Expected: `BUILD SUCCESS`

- [ ] **Step 3: Commit**

```bash
git add backend/email-common/pom.xml
git commit -m "build(email-common): add arorms-common dependency"
```

---

### Task 3: Clean email-common and Key Mailbox by Keycloak Subject

**Files:**
- Delete:
  - `backend/email-common/src/main/java/cn/arorms/email/domain/entity/User.java`
  - `backend/email-common/src/main/java/cn/arorms/email/domain/repository/UserRepository.java`
  - `backend/email-common/src/main/java/cn/arorms/email/domain/dto/LoginRequest.java`
  - `backend/email-common/src/main/java/cn/arorms/email/domain/dto/RegisterRequest.java`
  - `backend/email-common/src/main/java/cn/arorms/email/domain/dto/TokenResponse.java`
  - `backend/email-common/src/main/java/cn/arorms/email/domain/dto/UserInfoResponse.java`
  - `backend/email-common/src/main/java/cn/arorms/email/domain/property/JwtProperties.java`
  - `backend/email-common/src/main/java/cn/arorms/email/domain/exception/ErrorBody.java`
  - `backend/email-common/src/main/java/cn/arorms/email/domain/exception/DuplicateEmailException.java`
  - `backend/email-common/src/main/java/cn/arorms/email/domain/exception/DuplicateUsernameException.java`
  - `backend/email-common/src/main/java/cn/arorms/email/domain/exception/InvalidEmailFormatException.java`
  - `backend/email-common/src/main/java/cn/arorms/email/domain/exception/InvalidRefreshTokenException.java`
  - `backend/email-common/src/main/java/cn/arorms/email/domain/exception/InvalidVerificationCodeException.java`
  - `backend/email-common/src/main/java/cn/arorms/email/domain/exception/RateLimitedException.java`
- Modify:
  - `backend/email-common/src/main/java/cn/arorms/email/domain/entity/Mailbox.java`
  - `backend/email-common/src/main/java/cn/arorms/email/domain/repository/MailboxRepository.java`

**Interfaces:**
- Consumes: Keycloak subject UUID as `String`
- Produces: `email-common` with only mail domain artifacts; `Mailbox.ownerSubject` and `MailboxRepository.findByOwnerSubjectAndType(String, MailboxType)`

- [ ] **Step 1: Delete the listed auth artifacts**

```bash
rm backend/email-common/src/main/java/cn/arorms/email/domain/entity/User.java \
   backend/email-common/src/main/java/cn/arorms/email/domain/repository/UserRepository.java \
   backend/email-common/src/main/java/cn/arorms/email/domain/dto/LoginRequest.java \
   backend/email-common/src/main/java/cn/arorms/email/domain/dto/RegisterRequest.java \
   backend/email-common/src/main/java/cn/arorms/email/domain/dto/TokenResponse.java \
   backend/email-common/src/main/java/cn/arorms/email/domain/dto/UserInfoResponse.java \
   backend/email-common/src/main/java/cn/arorms/email/domain/property/JwtProperties.java \
   backend/email-common/src/main/java/cn/arorms/email/domain/exception/ErrorBody.java \
   backend/email-common/src/main/java/cn/arorms/email/domain/exception/DuplicateEmailException.java \
   backend/email-common/src/main/java/cn/arorms/email/domain/exception/DuplicateUsernameException.java \
   backend/email-common/src/main/java/cn/arorms/email/domain/exception/InvalidEmailFormatException.java \
   backend/email-common/src/main/java/cn/arorms/email/domain/exception/InvalidRefreshTokenException.java \
   backend/email-common/src/main/java/cn/arorms/email/domain/exception/InvalidVerificationCodeException.java \
   backend/email-common/src/main/java/cn/arorms/email/domain/exception/RateLimitedException.java
```

- [ ] **Step 2: Update `Mailbox.java`**

Replace:
```java
@ManyToOne(fetch = FetchType.LAZY, optional = false)
@JoinColumn(name = "owner_id", nullable = false)
private User owner;
```

With:
```java
@Column(name = "owner_subject", nullable = false, length = 36)
private String ownerSubject;
```

Replace getters/setters:
```java
public String getOwnerSubject() {
    return ownerSubject;
}

public void setOwnerSubject(String ownerSubject) {
    this.ownerSubject = ownerSubject;
}
```

Remove unused imports: `FetchType`, `JoinColumn`, `ManyToOne`.

- [ ] **Step 3: Update `MailboxRepository.java`**

```java
package cn.arorms.email.domain.repository;

import cn.arorms.email.domain.entity.Mailbox;
import cn.arorms.email.domain.enums.MailboxType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MailboxRepository extends JpaRepository<Mailbox, Long> {
    Optional<Mailbox> findByOwnerSubjectAndType(String ownerSubject, MailboxType mailboxType);
}
```

- [ ] **Step 4: Compile email-common**

```bash
mvn -q -f backend/email-common/pom.xml compile
```

Expected: `BUILD SUCCESS`

- [ ] **Step 5: Commit**

```bash
git add -A backend/email-common

git commit -m "refactor(email-common): remove local auth artifacts, key mailbox by KC subject"
```

---

### Task 5: Update email-app POM

**Files:**
- Modify: `backend/email-app/pom.xml`

**Interfaces:**
- Consumes: `email-common` (with transitive `arorms-common`), direct `arorms-security`
- Produces: updated dependency list

- [ ] **Step 1: Replace dependencies block**

```xml
<dependencies>
    <dependency>
        <groupId>cn.arorms.email</groupId>
        <artifactId>email-common</artifactId>
        <version>0.0.1-SNAPSHOT</version>
    </dependency>
    <dependency>
        <groupId>cn.arorms.framework</groupId>
        <artifactId>arorms-security</artifactId>
        <version>1.0-SNAPSHOT</version>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-webmvc</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-mail</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-persistence</artifactId>
    </dependency>
    <dependency>
        <groupId>org.postgresql</groupId>
        <artifactId>postgresql</artifactId>
        <scope>runtime</scope>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-test</artifactId>
        <scope>test</scope>
    </dependency>
</dependencies>
```

- [ ] **Step 2: Validate POM**

```bash
mvn -q -f backend/email-app/pom.xml validate
```

Expected: `BUILD SUCCESS`

- [ ] **Step 3: Commit**

```bash
git add backend/email-app/pom.xml
git commit -m "build(email-app): switch to arorms-security, remove local security/redis deps"
```

---

### Task 6: Add Keycloak Security Configuration

**Files:**
- Create: `backend/email-app/src/main/java/cn/arorms/email/config/SecurityConfig.java`

**Interfaces:**
- Consumes: `cn.arorms.framework.security.SecurityAutoConfiguration`, `KeycloakAuthenticationConverter`
- Produces: `SecurityFilterChain` requiring authentication for `/api/mail/**`

- [ ] **Step 1: Create `SecurityConfig.java`**

```java
package cn.arorms.email.config;

import cn.arorms.framework.security.KeycloakAuthenticationConverter;
import cn.arorms.framework.security.SecurityAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
@Import(SecurityAutoConfiguration.class)
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http,
                                                   KeycloakAuthenticationConverter<?> converter) throws Exception {
        return http
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/mail/**").authenticated()
                        .anyRequest().permitAll()
                )
                .oauth2ResourceServer(rs -> rs
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(converter))
                )
                .build();
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/email-app/src/main/java/cn/arorms/email/config/SecurityConfig.java
git commit -m "feat(security): add Keycloak resource server filter chain"
```

---

### Task 7: Delete Local Auth Code from email-app

**Files:**
- Delete:
  - `backend/email-app/src/main/java/cn/arorms/email/web/AuthController.java`
  - `backend/email-app/src/main/java/cn/arorms/email/service/AuthService.java`
  - `backend/email-app/src/main/java/cn/arorms/email/service/AuthLoginResult.java`
  - `backend/email-app/src/main/java/cn/arorms/email/web/SendCodeRequest.java`
  - `backend/email-app/src/main/java/cn/arorms/email/web/error/GlobalExceptionHandler.java`
  - `backend/email-app/src/test/http/auth-flow.http`

**Interfaces:**
- Produces: email-app with only mail endpoints and shared exception handling

- [ ] **Step 1: Delete listed files**

```bash
rm backend/email-app/src/main/java/cn/arorms/email/web/AuthController.java \
   backend/email-app/src/main/java/cn/arorms/email/service/AuthService.java \
   backend/email-app/src/main/java/cn/arorms/email/service/AuthLoginResult.java \
   backend/email-app/src/main/java/cn/arorms/email/web/SendCodeRequest.java \
   backend/email-app/src/main/java/cn/arorms/email/web/error/GlobalExceptionHandler.java \
   backend/email-app/src/test/http/auth-flow.http
```

- [ ] **Step 2: Remove empty package directories if they exist**

```bash
find backend/email-app/src/main/java/cn/arorms/email/web/error -type d -empty -delete
```

- [ ] **Step 3: Commit**

```bash
git add -A backend/email-app/src/main/java backend/email-app/src/test
git commit -m "refactor(email-app): remove local auth controller, service and exception handler"
```

---

### Task 8: Update MailController to Use Keycloak Principal

**Files:**
- Modify: `backend/email-app/src/main/java/cn/arorms/email/web/MailController.java`

**Interfaces:**
- Consumes: `cn.arorms.framework.security.UserPrincipal`
- Produces: `Mail send(UserPrincipal user, SendRequest request)`

- [ ] **Step 1: Update imports and method signature**

```java
package cn.arorms.email.controllers;

import cn.arorms.framework.security.UserPrincipal;
import cn.arorms.email.domain.entity.Mail;
import cn.arorms.email.service.MailService;
import jakarta.mail.MessagingException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/mail")
public class MailController {
    private final MailService mailService;

    public MailController(MailService mailService) {
        this.mailService = mailService;
    }

    public record SendRequest(String to, String subject, String content) {
    }

    @PostMapping("/send")
    public Mail send(@AuthenticationPrincipal UserPrincipal user, @RequestBody SendRequest request) throws MessagingException {
        return mailService.send(user, request.to(), request.subject(), request.content());
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/email-app/src/main/java/cn/arorms/email/web/MailController.java
git commit -m "refactor(mail): use Keycloak UserPrincipal in MailController"
```

---

### Task 9: Update MailService for Keycloak Principal

**Files:**
- Modify: `backend/email-app/src/main/java/cn/arorms/email/service/MailService.java`

**Interfaces:**
- Consumes: `cn.arorms.framework.security.UserPrincipal`, `MailboxRepository.findByOwnerSubjectAndType`
- Produces: `Mail send(UserPrincipal fromUser, String to, String subject, String content)`

- [ ] **Step 1: Update imports, constructor and method**

```java
package cn.arorms.email.service;

import cn.arorms.framework.common.exception.ServiceException;
import cn.arorms.framework.security.UserPrincipal;
import cn.arorms.email.domain.entity.Mail;
import cn.arorms.email.domain.entity.Mailbox;
import cn.arorms.email.domain.enums.MailboxType;
import cn.arorms.email.domain.property.MailProperties;
import cn.arorms.email.domain.repository.MailRepository;
import cn.arorms.email.domain.repository.MailboxRepository;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import jakarta.transaction.Transactional;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Service
public class MailService {

    private final JavaMailSenderImpl mailSender;
    private final MailboxRepository mailboxRepository;
    private final MailRepository mailRepository;
    private final MailProperties mailProps;

    public MailService(JavaMailSenderImpl mailSender,
                       MailboxRepository mailboxRepository,
                       MailRepository mailRepository,
                       MailProperties mailProps) {
        this.mailSender = mailSender;
        this.mailboxRepository = mailboxRepository;
        this.mailRepository = mailRepository;
        this.mailProps = mailProps;
    }

    @Transactional
    public Mail send(UserPrincipal fromUser, String to, String subject, String content) throws MessagingException {
        String fromAddress = fromUser.getEmail();
        if (fromAddress == null || fromAddress.isBlank()) {
            throw new ServiceException("User email is required to send mail");
        }

        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
        helper.setFrom(fromAddress);
        helper.setTo(to);
        helper.setSubject(subject);
        helper.setText(content);
        String messageId = "<" + UUID.randomUUID() + "@arorms.cn>";
        helper.getMimeMessage().setHeader("Message-ID", messageId);
        mailSender.send(message);

        String ownerSubject = fromUser.getId();
        var sentBox = mailboxRepository
                .findByOwnerSubjectAndType(ownerSubject, MailboxType.SENT)
                .orElseGet(() -> {
                    Mailbox box = new Mailbox();
                    box.setOwnerSubject(ownerSubject);
                    box.setType(MailboxType.SENT);
                    box.setName("Sent");
                    return mailboxRepository.save(box);
                });

        Instant now = Instant.now();
        Mail mail = new Mail(sentBox, messageId, fromAddress, subject, now, true, null);
        mail = mailRepository.save(mail);

        return mail;
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/email-app/src/main/java/cn/arorms/email/service/MailService.java
git commit -m "refactor(mail): adapt MailService to Keycloak UserPrincipal and subject ownership"
```

---

### Task 10: Update Application Configuration

**Files:**
- Modify: `backend/email-app/src/main/resources/application.yml`
- Create: `backend/email-app/src/test/resources/application.yml`

**Interfaces:**
- Produces: runtime config for Keycloak resource server; test config excludes security auto-config

- [ ] **Step 1: Replace `application.yml`**

```yaml
spring:
  application:
    name: EmailServer
  datasource:
    url: jdbc:postgresql://${DB_HOST:localhost}:5432/email_db
    username: ${DB_USERNAME:postgres}
    password: ${DB_PASSWORD}
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: true
    properties:
      hibernate:
        format_sql: true
  mail:
    host: 127.0.0.1
    port: 25
    username: ""
    password: ""
    protocol: smtp
    default-encoding: UTF-8
    properties:
      mail:
        smtp:
          auth: false
          starttls:
            enable: false
          connectiontimeout: 10s
          timeout: 30s
          writetimeout: 30s
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: ${JWT_ISSUER:https://auth.arorms.cn/realms/arorms}

server:
  port: 8081

application:
  domain: arorms.cn
  security:
    jwt:
      audience: ${JWT_AUD:email-backend}
  cors:
    allowed-origins: https://mail.arorms.cn
  mail:
    domain: ${MAIL_DOMAIN:arorms.cn}
    default-from: ${MAIL_DEFAULT_FROM:noreply}

logging:
  file:
    name: spring-dev.log
```

- [ ] **Step 2: Create test `application.yml`**

```properties
spring.datasource.url=jdbc:postgresql://${DB_HOST:localhost}:5432/email_db_test
spring.datasource.username=${DB_USERNAME:postgres}
spring.datasource.password=${DB_PASSWORD}

spring.jpa.hibernate.ddl-auto=create-drop

spring.mail.host=127.0.0.1
spring.mail.port=25
spring.mail.username=
spring.mail.password=

spring.security.oauth2.resourceserver.jwt.issuer-uri=http://localhost:8080/realms/test
application.security.jwt.audience=test-audience

spring.autoconfigure.exclude=cn.arorms.framework.security.SecurityAutoConfiguration
```

- [ ] **Step 3: Commit**

```bash
git add backend/email-app/src/main/resources/application.yml \
        backend/email-app/src/test/resources/application.yml
git commit -m "config(email-app): switch to Keycloak issuer/audience, remove JWT/Redis/verification props"
```

---

### Task 11: Full Build Verification

**Files:**
- All modules

**Interfaces:**
- Produces: passing `mvn clean verify`

- [ ] **Step 1: Clean compile**

```bash
mvn -q -f backend/pom.xml clean compile
```

Expected: `BUILD SUCCESS`

- [ ] **Step 2: Run tests**

```bash
mvn -q -f backend/pom.xml test
```

Expected: `BUILD SUCCESS` (context-load test runs with security auto-config excluded)

- [ ] **Step 3: Package**

```bash
mvn -q -f backend/pom.xml package -DskipTests
```

Expected: `BUILD SUCCESS` and `backend/email-app/target/email-app-0.0.1-SNAPSHOT.jar` exists

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "build: verify full Maven build after Keycloak/arorms migration"
```

---

### Task 11: Refactor Package Paths to cn.arorms.email

**Files:**
- Modify: `backend/pom.xml`
- Modify: `backend/email-common/pom.xml`
- Modify: `backend/email-app/pom.xml`
- Move/rename: all Java source files under `cn/arorms/infra/email` → `cn/arorms/email`

**Interfaces:**
- Produces: groupId `cn.arorms.email`; Java packages `cn.arorms.email.*`

- [ ] **Step 1: Update groupIds in POMs**

Replace `cn.arorms.core` with `cn.arorms.email` in:
- `backend/pom.xml`
- `backend/email-common/pom.xml`
- `backend/email-app/pom.xml` (parent and email-common dependency)

- [ ] **Step 2: Move Java source directories**

```bash
mv backend/email-common/src/main/java/cn/arorms/infra/email backend/email-common/src/main/java/cn/arorms/email
mv backend/email-app/src/main/java/cn/arorms/infra/email backend/email-app/src/main/java/cn/arorms/email
mv backend/email-app/src/test/java/cn/arorms/infra/email backend/email-app/src/test/java/cn/arorms/email
```

- [ ] **Step 3: Update package declarations and imports**

Replace `cn.arorms.infra.email` with `cn.arorms.email` in all `.java` files. Ensure `EmailServerApplication` scan base packages use `cn.arorms.email`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: migrate groupId and packages to cn.arorms.email"
```

---

## Self-Review Checklist

After writing, verify:

- [ ] **Spec coverage:**
  - Switch to Keycloak → Task 6 + Task 10
  - Delete `email-security` → Task 1
  - Delete `email-redis` → Task 1
  - Introduce `arorms-common` → Task 2
  - Introduce `arorms-security` → Task 5 + Task 6
  - Remove local User table → Task 3
  - Mailbox keyed by KC subject → Task 3 + Task 9
  - No local login/register endpoints → Task 7
  - Mail operations require auth → Task 6
  - Use `BaseExceptionHandler` plain-string errors → Task 3 + Task 7
  - No roles distinction → Task 6
  - Refactor packages/groupId to `cn.arorms.email` → Task 11
- [ ] **Placeholder scan:** No "TBD", "TODO", "implement later", or vague "add error handling" steps.
- [ ] **Type consistency:** `UserPrincipal`, `ownerSubject`, `findByOwnerSubjectAndType` are used consistently across Task 3, Task 8, Task 9.
- [ ] **Build order:** Tasks are ordered so that `email-common` compiles before `email-app` code changes reference new types.
- [ ] **Renumber note:** Task 4 was merged into Task 3 during self-review; task numbers 5-11 follow sequentially.
