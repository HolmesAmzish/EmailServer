package cn.arorms.email.service;

import cn.arorms.framework.common.exception.ServiceException;
import cn.arorms.framework.security.UserPrincipal;
import cn.arorms.email.common.entity.Mail;
import cn.arorms.email.common.enums.MailboxType;
import cn.arorms.email.common.property.MailProperties;
import cn.arorms.email.repository.MailRepository;
import cn.arorms.email.repository.MailboxRepository;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import jakarta.transaction.Transactional;
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
    private final MailProperties mailProps;

    public MailService(JavaMailSenderImpl mailSender,
                       MailboxRepository mailboxRepository,
                       MailRepository mailRepository,
                       MailProperties mailProps) {
        this.mailSender = mailSender;
        this.mailboxRepository = mailboxRepository;
        this.mailRepository = mailRepository;
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
}
