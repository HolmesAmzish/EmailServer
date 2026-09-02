package cn.arorms.email.dto;

/**
 * Summary of a mailbox.
 */
public record MailboxDto(
    Long id,
    String name,
    String type
) {
}
