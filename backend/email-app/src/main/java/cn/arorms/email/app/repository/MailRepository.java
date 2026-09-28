package cn.arorms.email.app.repository;

import cn.arorms.email.app.entity.Mail;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MailRepository extends JpaRepository<Mail, Long> {
    Page<Mail> findByMailboxIdAndUserIdAndIsDeletedFalse(Long mailboxId, String userId, Pageable pageable);

    Page<Mail> findByUserIdAndIsDeletedFalse(String userId, Pageable pageable);

    Page<Mail> findByUserIdAndIsDeletedTrue(String userId, Pageable pageable);

    Optional<Mail> findByIdAndUserId(Long id, String userId);

    void deleteByMailboxId(Long mailboxId);
}