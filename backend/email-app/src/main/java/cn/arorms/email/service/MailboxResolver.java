package cn.arorms.email.service;

import cn.arorms.email.common.entity.Mailbox;
import cn.arorms.email.common.enums.MailboxType;
import cn.arorms.email.common.property.MailProperties;
import cn.arorms.email.repository.MailboxRepository;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Resolves a recipient email address to a local mailbox.
 * Supports plus-addressing: user+label@domain falls back to INBOX if no matching label mailbox exists.
 */
@Component
public class MailboxResolver {

    private final MailboxRepository mailboxRepository;
    private final String domain;

    public MailboxResolver(MailboxRepository mailboxRepository, MailProperties mailProperties) {
        this.mailboxRepository = mailboxRepository;
        this.domain = mailProperties.getDomain();
    }

    public Optional<Mailbox> resolve(String recipient) {
        if (recipient == null || !recipient.toLowerCase().endsWith("@" + domain.toLowerCase())) {
            return Optional.empty();
        }

        String localPart = recipient.substring(0, recipient.lastIndexOf('@'));
        String username = localPart;
        String label = null;

        int plusIndex = localPart.indexOf('+');
        if (plusIndex > 0) {
            username = localPart.substring(0, plusIndex);
            label = localPart.substring(plusIndex + 1);
        }

        Optional<Mailbox> inbox = mailboxRepository.findByUserIdAndType(username, MailboxType.INBOX);
        if (inbox.isEmpty()) {
            // User has not registered for the email service; drop the mail.
            return Optional.empty();
        }

        if (label != null && !label.isBlank()) {
            Optional<Mailbox> labeled = mailboxRepository.findByUserIdAndName(username, label);
            if (labeled.isPresent()) {
                return labeled;
            }
        }

        return inbox;
    }
}
