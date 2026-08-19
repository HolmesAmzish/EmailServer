package cn.arorms.email.repository;

import cn.arorms.email.domain.entity.Mail;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MailRepository extends JpaRepository<Mail, Long> {
}
