package cn.arorms.email.common.responses;

import cn.arorms.email.common.enums.MailboxType;

import java.time.Instant;

public record MailSummaryVo (
        Long id,
        MailboxType mailboxType,
        String fromAddress,
        String replyTo,
        String deliveredTo,
        String subject,
        Instant sentAt,
        Instant receivedAt,
        boolean seen,
        boolean isStarred,
        boolean isDeleted,
        String textContent
) {}