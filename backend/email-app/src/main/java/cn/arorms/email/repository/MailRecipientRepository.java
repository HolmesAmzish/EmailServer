package cn.arorms.email.repository;

import cn.arorms.email.domain.entity.MailRecipient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface MailRecipientRepository extends JpaRepository<MailRecipient, Long> {
    Optional<MailRecipient> findByMail_MessageIdAndRecipient(String messageId, String recipient);
}
