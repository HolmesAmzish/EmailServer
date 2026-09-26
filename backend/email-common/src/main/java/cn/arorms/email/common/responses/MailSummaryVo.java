package cn.arorms.email.common.responses;

import java.time.Instant;

public record MailSummaryVo (
        Long id,
        String fromAddress,
        String replyTo,
        String deliveredTo,
        String subject,
        Instant sentAt,
        Instant receivedAt,
        boolean seen,
        String textContent
) {}