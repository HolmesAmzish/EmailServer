package cn.arorms.email.dto;

import java.time.Instant;
import java.util.List;

/**
 * Detailed mail view including body content and attachments.
 */
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
) {
}
