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
            MailboxType.TRASH, "Trash"
    );

    private final MailboxRepository mailboxRepository;
    private final MailRepository mailRepository;

    public MailboxService(MailboxRepository mailboxRepository, MailRepository mailRepository) {
        this.mailboxRepository = mailboxRepository;
        this.mailRepository = mailRepository;
    }

    /**
     * Ensures the user has the default set of mailboxes (INBOX, SENT, DRAFT, TRASH).
     * Called lazily whenever the mailbox list is loaded.
     */
    @Transactional
    public void ensureDefaultMailboxes(UserPrincipal user) {
        Arrays.stream(MailboxType.values())
                .filter(type -> type != MailboxType.CUSTOM)
                .forEach(type -> mailboxRepository
                        .findByUserIdAndType(user.getId(), type)
                        .orElseGet(() -> {
                            Mailbox box = new Mailbox();
                            box.setUserId(user.getId());
                            box.setUsername(user.getUsername());
                            box.setType(type);
                            box.setName(DEFAULT_NAMES.get(type));
                            return mailboxRepository.save(box);
                        }));
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
        Mailbox box = new Mailbox();
        box.setUserId(user.getId());
        box.setUsername(user.getUsername());
        box.setType(MailboxType.CUSTOM);
        box.setName(request.mailboxName());
        box.setLabel(request.label());
        mailboxRepository.save(box);
    }

    @Transactional
    public void upsert(UserPrincipal user, Long id, MailboxUpsertRequest request) {
        Mailbox box = mailboxRepository.findById(id)
                .filter(b -> b.getUserId().equals(user.getId()))
                .orElseThrow(() -> new ServiceException("Mailbox not found: " + id));
        box.setName(request.mailboxName());
        box.setLabel(request.label());
        mailboxRepository.save(box);
    }

    @Transactional
    public void deleteById(UserPrincipal user, Long id) {
        Mailbox box = mailboxRepository.findById(id)
                .filter(b -> b.getUserId().equals(user.getId()))
                .orElseThrow(() -> new ServiceException("Mailbox not found: " + id));
        if (box.getType() != MailboxType.CUSTOM) {
            throw new ServiceException("Cannot delete system mailbox: " + box.getName());
        }
        mailRepository.deleteByMailboxId(box.getId());
        mailboxRepository.delete(box);
    }
}
