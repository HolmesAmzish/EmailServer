package cn.arorms.email.controllers;

import cn.arorms.email.domain.entity.Mail;
import cn.arorms.email.dto.AttachmentDto;
import cn.arorms.email.dto.MailDetailDto;
import cn.arorms.email.dto.MailSummaryDto;
import cn.arorms.email.dto.MailboxDto;
import cn.arorms.email.repository.AttachmentRepository;
import cn.arorms.email.repository.MailRepository;
import cn.arorms.email.repository.MailboxRepository;
import cn.arorms.email.service.MailService;
import cn.arorms.framework.common.exception.ServiceException;
import cn.arorms.framework.security.UserPrincipal;
import jakarta.mail.MessagingException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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

    @PostMapping("/send")
    public Mail send(@AuthenticationPrincipal UserPrincipal user, @RequestBody SendRequest request) throws MessagingException {
        return mailService.send(user, request.to(), request.subject(), request.content());
    }

    @GetMapping("/mailboxes")
    public List<MailboxDto> listMailboxes(@AuthenticationPrincipal UserPrincipal user) {
        return mailboxRepository.findByUserId(user.getId()).stream()
            .map(box -> new MailboxDto(box.getId(), box.getName(), box.getType().name()))
            .toList();
    }

    @GetMapping("/mailboxes/{id}/mails")
    public Page<MailSummaryDto> listMailboxMails(
        @AuthenticationPrincipal UserPrincipal user,
        @PathVariable Long id,
        @PageableDefault(size = 20) Pageable pageable) {
        return mailRepository.findByMailboxIdAndMailboxUserId(id, user.getId(), pageable)
            .map(mail -> new MailSummaryDto(
                mail.getId(),
                mail.getFromAddress(),
                mail.getSubject(),
                mail.getSentAt(),
                mail.getReceivedAt(),
                mail.isSeen()
            ));
    }

    @GetMapping("/mails/{id}")
    public MailDetailDto getMail(@AuthenticationPrincipal UserPrincipal user, @PathVariable Long id) {
        Mail mail = mailRepository.findByIdAndMailboxUserId(id, user.getId())
            .orElseThrow(() -> new ServiceException("Mail not found: " + id));

        List<AttachmentDto> attachments = attachmentRepository.findByMailId(mail.getId()).stream()
            .map(a -> new AttachmentDto(a.getId(), a.getFilename(), a.getContentType(), a.getSize()))
            .toList();

        return new MailDetailDto(
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

    @PatchMapping("/mails/{id}/read")
    public void markRead(@AuthenticationPrincipal UserPrincipal user, @PathVariable Long id) {
        Mail mail = mailRepository.findByIdAndMailboxUserId(id, user.getId())
            .orElseThrow(() -> new ServiceException("Mail not found: " + id));
        mail.setSeen(true);
        mailRepository.save(mail);
    }
}
