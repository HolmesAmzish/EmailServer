package cn.arorms.email.controllers;


import cn.arorms.email.common.responses.MailboxVo;
import cn.arorms.email.service.MailboxService;
import cn.arorms.framework.security.UserPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/mailbox")
public class MailboxController {

    private final MailboxService mailboxService;

    public MailboxController(MailboxService mailboxService) {
        this.mailboxService = mailboxService;
    }

    @PostMapping("/create-default-mailboxes")
    public void createDefaultMailboxes(@AuthenticationPrincipal UserPrincipal userPrincipal) {
        mailboxService.ensureDefaultMailboxes(userPrincipal.getId());
    }

    @GetMapping("/mailboxes")
    public ResponseEntity<List<MailboxVo>> listMailboxes(@AuthenticationPrincipal UserPrincipal user) {
        return ResponseEntity.ok(mailboxService.getMailboxes(user));
    }
}
