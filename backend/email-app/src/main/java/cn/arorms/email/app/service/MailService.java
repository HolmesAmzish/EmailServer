package cn.arorms.email.app.service;

import cn.arorms.email.app.entity.Mail;
import cn.arorms.email.app.entity.MailRecipient;
import cn.arorms.email.app.entity.Mailbox;
import cn.arorms.email.app.property.MailProperties;
import cn.arorms.email.app.repository.AttachmentRepository;
import cn.arorms.email.app.repository.MailRecipientRepository;
import cn.arorms.email.common.enums.DeliveryStatus;
import cn.arorms.email.common.requests.MailDraftUpsertRequest;
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

    public MailService(JavaMailSenderImpl mailSender,
                       MailboxRepository mailboxRepository,
                       MailRepository mailRepository,
                       MailRecipientRepository mailRecipientRepository,
                       AttachmentRepository attachmentRepository,
                       MailboxService mailboxService,
                       MailProperties mailProps) {
        this.mailSender = mailSender;
        this.mailboxRepository = mailboxRepository;
        this.mailRepository = mailRepository;
        this.mailRecipientRepository = mailRecipientRepository;
        this.attachmentRepository = attachmentRepository;
        this.mailboxService = mailboxService;
        this.mailProps = mailProps;
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
        mail = mailRepository.save(mail);

        return mail;
    }

    /**
     * Get all mails of the user across mailboxes, as summary views.
     */
    public PageResponse<MailSummaryVo> getAll(UserPrincipal user, Pageable pageable) {
        Page<Mail> page = mailRepository.findByMailboxUserId(user.getId(), pageable);
        return PageResponse.fromPage(page.map(mail -> new MailSummaryVo(
                mail.getId(),
                mail.getFromAddress(),
                mail.getReplyTo(),
                mail.getDeliveredTo(),
                mail.getSubject(),
                mail.getSentAt(),
                mail.getReceivedAt(),
                mail.isSeen(),
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
        return mailRepository.findByMailboxIdAndMailboxUserId(mailbox.getId(), user.getId(), pageable);
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
        Mail mail = mailRepository.findByIdAndMailboxUserId(id, user.getId())
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
     * Delete a mail: moves it to TRASH, or permanently deletes it if already in TRASH.
     */
    @Transactional
    public void delete(UserPrincipal user, Long id) {
        Mail mail = mailRepository.findByIdAndMailboxUserId(id, user.getId())
                .orElseThrow(() -> new ServiceException("Mail not found: " + id));

        if (mail.getMailbox().getType() != MailboxType.TRASH) {
            Mailbox trashBox = mailboxRepository
                    .findByUserIdAndType(user.getId(), MailboxType.TRASH)
                    .orElseGet(() -> {
                        mailboxService.ensureDefaultMailboxes(user);
                        return mailboxRepository
                                .findByUserIdAndType(user.getId(), MailboxType.TRASH)
                                .orElseThrow(() -> new ServiceException("TRASH mailbox not found for user: " + user.getId()));
                    });
            mail.setMailbox(trashBox);
            mailRepository.save(mail);
            return;
        }

        attachmentRepository.deleteByMailId(mail.getId());
        mailRecipientRepository.deleteByMailId(mail.getId());
        mailRepository.delete(mail);
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
