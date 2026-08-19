package cn.arorms.email.controllers;

import cn.arorms.framework.security.UserPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    @GetMapping("/me")
    public ResponseEntity<UserPrincipal> me(@AuthenticationPrincipal UserPrincipal userPrincipal) {
        return ResponseEntity.ok(userPrincipal);
    }
}
