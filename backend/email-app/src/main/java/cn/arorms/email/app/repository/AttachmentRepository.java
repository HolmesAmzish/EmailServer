package cn.arorms.email.app.repository;

import cn.arorms.email.app.entity.Attachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AttachmentRepository extends JpaRepository<Attachment, Long> {
    List<Attachment> findByMailId(Long mailId);

    void deleteByMailId(Long mailId);
}
