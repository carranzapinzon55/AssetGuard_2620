package com.globalnet.assetguard.application.usecase;

import com.globalnet.assetguard.domain.model.User;
import com.globalnet.assetguard.domain.ports.output.TokenProviderPort;
import com.globalnet.assetguard.domain.ports.output.UserRepositoryPort;
import java.util.Locale;
import java.util.NoSuchElementException;
import java.util.Set;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthenticationUseCase {

    private static final Set<String> ALLOWED_ROLES = Set.of("ADMIN", "INSPECTOR", "TECHNICIAN");

    private final UserRepositoryPort userRepositoryPort;
    private final PasswordEncoder passwordEncoder;
    private final TokenProviderPort tokenProviderPort;

    public AuthenticationUseCase(
            UserRepositoryPort userRepositoryPort,
            PasswordEncoder passwordEncoder,
            TokenProviderPort tokenProviderPort) {
        this.userRepositoryPort = userRepositoryPort;
        this.passwordEncoder = passwordEncoder;
        this.tokenProviderPort = tokenProviderPort;
    }

    public LoginResult login(String email, String password) {
        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            throw new IllegalArgumentException("Email and password are required");
        }

        User user = userRepositoryPort.findByEmail(email.trim().toLowerCase(Locale.ROOT))
                .orElseThrow(() -> new NoSuchElementException("Invalid credentials"));
        if (!Boolean.TRUE.equals(user.getStatus())
                || !passwordEncoder.matches(password, user.getPassword())
                || user.getRole() == null
                || !ALLOWED_ROLES.contains(user.getRole().toUpperCase(Locale.ROOT))) {
            throw new NoSuchElementException("Invalid credentials");
        }

        return new LoginResult(tokenProviderPort.generateToken(user), user);
    }

    public record LoginResult(String token, User user) {
    }
}