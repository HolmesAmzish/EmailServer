package cn.arorms.email.app.service;

import cn.arorms.email.app.property.MailProperties;
import cn.arorms.email.app.service.mime.ParsedAttachment;
import cn.arorms.email.app.service.mime.ParsedMessage;
import jakarta.mail.Address;
import jakarta.mail.Message;
import jakarta.mail.MessagingException;
import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeBodyPart;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import jakarta.mail.internet.MimeUtility;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.HexFormat;
import java.util.List;
import java.util.Properties;

/**
 * Parses incoming MIME messages into a structured representation.
 */
@Component
public class MimeParser {

    private final String domain;

    public MimeParser(MailProperties mailProperties) {
        this.domain = mailProperties.getDomain();
    }

    public ParsedMessage parse(Path file) throws MessagingException, IOException {
        Session session = Session.getDefaultInstance(new Properties());
        try (InputStream is = Files.newInputStream(file)) {
            MimeMessage message = new MimeMessage(session, is);
            return parse(message);
        }
    }

    private ParsedMessage parse(MimeMessage message) throws MessagingException, IOException {
        String messageId = message.getMessageID();
        String fromAddress = extractAddress(message.getFrom());
        String replyTo = extractAddress(message.getReplyTo());
        String subject = message.getSubject();
        Instant sentAt = extractSentAt(message);
//        String deliveredTo = extractSingleHeader(message, "Delivered-To");
        String deliveredTo = extractSingleHeader(message, "X-Original-To");

        List<String> recipients = extractLocalRecipients(message);

        BodyCollector collector = new BodyCollector();
        List<ParsedAttachment> attachments = new ArrayList<>();
        extractParts(message.getContent(), collector, attachments);

        boolean bounce = detectBounce(message);
        String originalMessageId = bounce ? extractOriginalMessageId(message) : null;
        String bounceReason = bounce ? extractBounceReason(message) : null;
        String failedRecipient = bounce ? extractFailedRecipient(message) : null;

        return new ParsedMessage(
            messageId,
            fromAddress,
            replyTo,
            subject,
            sentAt,
            deliveredTo,
            collector.textContent,
            collector.htmlContent,
            recipients,
            attachments,
            bounce,
            originalMessageId,
            failedRecipient,
            bounceReason
        );
    }

    private String extractAddress(Address[] addresses) {
        if (addresses == null || addresses.length == 0) {
            return null;
        }
        return ((InternetAddress) addresses[0]).getAddress();
    }

    private List<String> extractAddressList(Address[] addresses) {
        List<String> result = new ArrayList<>();
        if (addresses == null) {
            return result;
        }
        for (Address address : addresses) {
            if (address instanceof InternetAddress internetAddress) {
                result.add(internetAddress.getAddress());
            }
        }
        return result;
    }

    private List<String> extractLocalRecipients(MimeMessage message) throws MessagingException {
        List<String> all = new ArrayList<>();
        all.addAll(extractAddressList(message.getRecipients(Message.RecipientType.TO)));
        all.addAll(extractAddressList(message.getRecipients(Message.RecipientType.CC)));
        all.addAll(extractAddressList(message.getRecipients(Message.RecipientType.BCC)));

        String lowerDomain = domain.toLowerCase();
        return all.stream()
            .filter(addr -> addr != null && addr.toLowerCase().endsWith("@" + lowerDomain))
            .distinct()
            .toList();
    }

    private Instant extractSentAt(MimeMessage message) throws MessagingException {
        Date sentDate = message.getSentDate();
        if (sentDate != null) {
            return sentDate.toInstant();
        }
        String dateHeader = extractSingleHeader(message, "Date");
        if (dateHeader != null) {
            try {
                ZonedDateTime zdt = ZonedDateTime.parse(dateHeader);
                return zdt.toInstant();
            } catch (Exception ignored) {
                // Fall back to now if date cannot be parsed.
            }
        }
        return Instant.now();
    }

    private String extractSingleHeader(MimeMessage message, String name) throws MessagingException {
        String[] values = message.getHeader(name);
        if (values == null || values.length == 0) {
            return null;
        }
        return values[0];
    }

    private void extractParts(Object content, BodyCollector collector, List<ParsedAttachment> attachments)
            throws MessagingException, IOException {
        if (content instanceof MimeMultipart multipart) {
            int count = multipart.getCount();
            for (int i = 0; i < count; i++) {
                MimeBodyPart part = (MimeBodyPart) multipart.getBodyPart(i);
                String disposition = part.getDisposition();
                String contentType = part.getContentType();

                if (isAttachment(part)) {
                    attachments.add(extractAttachment(part));
                } else if (contentType != null && contentType.toLowerCase().startsWith("multipart/")) {
                    extractParts(part.getContent(), collector, attachments);
                } else if (contentType != null && contentType.toLowerCase().startsWith("text/plain")) {
                    collector.textContent = part.getContent().toString();
                } else if (contentType != null && contentType.toLowerCase().startsWith("text/html")) {
                    collector.htmlContent = part.getContent().toString();
                }
            }
        } else if (content instanceof String text) {
            // Simple non-multipart message; treat as plain text.
            collector.textContent = text;
        }
    }

    private boolean isAttachment(MimeBodyPart part) throws MessagingException {
        String disposition = part.getDisposition();
        return disposition != null && (disposition.equalsIgnoreCase(MimeBodyPart.ATTACHMENT)
            || disposition.equalsIgnoreCase(MimeBodyPart.INLINE));
    }

    private ParsedAttachment extractAttachment(MimeBodyPart part) throws MessagingException, IOException {
        String filename = part.getFileName();
        if (filename != null) {
            try {
                filename = MimeUtility.decodeText(filename);
            } catch (Exception ignored) {
                // Keep encoded filename if decoding fails.
            }
        }
        if (filename == null || filename.isBlank()) {
            filename = "unnamed";
        }

        String contentType = part.getContentType();
        if (contentType != null && contentType.contains(";")) {
            contentType = contentType.substring(0, contentType.indexOf(';')).trim();
        }

        byte[] data;
        try (InputStream is = part.getInputStream()) {
            data = is.readAllBytes();
        }

        String checksum = sha256Hex(data);
        return new ParsedAttachment(filename, contentType, data.length, checksum);
    }

    private String sha256Hex(byte[] data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(data));
        } catch (NoSuchAlgorithmException e) {
            return null;
        }
    }

    private boolean detectBounce(MimeMessage message) throws MessagingException {
        String[] autoSubmitted = message.getHeader("Auto-Submitted");
        if (autoSubmitted != null && autoSubmitted.length > 0
            && autoSubmitted[0].toLowerCase().contains("auto-replied")) {
            return true;
        }
        String from = extractAddress(message.getFrom());
        if (from != null && from.toLowerCase().contains("mailer-daemon")) {
            return true;
        }
        String contentType = message.getContentType();
        return contentType != null
            && contentType.toLowerCase().contains("multipart/report")
            && contentType.toLowerCase().contains("report-type=delivery-status");
    }

    private String extractOriginalMessageId(MimeMessage message) throws MessagingException, IOException {
        String inReplyTo = extractSingleHeader(message, "In-Reply-To");
        if (inReplyTo != null && !inReplyTo.isBlank()) {
            return stripAngleBrackets(inReplyTo);
        }

        String references = extractSingleHeader(message, "References");
        if (references != null && !references.isBlank()) {
            String[] parts = references.split("\\s+");
            return stripAngleBrackets(parts[0]);
        }

        // Fallback: search embedded message/rfc822 part.
        return findEmbeddedMessageId(message.getContent());
    }

    private String findEmbeddedMessageId(Object content) throws MessagingException, IOException {
        if (content instanceof MimeMultipart multipart) {
            int count = multipart.getCount();
            for (int i = 0; i < count; i++) {
                MimeBodyPart part = (MimeBodyPart) multipart.getBodyPart(i);
                String contentType = part.getContentType();
                if (contentType != null && contentType.toLowerCase().contains("message/rfc822")) {
                    Object nested = part.getContent();
                    if (nested instanceof MimeMessage nestedMessage) {
                        String id = nestedMessage.getMessageID();
                        if (id != null) {
                            return stripAngleBrackets(id);
                        }
                    }
                }
            }
        }
        return null;
    }

    private String extractBounceReason(MimeMessage message) throws MessagingException, IOException {
        String deliveryStatus = extractDeliveryStatus(message);
        if (deliveryStatus != null) {
            return extractDiagnosticCode(deliveryStatus);
        }
        return null;
    }

    private String extractFailedRecipient(MimeMessage message) throws MessagingException, IOException {
        String deliveryStatus = extractDeliveryStatus(message);
        if (deliveryStatus != null) {
            return extractHeaderValue(deliveryStatus, "Final-Recipient:");
        }
        return null;
    }

    private String extractDeliveryStatus(MimeMessage message) throws MessagingException, IOException {
        Object content = message.getContent();
        if (content instanceof MimeMultipart multipart) {
            int count = multipart.getCount();
            for (int i = 0; i < count; i++) {
                MimeBodyPart part = (MimeBodyPart) multipart.getBodyPart(i);
                String contentType = part.getContentType();
                if (contentType != null && contentType.toLowerCase().contains("message/delivery-status")) {
                    Object body = part.getContent();
                    if (body instanceof String text) {
                        return text;
                    }
                }
            }
        }
        return null;
    }

    private String extractHeaderValue(String text, String prefix) {
        return Arrays.stream(text.split("\r?\n"))
            .filter(line -> line.toLowerCase().startsWith(prefix.toLowerCase()))
            .findFirst()
            .map(line -> {
                String value = line.substring(prefix.length()).trim();
                // Final-Recipient: rfc822; holmesamzish86@gmail.com
                if (value.contains(";")) {
                    value = value.substring(value.indexOf(';') + 1).trim();
                }
                return value;
            })
            .orElse(null);
    }

    private String extractDiagnosticCode(String deliveryStatus) {
        return Arrays.stream(deliveryStatus.split("\r?\n"))
            .filter(line -> line.toLowerCase().startsWith("diagnostic-code:"))
            .findFirst()
            .map(line -> line.substring(line.indexOf(':') + 1).trim())
            .orElse(null);
    }

    private String stripAngleBrackets(String value) {
        value = value.trim();
        if (value.startsWith("<") && value.endsWith(">")) {
            return value.substring(1, value.length() - 1);
        }
        return value;
    }

    private static class BodyCollector {
        String textContent;
        String htmlContent;
    }
}
