package cn.arorms.email.app.entity;

import cn.arorms.email.common.enums.MailboxType;
import cn.arorms.framework.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter @Setter
@Entity
@Table(
    name = "mailboxes",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_mailboxes_user_type",
        columnNames = {"user_id", "type"}
    )
)
public class Mailbox extends BaseEntity {
    @Column(name = "user_id", nullable = false, length = 36)
    private String userId;

    @Column(nullable = false, length = 128)
    private String name;

    // plus address (username+label@arorms.cn)
    @Column(nullable = false)
    private String username;
    private String label;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private MailboxType type;
}