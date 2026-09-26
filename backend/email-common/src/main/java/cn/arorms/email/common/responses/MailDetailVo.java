package cn.arorms.email.common.responses;

import java.time.Instant;
import java.util.List;

public record MailDetailVo (
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
    List<AttachmentVo> attachments
) {
}