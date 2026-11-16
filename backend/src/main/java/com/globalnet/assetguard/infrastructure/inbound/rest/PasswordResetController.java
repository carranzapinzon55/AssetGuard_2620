package com.globalnet.assetguard.infrastructure.inbound.rest;

import com.globalnet.assetguard.application.usecase.PasswordResetUseCase;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PasswordResetController {

    private final PasswordResetUseCase passwordResetUseCase;

    public PasswordResetController(PasswordResetUseCase passwordResetUseCase) {
        this.passwordResetUseCase = passwordResetUseCase;
    }

    @PostMapping("/api/auth/password-reset")
    @PreAuthorize("permitAll()")
    public ResponseEntity<PasswordResetResponse> requestReset(@RequestBody PasswordResetRequest request) {
        passwordResetUseCase.requestReset(request.email());
        return ResponseEntity.accepted()
                .body(new PasswordResetResponse("If the account exists, a recovery email will be sent."));
    }

    public record PasswordResetRequest(String email) {
    }

    public record PasswordResetResponse(String message) {
    }
}
