package cn.arorms.email.app.repository;

import cn.arorms.email.app.entity.Mailbox;
import cn.arorms.email.common.enums.MailboxType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MailboxRepository extends JpaRepository<Mailbox, Long> {
    Optional<Mailbox> findByUserIdAndType(String userId, MailboxType mailboxType);

    Optional<Mailbox> findByUserIdAndName(String userId, String name);

    List<Mailbox> findByUserId(String userId);

    Optional<Mailbox> findByUsernameAndLabel(String username, String label);

    Optional<Mailbox> findByUsernameAndType(String username, MailboxType mailboxType);
}
