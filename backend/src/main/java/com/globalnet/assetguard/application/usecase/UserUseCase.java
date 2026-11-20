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
public class UserUseCase {

    public static final String PROTECTED_ROOT_ADMIN_EMAIL = "admin@globalnet.com";
    private static final String ROOT_PROTECTION_ERROR_MESSAGE =
            "La cuenta raíz de seguridad (admin@globalnet.com) está protegida y no puede ser editada ni desactivada.";

    protected final UserRepositoryPort userRepositoryPort;
    protected final PasswordEncoder passwordEncoder;

    public UserUseCase(UserRepositoryPort userRepositoryPort, PasswordEncoder passwordEncoder) {
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

    public User updateManagedUser(User changes) {
        if (changes == null || changes.getId() == null) {
            throw new IllegalArgumentException("User ID is required");
        }
        User existing = userRepositoryPort.findById(changes.getId())
                .orElseThrow(() -> new NoSuchElementException("User not found with ID: " + changes.getId()));

        checkNotProtectedRootAdmin(existing.getEmail());

        if (changes.getFullName() == null || changes.getFullName().isBlank()) {
            throw new IllegalArgumentException("Full name is required");
        }
        if (changes.getEmail() == null || changes.getEmail().isBlank()) {
            throw new IllegalArgumentException("Email is required");
        }

        String normalizedEmail = changes.getEmail().trim().toLowerCase(Locale.ROOT);
        if (normalizedEmail.equalsIgnoreCase(PROTECTED_ROOT_ADMIN_EMAIL)
                && !existing.getEmail().equalsIgnoreCase(PROTECTED_ROOT_ADMIN_EMAIL)) {
            throw new IllegalArgumentException("No se permite asignar el correo protegido de la cuenta raíz (admin@globalnet.com).");
        }
        if (!normalizedEmail.equalsIgnoreCase(existing.getEmail())
                && userRepositoryPort.findByEmail(normalizedEmail).isPresent()) {
            throw new IllegalArgumentException("Email is already registered");
        }
        existing.setFullName(changes.getFullName().trim());
        existing.setEmail(normalizedEmail);
        if (changes.getStatus() != null) {
            existing.setStatus(changes.getStatus());
        }
        if (changes.getPassword() != null && !changes.getPassword().isBlank()) {
            existing.setPassword(passwordEncoder.encode(changes.getPassword()));
        }
        return userRepositoryPort.save(existing);
    }

    public User updateUser(User changes) {
        return updateManagedUser(changes);
    }

    public User updateStatus(Long userId, Boolean status) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID is required");
        }
        User existing = userRepositoryPort.findById(userId)
                .orElseThrow(() -> new NoSuchElementException("User not found with ID: " + userId));
        checkNotProtectedRootAdmin(existing.getEmail());
        existing.setStatus(status);
        return userRepositoryPort.save(existing);
    }

    public User changeRole(Long userId, String role) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID is required");
        }
        User existing = userRepositoryPort.findById(userId)
                .orElseThrow(() -> new NoSuchElementException("User not found with ID: " + userId));
        checkNotProtectedRootAdmin(existing.getEmail());
        if (role == null || !Set.of("ADMIN", "INSPECTOR", "TECHNICIAN").contains(role.toUpperCase(Locale.ROOT))) {
            throw new IllegalArgumentException("User role is not allowed");
        }
        existing.setRole(role.toUpperCase(Locale.ROOT));
        return userRepositoryPort.save(existing);
    }

    public User updatePassword(Long userId, String rawPassword) {
        if (userId == null || rawPassword == null || rawPassword.isBlank()) {
            throw new IllegalArgumentException("User ID and password are required");
        }
        User user = userRepositoryPort.findById(userId)
                .orElseThrow(() -> new NoSuchElementException("User not found with ID: " + userId));
        checkNotProtectedRootAdmin(user.getEmail());
        user.setPassword(passwordEncoder.encode(rawPassword));
        return userRepositoryPort.save(user);
    }

    private void checkNotProtectedRootAdmin(String email) {
        if (email != null && email.trim().equalsIgnoreCase(PROTECTED_ROOT_ADMIN_EMAIL)) {
            throw new IllegalArgumentException(ROOT_PROTECTION_ERROR_MESSAGE);
        }
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

    public List<User> findAll() {
        return userRepositoryPort.findAll();
    }

    public User findById(Long id) {
        if (id == null) {
            throw new IllegalArgumentException("User ID is required");
        }
        return userRepositoryPort.findById(id)
                .orElseThrow(() -> new NoSuchElementException("User not found with ID: " + id));
    }
}
