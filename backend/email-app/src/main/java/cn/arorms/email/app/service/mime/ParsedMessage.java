package cn.arorms.email.app.service.mime;

import java.time.Instant;
import java.util.List;

/**
 * Result of parsing an incoming MIME message.
 */
public record ParsedMessage(
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
    String originalMessageId,
    String failedRecipient,
    String bounceReason
) {
}
