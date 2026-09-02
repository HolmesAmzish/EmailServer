package cn.arorms.email.dto;

import java.time.Instant;

/**
 * Summary of a mail for list views.
 */
public record MailSummaryDto(
    Long id,
    String fromAddress,
    String subject,
    Instant sentAt,
    Instant receivedAt,
    boolean seen
) {
}
