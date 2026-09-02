package cn.arorms.email.repository;

import cn.arorms.email.domain.entity.Mailbox;
import cn.arorms.email.domain.enums.MailboxType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MailboxRepository extends JpaRepository<Mailbox, Long> {
    Optional<Mailbox> findByUserIdAndType(String userId, MailboxType mailboxType);

    Optional<Mailbox> findByUserIdAndName(String userId, String name);

    List<Mailbox> findByUserId(String userId);
}
