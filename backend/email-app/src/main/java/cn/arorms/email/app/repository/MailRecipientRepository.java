package cn.arorms.email.app.repository;

import cn.arorms.email.app.entity.MailRecipient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MailRecipientRepository extends JpaRepository<MailRecipient, Long> {
    Optional<MailRecipient> findByMail_MessageIdAndRecipient(String messageId, String recipient);

    List<MailRecipient> findByMailId(Long mailId);

    void deleteByMailId(Long mailId);
}
