package cn.arorms.email.common.responses;

import cn.arorms.email.common.enums.MailboxType;

import java.time.Instant;
import java.util.List;

public record MailDetailVo (
    Long id,
    MailboxType mailboxType,
    String fromAddress,
    String replyTo,
    String subject,
    Instant sentAt,
    Instant receivedAt,
    String deliveredTo,
    boolean seen,
    boolean isStarred,
    boolean isDeleted,
    String textContent,
    String htmlContent,
    String rawPath,
    List<AttachmentVo> attachments
) {
}