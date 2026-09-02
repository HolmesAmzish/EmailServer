package cn.arorms.email.service;

import cn.arorms.email.domain.entity.Mailbox;
import cn.arorms.email.domain.enums.MailboxType;
import cn.arorms.email.repository.MailboxRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Map;

/**
 * Manages mailboxes for authenticated users.
 */
@Service
public class MailboxService {

    private static final Map<MailboxType, String> DEFAULT_NAMES = Map.of(
        MailboxType.INBOX, "INBOX",
        MailboxType.SENT, "Sent",
        MailboxType.TRASH, "Trash"
    );

    private final MailboxRepository mailboxRepository;

    public MailboxService(MailboxRepository mailboxRepository) {
        this.mailboxRepository = mailboxRepository;
    }

    /**
     * Ensures the user has the default set of mailboxes (INBOX, SENT, TRASH).
     * Called after a successful Keycloak login.
     */
    @Transactional
    public void ensureDefaultMailboxes(String userId) {
        Arrays.stream(MailboxType.values())
            .filter(type -> type != MailboxType.CUSTOM)
            .forEach(type -> mailboxRepository
                .findByUserIdAndType(userId, type)
                .orElseGet(() -> {
                    Mailbox box = new Mailbox();
                    box.setUserId(userId);
                    box.setType(type);
                    box.setName(DEFAULT_NAMES.get(type));
                    return mailboxRepository.save(box);
                }));
    }
}
