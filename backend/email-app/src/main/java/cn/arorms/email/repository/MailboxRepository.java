package cn.arorms.email.repository;

import cn.arorms.email.domain.entity.Mailbox;
import cn.arorms.email.domain.enums.MailboxType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MailboxRepository extends JpaRepository<Mailbox, Long> {
    Optional<Mailbox> findByUserIdAndType(String userId, MailboxType mailboxType);
}
