package cn.arorms.email.app.service;

import cn.arorms.email.app.entity.Mail;
import cn.arorms.email.app.entity.MailRecipient;
import cn.arorms.email.app.entity.Mailbox;
import cn.arorms.email.app.property.MailProperties;
import cn.arorms.email.app.repository.AttachmentRepository;
import cn.arorms.email.app.repository.MailRecipientRepository;
import cn.arorms.email.common.enums.DeliveryStatus;
import cn.arorms.email.common.requests.MailDraftUpsertRequest;
import cn.arorms.email.common.responses.MailDetailVo;
import cn.arorms.email.common.responses.MailSummaryVo;
import cn.arorms.framework.common.domain.PageResponse;
import cn.arorms.framework.common.exception.ServiceException;
import cn.arorms.framework.security.UserPrincipal;
import cn.arorms.email.common.enums.MailboxType;
import cn.arorms.email.app.repository.MailRepository;
import cn.arorms.email.app.repository.MailboxRepository;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import jakarta.transaction.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.nio.file.Path;
import java.io.IOException;
import java.util.List;
import java.util.UUID;

@Service
public class MailService {

    private final JavaMailSenderImpl mailSender;
    private final MailboxRepository mailboxRepository;
    private final MailRepository mailRepository;
    private final MailRecipientRepository mailRecipientRepository;
    private final AttachmentRepository attachmentRepository;
    private final MailboxService mailboxService;
    private final MailProperties mailProps;
    private final MaildirFileManager maildirFileManager;

    public MailService(JavaMailSenderImpl mailSender,
                       MailboxRepository mailboxRepository,
                       MailRepository mailRepository,
                       MailRecipientRepository mailRecipientRepository,
                       AttachmentRepository attachmentRepository,
                       MailboxService mailboxService,
                       MailProperties mailProps,
                       MaildirFileManager maildirFileManager) {
        this.mailSender = mailSender;
        this.mailboxRepository = mailboxRepository;
        this.mailRepository = mailRepository;
        this.mailRecipientRepository = mailRecipientRepository;
        this.attachmentRepository = attachmentRepository;
        this.mailboxService = mailboxService;
        this.mailProps = mailProps;
        this.maildirFileManager = maildirFileManager;
    }

    /**
     * @param fromUser authenticated Keycloak principal
     * @param to       email address
     * @param subject
     * @param content
     * @return persisted sent Mail
     * @throws MessagingException
     */
    @Transactional
    public Mail send(UserPrincipal fromUser, String to, String subject, String content) throws MessagingException {
//        String fromAddress = fromUser.getEmail();
        String fromAddress = fromUser.getUsername() + "@arorms.cn";
        if (fromAddress == null || fromAddress.isBlank()) {
            throw new ServiceException("User email is required to send mail");
        }

        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
        helper.setFrom(fromAddress);
        helper.setTo(to);
        helper.setSubject(subject);
        helper.setText(content);
        String messageId = "<" + UUID.randomUUID() + "@arorms.cn>";
        helper.getMimeMessage().setHeader("Message-ID", messageId);
        mailSender.send(message);

        String userId = fromUser.getId();
        var sentBox = mailboxRepository
                .findByUserIdAndType(userId, MailboxType.SENT)
                .orElseThrow(() -> new ServiceException("SENT mailbox not found for user: " + userId));

        Instant now = Instant.now();
        Mail mail = new Mail(sentBox, messageId, fromAddress, subject, now, true, null);
        mail.setUserId(userId);
        mail = mailRepository.save(mail);

        return mail;
    }

    /**
     * Map a mail to its detail view (attachments are not loaded here; empty list).
     */
    public MailDetailVo toDetailVo(Mail mail) {
        return new MailDetailVo(
                mail.getId(),
                mail.getMailbox().getType(),
                mail.getFromAddress(),
                mail.getReplyTo(),
                mail.getSubject(),
                mail.getSentAt(),
                mail.getReceivedAt(),
                mail.getDeliveredTo(),
                mail.isSeen(),
                mail.isStarred(),
                mail.isDeleted(),
                mail.getTextContent(),
                mail.getHtmlContent(),
                mail.getRawPath(),
                List.of()
        );
    }

    /**
     * Get all mails of the user across mailboxes, as summary views.
     */
    public PageResponse<MailSummaryVo> getAll(UserPrincipal user, Pageable pageable) {
        Page<Mail> page = mailRepository.findByUserIdAndIsDeletedFalse(user.getId(), pageable);
        return PageResponse.fromPage(page.map(mail -> new MailSummaryVo(
                mail.getId(),
                mail.getMailbox().getType(),
                mail.getFromAddress(),
                mail.getReplyTo(),
                mail.getDeliveredTo(),
                mail.getSubject(),
                mail.getSentAt(),
                mail.getReceivedAt(),
                mail.isSeen(),
                mail.isStarred(),
                mail.isDeleted(),
                mail.getTextContent()
        )));
    }

    /**
     * Get all soft-deleted mails of the user, as summary views.
     */
    public PageResponse<MailSummaryVo> getDeleted(UserPrincipal user, Pageable pageable) {
        Page<Mail> page = mailRepository.findByUserIdAndIsDeletedTrue(user.getId(), pageable);
        return PageResponse.fromPage(page.map(mail -> new MailSummaryVo(
                mail.getId(),
                mail.getMailbox().getType(),
                mail.getFromAddress(),
                mail.getReplyTo(),
                mail.getDeliveredTo(),
                mail.getSubject(),
                mail.getSentAt(),
                mail.getReceivedAt(),
                mail.isSeen(),
                mail.isStarred(),
                mail.isDeleted(),
                mail.getTextContent()
        )));
    }

    /**
     * Get mails of a specific mailbox. Verifies the mailbox belongs to the user.
     */
    public Page<Mail> getByMailbox(UserPrincipal user, Long mailboxId, Pageable pageable) {
        Mailbox mailbox = mailboxRepository.findById(mailboxId)
                .filter(b -> b.getUserId().equals(user.getId()))
                .orElseThrow(() -> new ServiceException("Mailbox not found: " + mailboxId));
        return mailRepository.findByMailboxIdAndUserIdAndIsDeletedFalse(mailbox.getId(), user.getId(), pageable);
    }

    /**
     * Save a new draft into the user's DRAFT mailbox.
     */
    @Transactional
    public Mail createDraft(UserPrincipal user, MailDraftUpsertRequest request) {
        Mailbox draftBox = mailboxRepository
                .findByUserIdAndType(user.getId(), MailboxType.DRAFT)
                .orElseGet(() -> {
                    mailboxService.ensureDefaultMailboxes(user);
                    return mailboxRepository
                            .findByUserIdAndType(user.getId(), MailboxType.DRAFT)
                            .orElseThrow(() -> new ServiceException("DRAFT mailbox not found for user: " + user.getId()));
                });

        Mail mail = new Mail();
        mail.setMailbox(draftBox);
        mail.setUserId(user.getId());
        mail.setFromAddress(user.getUsername() + "@" + mailProps.getDomain());
        mail.setSubject(request.subject());
        mail.setTextContent(request.content());
        mail.setSeen(true);
        mail = mailRepository.save(mail);

        saveRecipient(mail, request.to());
        return mail;
    }

    /**
     * Update an existing draft (subject, content, recipient).
     */
    @Transactional
    public Mail updateDraft(UserPrincipal user, Long id, MailDraftUpsertRequest request) {
        Mail mail = mailRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ServiceException("Mail not found: " + id));
        if (mail.getMailbox().getType() != MailboxType.DRAFT) {
            throw new ServiceException("Not a draft: " + id);
        }

        mail.setSubject(request.subject());
        mail.setTextContent(request.content());
        mail = mailRepository.save(mail);

        mailRecipientRepository.deleteByMailId(mail.getId());
        saveRecipient(mail, request.to());
        return mail;
    }

    /**
     * Soft delete or restore a mail. The mail stays in its current mailbox,
     * so restoring only clears the flag and the mail is back in place.
     */
    @Transactional
    public void setDeleted(UserPrincipal user, Long id, boolean deleted) {
        Mail mail = mailRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ServiceException("Mail not found: " + id));
        mail.setDeleted(deleted);
        mailRepository.save(mail);
    }

    /**
     * Permanently delete a mail from the recycle bin and remove all associated data.
     */
    @Transactional
    public void permanentlyDelete(UserPrincipal user, Long id) {
        Mail mail = mailRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ServiceException("Mail not found: " + id));
        if (!mail.isDeleted()) {
            throw new ServiceException("Mail must be moved to Deleted before permanent deletion: " + id);
        }

        attachmentRepository.deleteByMailId(mail.getId());
        mailRecipientRepository.deleteByMailId(mail.getId());
        mailRepository.delete(mail);

        if (mail.getRawPath() != null && !mail.getRawPath().isBlank()) {
            try {
                maildirFileManager.delete(Path.of(mail.getRawPath()));
            } catch (IOException e) {
                throw new ServiceException("Failed to delete mail file: " + mail.getRawPath());
            }
        }
    }

    /**
     * Mark a mail as read or unread. Verifies the mail belongs to the user.
     */
    @Transactional
    public void setRead(UserPrincipal user, Long id, boolean seen) {
        Mail mail = mailRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ServiceException("Mail not found: " + id));
        mail.setSeen(seen);
        mailRepository.save(mail);
    }

    /**
     * Star or unstar a mail. Verifies the mail belongs to the user.
     */
    @Transactional
    public void setStarred(UserPrincipal user, Long id, boolean starred) {
        Mail mail = mailRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ServiceException("Mail not found: " + id));
        mail.setStarred(starred);
        mailRepository.save(mail);
    }

    /**
     * Archive a mail by moving it to the user's default ARCHIVE mailbox,
     * or restore it by moving it back to INBOX. Verifies the mail belongs to the user.
     */
    @Transactional
    public void setArchived(UserPrincipal user, Long id, boolean archived) {
        Mail mail = mailRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ServiceException("Mail not found: " + id));
        MailboxType targetType = archived ? MailboxType.ARCHIVE : MailboxType.INBOX;
        Mailbox target = mailboxRepository
                .findByUserIdAndTypeAndLabelIsNull(user.getId(), targetType)
                .orElseThrow(() -> new ServiceException(targetType + " mailbox not found for user: " + user.getId()));
        mail.setMailbox(target);
        mailRepository.save(mail);
    }

    /**
     * Move a mail into one of the user's archive folders (default or labeled ARCHIVE mailbox).
     */
    @Transactional
    public void moveToArchiveFolder(UserPrincipal user, Long id, Long mailboxId) {
        Mail mail = mailRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ServiceException("Mail not found: " + id));
        Mailbox target = mailboxRepository.findById(mailboxId)
                .filter(b -> b.getUserId().equals(user.getId()))
                .filter(b -> b.getType() == MailboxType.ARCHIVE)
                .orElseThrow(() -> new ServiceException("Archive mailbox not found: " + mailboxId));
        mail.setMailbox(target);
        mailRepository.save(mail);
    }

    private void saveRecipient(Mail mail, String to) {
        if (to == null || to.isBlank()) {
            return;
        }
        MailRecipient recipient = new MailRecipient();
        recipient.setMail(mail);
        recipient.setRecipient(to);
        recipient.setStatus(DeliveryStatus.PENDING);
        mailRecipientRepository.save(recipient);
    }
}
