package cn.arorms.email.service;

import cn.arorms.email.domain.entity.Attachment;
import cn.arorms.email.domain.entity.Mail;
import cn.arorms.email.domain.entity.Mailbox;
import cn.arorms.email.property.MaildirProperties;
import cn.arorms.email.repository.AttachmentRepository;
import cn.arorms.email.repository.MailRepository;
import cn.arorms.email.service.mime.ParsedAttachment;
import cn.arorms.email.service.mime.ParsedMessage;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;

/**
 * Processes a single mail file from the Maildir new/ directory.
 * Parses MIME, resolves recipients, persists metadata, moves the file to cur/, and handles bounces.
 */
@Component
public class MaildirProcessor {

    private static final Logger log = LoggerFactory.getLogger(MaildirProcessor.class);

    private final MimeParser mimeParser;
    private final MailboxResolver resolver;
    private final MaildirFileManager fileManager;
    private final BounceHandler bounceHandler;
    private final MailRepository mailRepository;
    private final AttachmentRepository attachmentRepository;
    private final MaildirProperties properties;

    public MaildirProcessor(MimeParser mimeParser,
                            MailboxResolver resolver,
                            MaildirFileManager fileManager,
                            BounceHandler bounceHandler,
                            MailRepository mailRepository,
                            AttachmentRepository attachmentRepository,
                            MaildirProperties properties) {
        this.mimeParser = mimeParser;
        this.resolver = resolver;
        this.fileManager = fileManager;
        this.bounceHandler = bounceHandler;
        this.mailRepository = mailRepository;
        this.attachmentRepository = attachmentRepository;
        this.properties = properties;
    }

    @Transactional
    public void process(Path file) {
        ParsedMessage parsed;
        try {
            parsed = mimeParser.parse(file);
        } catch (Exception e) {
            log.error("Failed to parse mail file: {}", file, e);
            moveToDeadLetter(file, "parse failed: " + e.getMessage());
            return;
        }

        try {
            if (parsed.bounce()) {
                bounceHandler.handle(parsed);
            }

            List<String> localRecipients = parsed.recipients();
            if (localRecipients.isEmpty()) {
                log.warn("No local recipients for file: {}", file);
                fileManager.archive(file);
                return;
            }

            Path archived = null;
            for (String recipient : localRecipients) {
                Mailbox mailbox = resolver.resolve(recipient).orElse(null);
                if (mailbox == null) {
                    log.warn("No mailbox found for recipient: {}", recipient);
                    continue;
                }

                if (archived == null) {
                    archived = fileManager.archive(file);
                }

                Mail mail = saveMail(mailbox, parsed, archived);
                saveAttachments(mail, parsed.attachments());
            }
        } catch (Exception e) {
            log.error("Failed to process mail file: {}", file, e);
            moveToDeadLetter(file, "process failed: " + e.getMessage());
        }
    }

    private Mail saveMail(Mailbox mailbox, ParsedMessage parsed, Path archivedFile) {
        Mail mail = new Mail();
        mail.setMailbox(mailbox);
        mail.setMessageId(parsed.messageId());
        mail.setFromAddress(parsed.fromAddress());
        mail.setReplyTo(parsed.replyTo());
        mail.setSubject(parsed.subject());
        mail.setSentAt(parsed.sentAt());
        mail.setReceivedAt(Instant.now());
        mail.setDeliveredTo(parsed.deliveredTo());
        mail.setTextContent(parsed.textContent());
        mail.setHtmlContent(parsed.htmlContent());
        mail.setBounce(parsed.bounce());
        mail.setRawPath(archivedFile.toString());
        mail.setSeen(false);
        return mailRepository.save(mail);
    }

    private void saveAttachments(Mail mail, List<ParsedAttachment> attachments) {
        for (ParsedAttachment a : attachments) {
            Attachment attachment = new Attachment();
            attachment.setMail(mail);
            attachment.setFilename(a.filename());
            attachment.setContentType(a.contentType());
            attachment.setSize(a.size());
            attachment.setChecksum(a.checksum());
            attachmentRepository.save(attachment);
        }
    }

    private void moveToDeadLetter(Path file, String reason) {
        try {
            fileManager.deadLetter(file, reason);
        } catch (IOException ex) {
            log.error("Failed to move file to dead-letter: {}", file, ex);
        }
    }
}
