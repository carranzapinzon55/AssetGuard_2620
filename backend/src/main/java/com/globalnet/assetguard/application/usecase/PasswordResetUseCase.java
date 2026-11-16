package com.globalnet.assetguard.application.usecase;

import com.globalnet.assetguard.domain.model.User;
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

    public PasswordResetUseCase(UserRepositoryPort userRepositoryPort) {
        this.userRepositoryPort = userRepositoryPort;
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
        user.setPasswordResetToken(token);
        user.setPasswordResetTokenExpiresAt(LocalDateTime.now().plusMinutes(TOKEN_LIFETIME_MINUTES));
        userRepositoryPort.save(user);
        logger.info("Simulated password recovery email to {} with token {}", email, token);
    }
}
