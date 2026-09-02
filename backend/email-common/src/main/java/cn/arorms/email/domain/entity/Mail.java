package cn.arorms.email.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter @Setter
@Entity @Table(name = "mails")
public class Mail {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "mailbox_id", nullable = false)
    private Mailbox mailbox;

    @Column(name = "message_id", length = 255)
    private String messageId;

    @Column(name = "from_address", length = 255)
    private String fromAddress;

    @Column(length = 998)
    private String subject;

    @Column(name = "sent_at")
    private Instant sentAt;

    @Column(nullable = false)
    private boolean seen = false;

    @Column(name = "raw_path", length = 512)
    private String rawPath;

    @Column(name = "received_at")
    private Instant receivedAt;

    @Column(name = "delivered_to", length = 255)
    private String deliveredTo;

    @Column(name = "reply_to", length = 255)
    private String replyTo;

    @Column(name = "text_content", columnDefinition = "TEXT")
    private String textContent;

    @Column(name = "html_content", columnDefinition = "TEXT")
    private String htmlContent;

    @Column(name = "is_bounce")
    private boolean bounce = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public Mail() {
    }

    public Mail(Mailbox mailbox, String messageId, String fromAddress, String subject, Instant sentAt, boolean seen, String rawPath) {
        this.mailbox = mailbox;
        this.messageId = messageId;
        this.fromAddress = fromAddress;
        this.subject = subject;
        this.sentAt = sentAt;
        this.seen = seen;
        this.rawPath = rawPath;
        this.createdAt = Instant.now();
    }
}