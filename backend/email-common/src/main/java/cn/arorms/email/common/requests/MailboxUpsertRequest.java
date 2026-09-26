package cn.arorms.email.common.requests;

public record MailboxUpsertRequest(
//        Long id,
        String mailboxName,
        String label
) {}
