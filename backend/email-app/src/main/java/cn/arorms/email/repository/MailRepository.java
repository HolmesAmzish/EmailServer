package cn.arorms.email.repository;

import cn.arorms.email.domain.entity.Mail;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MailRepository extends JpaRepository<Mail, Long> {
    Page<Mail> findByMailboxIdAndMailboxUserId(Long mailboxId, String userId, Pageable pageable);

    Optional<Mail> findByIdAndMailboxUserId(Long id, String userId);
}
