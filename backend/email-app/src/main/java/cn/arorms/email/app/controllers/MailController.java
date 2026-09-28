package cn.arorms.email.app.controllers;

import cn.arorms.email.app.entity.Mail;
import cn.arorms.email.app.repository.AttachmentRepository;
import cn.arorms.email.app.repository.MailRepository;
import cn.arorms.email.app.service.MailService;
import cn.arorms.email.common.requests.MailArchiveRequest;
import cn.arorms.email.common.requests.MailDeleteRequest;
import cn.arorms.email.common.requests.MailDraftUpsertRequest;
import cn.arorms.email.common.requests.MailMoveRequest;
import cn.arorms.email.common.requests.MailReadRequest;
import cn.arorms.email.common.requests.MailStarRequest;
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
    private final MailRepository mailRepository;
    private final AttachmentRepository attachmentRepository;

    public MailController(MailService mailService,
                          MailRepository mailRepository,
                          AttachmentRepository attachmentRepository) {
        this.mailService = mailService;
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
     * Get all soft-deleted mails of the user
     */
    @GetMapping("/deleted")
    public ResponseEntity<PageResponse<MailSummaryVo>> getDeletedMails(
            @AuthenticationPrincipal UserPrincipal user, Pageable pageable
    ) {
        return ResponseEntity.ok(mailService.getDeleted(user, pageable));
    }

    /**
     * Create a draft
     * @param user
     */
    @PostMapping("/draft")
    public MailDetailVo createDraft(@AuthenticationPrincipal UserPrincipal user, @RequestBody MailDraftUpsertRequest request) {
        return mailService.toDetailVo(mailService.createDraft(user, request));
    }

    /**
     * Update draft
     */
    @PutMapping("/{id}")
    public MailDetailVo updateDraft(@AuthenticationPrincipal UserPrincipal user, @PathVariable Long id, @RequestBody MailDraftUpsertRequest request) {
        return mailService.toDetailVo(mailService.updateDraft(user, id, request));
    }

    /**
     * Send email
     * @param user
     * @param request
     * @return
     * @throws MessagingException
     */
    @PostMapping("/send")
    public MailDetailVo send(@AuthenticationPrincipal UserPrincipal user, @RequestBody SendRequest request) throws MessagingException {
        return mailService.toDetailVo(mailService.send(user, request.to(), request.subject(), request.content()));
    }

    /**
     * Get a mail detail by id
     * @param user
     * @param id
     * @return
     */
    @GetMapping("/{id}")
    public MailDetailVo getMail(@AuthenticationPrincipal UserPrincipal user, @PathVariable Long id) {
        Mail mail = mailRepository.findByIdAndUserId(id, user.getId())
            .orElseThrow(() -> new ServiceException("Mail not found: " + id));

        List<AttachmentVo> attachments = attachmentRepository.findByMailId(mail.getId()).stream()
            .map(a -> new AttachmentVo(a.getId(), a.getFilename(), a.getContentType(), a.getSize()))
            .toList();

        return new MailDetailVo(
            mail.getId(),
            mail.getMailbox().getType(),
            mail.getFromAddress(),
            mail.getReplyTo(),
            mail.getSubject(),
            mail.getSentAt(),
            mail.getReceivedAt(),
            mail.getDeliveredTo(),
            mail.isSeen(),
            mail.isStarred(),
            mail.isDeleted(),
            mail.getTextContent(),
            mail.getHtmlContent(),
            mail.getRawPath(),
            attachments
        );
    }

    /**
     * Mark a mail as read or unread
     * @param user
     * @param id
     */
    @PatchMapping("/{id}/read")
    public void setRead(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable Long id,
            @RequestBody MailReadRequest request
    ) {
        mailService.setRead(user, id, request.seen());
    }

    /**
     * Soft delete a mail or restore it (restore puts it back in its original mailbox)
     */
    @PatchMapping("/{id}/delete")
    public void setDelete(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable Long id,
            @RequestBody MailDeleteRequest request
    ) {
        mailService.setDeleted(user, id, request.isDeleted());
    }

    /**
     * Permanently delete a mail that is already in the recycle bin.
     */
    @DeleteMapping("/{id}/permanent")
    public void permanentlyDelete(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable Long id
    ) {
        mailService.permanentlyDelete(user, id);
    }

    /**
     * Star or unstar a mail
     */
    @PatchMapping("/{id}/star")
    public void setStar(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable Long id,
            @RequestBody MailStarRequest request
    ) {
        mailService.setStarred(user, id, request.isStarred());
    }

    /**
     * Archive a mail (move to default ARCHIVE mailbox) or restore it (move back to INBOX)
     */
    @PatchMapping("/{id}/archive")
    public void setArchive(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable Long id,
            @RequestBody MailArchiveRequest request
    ) {
        mailService.setArchived(user, id, request.archived());
    }

    /**
     * Move a mail into a specific archive folder (default or labeled ARCHIVE mailbox)
     */
    @PatchMapping("/{id}/move")
    public void move(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable Long id,
            @RequestBody MailMoveRequest request
    ) {
        mailService.moveToArchiveFolder(user, id, request.mailboxId());
    }
}
