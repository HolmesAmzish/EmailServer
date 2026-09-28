package cn.arorms.email.app.service;

import cn.arorms.email.app.entity.Mailbox;
import cn.arorms.email.app.repository.MailRepository;
import cn.arorms.email.app.repository.MailboxRepository;
import cn.arorms.email.common.enums.MailboxType;
import cn.arorms.email.common.requests.MailboxUpsertRequest;
import cn.arorms.email.common.responses.MailboxVo;
import cn.arorms.framework.common.exception.ServiceException;
import cn.arorms.framework.security.UserPrincipal;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * Manages mailboxes for authenticated users.
 */
@Service
public class MailboxService {

    private static final Map<MailboxType, String> DEFAULT_NAMES = Map.of(
            MailboxType.INBOX, "Inbox",
            MailboxType.SENT, "Sent",
            MailboxType.DRAFT, "Drafts",
            MailboxType.TRASH, "Trash",
            MailboxType.ARCHIVE, "Archive"
    );

    private final MailboxRepository mailboxRepository;
    private final MailRepository mailRepository;

    public MailboxService(MailboxRepository mailboxRepository, MailRepository mailRepository) {
        this.mailboxRepository = mailboxRepository;
        this.mailRepository = mailRepository;
    }

    /**
     * Creates the default set of mailboxes (INBOX, SENT, DRAFT, TRASH, ARCHIVE)
     * when the user has no mailboxes yet. Called lazily whenever the mailbox list is loaded.
     */
    @Transactional
    public void ensureDefaultMailboxes(UserPrincipal user) {
        if (!mailboxRepository.findByUserId(user.getId()).isEmpty()) {
            return;
        }
        Arrays.stream(MailboxType.values()).forEach(type -> {
            Mailbox box = new Mailbox();
            box.setUserId(user.getId());
            box.setUsername(user.getUsername());
            box.setType(type);
            box.setName(DEFAULT_NAMES.get(type));
            mailboxRepository.save(box);
        });
    }

    /**
     * Get all user's mailboxes
     * @param user UserPrincipal
     * @return mailboxes
     */
    public List<MailboxVo> getMailboxes(UserPrincipal user) {
        ensureDefaultMailboxes(user);
        return mailboxRepository.findByUserId(user.getId()).stream()
                .map(box -> new MailboxVo(
                        box.getId(),
                        box.getLabel(),
                        box.getName(),
                        box.getType(),
                        box.getCreatedAt(),
                        box.getUpdatedAt()
                )).toList();
    }

    @Transactional
    public void upsert(UserPrincipal user, MailboxUpsertRequest request) {
        if (request.label() == null || request.label().isBlank()) {
            throw new ServiceException("A label is required for a custom archive folder");
        }
        Mailbox box = new Mailbox();
        box.setUserId(user.getId());
        box.setUsername(user.getUsername());
        box.setType(MailboxType.ARCHIVE);
        box.setName(request.mailboxName());
        box.setLabel(request.label());
        mailboxRepository.save(box);
    }

    @Transactional
    public void upsert(UserPrincipal user, Long id, MailboxUpsertRequest request) {
        Mailbox box = mailboxRepository.findById(id)
                .filter(b -> b.getUserId().equals(user.getId()))
                .orElseThrow(() -> new ServiceException("Mailbox not found: " + id));
        // System mailboxes and the default ARCHIVE box (label null) cannot be modified.
        if (box.getLabel() == null || box.getLabel().isBlank()) {
            throw new ServiceException("Cannot modify system mailbox: " + box.getName());
        }
        box.setName(request.mailboxName());
        box.setLabel(request.label());
        mailboxRepository.save(box);
    }

    @Transactional
    public void deleteById(UserPrincipal user, Long id) {
        Mailbox box = mailboxRepository.findById(id)
                .filter(b -> b.getUserId().equals(user.getId()))
                .orElseThrow(() -> new ServiceException("Mailbox not found: " + id));
        // Labeled ARCHIVE boxes (former custom folders) may be deleted; system boxes may not.
        boolean isSystem = box.getType() != MailboxType.ARCHIVE
                || box.getLabel() == null
                || box.getLabel().isBlank();
        if (isSystem) {
            throw new ServiceException("Cannot delete system mailbox: " + box.getName());
        }
        mailRepository.deleteByMailboxId(box.getId());
        mailboxRepository.delete(box);
    }
}
