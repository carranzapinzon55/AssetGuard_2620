package com.globalnet.assetguard.infrastructure.inbound.graphql;

import com.globalnet.assetguard.application.usecase.PasswordResetUseCase;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;

@Controller
public class PasswordResetGraphQLController {

    private final PasswordResetUseCase passwordResetUseCase;

    public PasswordResetGraphQLController(PasswordResetUseCase passwordResetUseCase) {
        this.passwordResetUseCase = passwordResetUseCase;
    }

    @MutationMapping
    @PreAuthorize("permitAll()")
    public PasswordResetPayload requestPasswordReset(@Argument String email) {
        passwordResetUseCase.requestReset(email);
        return new PasswordResetPayload("If the account exists, a recovery email will be sent.");
    }

    public record PasswordResetPayload(String message) {
    }
}
