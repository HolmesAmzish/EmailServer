package cn.arorms.email.app.controllers;


import cn.arorms.email.app.service.MailService;
import cn.arorms.email.common.requests.MailboxUpsertRequest;
import cn.arorms.email.common.responses.MailSummaryVo;
import cn.arorms.email.common.responses.MailboxVo;
import cn.arorms.email.app.service.MailboxService;
import cn.arorms.framework.security.UserPrincipal;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/mailbox")
public class MailboxController {

    private final MailboxService mailboxService;
    private final MailService mailService;

    public MailboxController(MailboxService mailboxService, MailService mailService) {
        this.mailboxService = mailboxService;
        this.mailService = mailService;
    }

//    @PostMapping("/create-default-mailboxes")
//    public void createDefaultMailboxes(@AuthenticationPrincipal UserPrincipal userPrincipal) {
//        mailboxService.ensureDefaultMailboxes(userPrincipal.getId());
//    }

    /**
     * Get all user's mailboxes
     * @param user UserPrincipal
     * @return all mailboxes of user
     */
    @GetMapping
    public ResponseEntity<List<MailboxVo>> listMailboxes(@AuthenticationPrincipal UserPrincipal user) {
        return ResponseEntity.ok(mailboxService.getMailboxes(user));
    }

    /**
     * Create new mailbox
     * @param user
     * @param request
     * @return
     */
    @PostMapping
    public ResponseEntity<Void> createMailboxes(
            @AuthenticationPrincipal UserPrincipal user,
            MailboxUpsertRequest request
    ) {
        mailboxService.upsert(user, request);
        return ResponseEntity.noContent().build();
    }

    /**
     * Update mailbox by id
     * @param user
     * @param id
     * @param request
     * @return
     */
    @PutMapping("/{id}")
    public ResponseEntity<Void> updateMailboxes(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable Long id,
            MailboxUpsertRequest request
    ) {
        mailboxService.upsert(user, id, request);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMailboxes(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable Long id
    ) {
        mailboxService.deleteById(user, id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Get emails of specific mailboxes by mailboxes id
     * @param user
     * @param id mailbox id
     * @param pageable page param
     * @return Page of MailSummary
     */
    @GetMapping("/{id}/mails")
    public Page<MailSummaryVo> getMailByMailbox(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable Long id,
            @PageableDefault(size = 20) Pageable pageable) {
        return mailService.getByMailbox(user, id, pageable)
                .map(mail -> new MailSummaryVo(
                        mail.getId(),
                        mail.getFromAddress(),
                        mail.getReplyTo(),
                        mail.getDeliveredTo(),
                        mail.getSubject(),
                        mail.getSentAt(),
                        mail.getReceivedAt(),
                        mail.isSeen(),
                        mail.getTextContent()
                ));
    }
}
