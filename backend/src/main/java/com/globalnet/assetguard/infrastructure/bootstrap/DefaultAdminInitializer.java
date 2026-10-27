package com.globalnet.assetguard.infrastructure.bootstrap;

import com.globalnet.assetguard.domain.model.User;
import com.globalnet.assetguard.domain.ports.output.UserRepositoryPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class DefaultAdminInitializer implements CommandLineRunner {

    private static final Logger logger = LoggerFactory.getLogger(DefaultAdminInitializer.class);
    private static final String ADMIN_EMAIL = "admin@globalnet.com";
    private static final String DEFAULT_PASSWORD = "12345";

    private final UserRepositoryPort userRepositoryPort;
    private final PasswordEncoder passwordEncoder;

    public DefaultAdminInitializer(
            UserRepositoryPort userRepositoryPort,
            PasswordEncoder passwordEncoder) {
        this.userRepositoryPort = userRepositoryPort;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        if (userRepositoryPort.findByEmail(ADMIN_EMAIL).isPresent()) {
            logger.info("Default administrator already exists; skipping bootstrap");
            return;
        }

        User administrator = User.builder()
                .fullName("System Administrator")
                .email(ADMIN_EMAIL)
                .password(passwordEncoder.encode(DEFAULT_PASSWORD))
                .role("ADMIN")
                .status(true)
                .build();
        userRepositoryPort.save(administrator);
        logger.info("Default administrator created: {}", ADMIN_EMAIL);
    }
}