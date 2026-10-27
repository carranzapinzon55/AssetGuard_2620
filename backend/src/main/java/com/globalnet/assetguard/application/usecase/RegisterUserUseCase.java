package com.globalnet.assetguard.application.usecase;

import com.globalnet.assetguard.domain.model.User;
import com.globalnet.assetguard.domain.ports.output.UserRepositoryPort;
import java.util.List;
import java.util.Locale;
import java.util.NoSuchElementException;
import java.util.Set;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class RegisterUserUseCase {

    private final UserRepositoryPort userRepositoryPort;
    private final PasswordEncoder passwordEncoder;

    public RegisterUserUseCase(UserRepositoryPort userRepositoryPort, PasswordEncoder passwordEncoder) {
        this.userRepositoryPort = userRepositoryPort;
        this.passwordEncoder = passwordEncoder;
    }

    public User execute(User user) {
        if (user == null) {
            throw new IllegalArgumentException("User is required");
        }
        user.setRole("TECHNICIAN");
        user.setStatus(true);
        return persistNewUser(user);
    }

    public User createManagedUser(User user) {
        if (user == null || user.getRole() == null) {
            throw new IllegalArgumentException("User and role are required");
        }
        user.setRole(user.getRole().toUpperCase(Locale.ROOT));
        if (user.getStatus() == null) {
            user.setStatus(true);
        }
        return persistNewUser(user);
    }

    private User persistNewUser(User user) {
        if (user == null || user.getPassword() == null || user.getPassword().isBlank()) {
            throw new IllegalArgumentException("User and password are required");
        }
        if (user.getEmail() == null || user.getEmail().isBlank()) {
            throw new IllegalArgumentException("Email is required");
        }

        user.setEmail(user.getEmail().trim().toLowerCase(Locale.ROOT));
        if (userRepositoryPort.findByEmail(user.getEmail()).isPresent()) {
            throw new IllegalArgumentException("Email is already registered");
        }
        if (!Set.of("ADMIN", "INSPECTOR", "TECHNICIAN").contains(user.getRole())) {
            throw new IllegalArgumentException("User role is not allowed");
        }
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        return userRepositoryPort.save(user);
    }

    public User updatePassword(Long userId, String rawPassword) {
        if (userId == null || rawPassword == null || rawPassword.isBlank()) {
            throw new IllegalArgumentException("User ID and password are required");
        }
        User user = userRepositoryPort.findById(userId)
                .orElseThrow(() -> new NoSuchElementException("User not found with ID: " + userId));
        user.setPassword(passwordEncoder.encode(rawPassword));
        return userRepositoryPort.save(user);
    }

    public List<User> findAll() {
        return userRepositoryPort.findAll();
    }
}