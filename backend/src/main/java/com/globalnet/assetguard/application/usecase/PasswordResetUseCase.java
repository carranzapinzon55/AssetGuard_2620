package com.globalnet.assetguard.application.usecase;

import com.globalnet.assetguard.domain.model.PasswordResetToken;
import com.globalnet.assetguard.domain.model.User;
import com.globalnet.assetguard.domain.ports.output.PasswordResetTokenRepositoryPort;
import com.globalnet.assetguard.domain.ports.output.UserRepositoryPort;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PasswordResetUseCase {

    private static final Logger logger = LoggerFactory.getLogger(PasswordResetUseCase.class);
    private static final long TOKEN_LIFETIME_MINUTES = 30;

    private final UserRepositoryPort userRepositoryPort;
    private final PasswordResetTokenRepositoryPort passwordResetTokenRepositoryPort;

    public PasswordResetUseCase(UserRepositoryPort userRepositoryPort,
                                PasswordResetTokenRepositoryPort passwordResetTokenRepositoryPort) {
        this.userRepositoryPort = userRepositoryPort;
        this.passwordResetTokenRepositoryPort = passwordResetTokenRepositoryPort;
    }

    @Transactional
    public void requestReset(String email) {
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("Email is required");
        }

        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
        userRepositoryPort.findByEmail(normalizedEmail).ifPresent(user -> issueToken(user, normalizedEmail));
    }

    private void issueToken(User user, String email) {
        String token = UUID.randomUUID().toString();
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(TOKEN_LIFETIME_MINUTES);

        passwordResetTokenRepositoryPort.save(PasswordResetToken.builder()
                .userId(user.getId())
                .token(token)
                .expiresAt(expiresAt)
                .used(false)
                .build());

        logger.info("Simulated password recovery email to {} with token {}", email, token);
    }
}
