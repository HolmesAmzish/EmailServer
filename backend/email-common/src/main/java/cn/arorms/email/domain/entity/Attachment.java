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

/**
 * Attachment metadata for received mails.
 * Actual file content is not stored yet; this entity reserves fields for future MINIO integration.
 */
@Getter
@Setter
@Entity
@Table(name = "attachments")
public class Attachment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "mail_id", nullable = false)
    private Mail mail;

    @Column(length = 255)
    private String filename;

    @Column(length = 128)
    private String contentType;

    private Long size;

    @Column(length = 64)
    private String checksum;

    @Column(name = "storage_key", length = 512)
    private String storageKey;
}
