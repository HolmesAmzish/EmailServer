package cn.arorms.email.common.responses;

import cn.arorms.email.common.enums.MailboxType;

import java.time.Instant;

public record MailboxVo (
    String username,
    String label,
    String name,
    MailboxType type,
    Instant createdAt
) {
}
