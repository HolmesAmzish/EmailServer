package cn.arorms.email.common.requests;

public record MailDraftUpsertRequest(
        String to,
        String subject,
        String content
) {
}
