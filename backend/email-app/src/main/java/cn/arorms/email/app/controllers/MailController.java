package cn.arorms.email.app.controllers;

import cn.arorms.email.app.entity.Mail;
import cn.arorms.email.app.repository.AttachmentRepository;
import cn.arorms.email.app.repository.MailRepository;
import cn.arorms.email.app.repository.MailboxRepository;
import cn.arorms.email.app.service.MailService;
import cn.arorms.email.common.requests.MailDraftUpsertRequest;
import cn.arorms.email.common.responses.AttachmentVo;
import cn.arorms.email.common.responses.MailDetailVo;
import cn.arorms.email.common.responses.MailSummaryVo;
import cn.arorms.framework.common.domain.PageResponse;
import cn.arorms.framework.common.exception.ServiceException;
import cn.arorms.framework.security.UserPrincipal;
import jakarta.mail.MessagingException;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/mail")
public class MailController {

    private final MailService mailService;
    private final MailboxRepository mailboxRepository;
    private final MailRepository mailRepository;
    private final AttachmentRepository attachmentRepository;

    public MailController(MailService mailService,
                          MailboxRepository mailboxRepository,
                          MailRepository mailRepository,
                          AttachmentRepository attachmentRepository) {
        this.mailService = mailService;
        this.mailboxRepository = mailboxRepository;
        this.mailRepository = mailRepository;
        this.attachmentRepository = attachmentRepository;
    }

    public record SendRequest(String to, String subject, String content) {}

    /**
     * Get all mail summary page
     */
    @GetMapping
    public ResponseEntity<PageResponse<MailSummaryVo>> getAllMail(
            @AuthenticationPrincipal UserPrincipal user, Pageable pageable
    ) {
        return ResponseEntity.ok(mailService.getAll(user, pageable));
    }

    /**
     * Create a draft
     * @param user
     */
    @PostMapping("/draft")
    public Mail createDraft(@AuthenticationPrincipal UserPrincipal user, @RequestBody MailDraftUpsertRequest request) {
        return mailService.createDraft(user, request);
    }

    /**
     * Update draft
     */
    @PutMapping("/{id}")
    public Mail updateDraft(@AuthenticationPrincipal UserPrincipal user, @PathVariable Long id, @RequestBody MailDraftUpsertRequest request) {
        return mailService.updateDraft(user, id, request);
    }

    /**
     * Send email
     * @param user
     * @param request
     * @return
     * @throws MessagingException
     */
    @PostMapping("/send")
    public Mail send(@AuthenticationPrincipal UserPrincipal user, @RequestBody SendRequest request) throws MessagingException {
        return mailService.send(user, request.to(), request.subject(), request.content());
    }

    /**
     * Get a mail detail by id
     * @param user
     * @param id
     * @return
     */
    @GetMapping("/{id}")
    public MailDetailVo getMail(@AuthenticationPrincipal UserPrincipal user, @PathVariable Long id) {
        Mail mail = mailRepository.findByIdAndMailboxUserId(id, user.getId())
            .orElseThrow(() -> new ServiceException("Mail not found: " + id));

        List<AttachmentVo> attachments = attachmentRepository.findByMailId(mail.getId()).stream()
            .map(a -> new AttachmentVo(a.getId(), a.getFilename(), a.getContentType(), a.getSize()))
            .toList();

        return new MailDetailVo(
            mail.getId(),
            mail.getFromAddress(),
            mail.getReplyTo(),
            mail.getSubject(),
            mail.getSentAt(),
            mail.getReceivedAt(),
            mail.getDeliveredTo(),
            mail.isSeen(),
            mail.getTextContent(),
            mail.getHtmlContent(),
            mail.getRawPath(),
            attachments
        );
    }

    /**
     * Update status of a mail(read)
     * @param user
     * @param id
     */
    @PatchMapping("/{id}")
    public void markRead(@AuthenticationPrincipal UserPrincipal user, @PathVariable Long id) {
        Mail mail = mailRepository.findByIdAndMailboxUserId(id, user.getId())
            .orElseThrow(() -> new ServiceException("Mail not found: " + id));
        mail.setSeen(true);
        mailRepository.save(mail);
    }

    /**
     * Delete mail by id
     */
    @DeleteMapping("/{id}")
    public void deleteMail(@AuthenticationPrincipal UserPrincipal user, @PathVariable Long id) {
        mailService.delete(user, id);
    }
}
