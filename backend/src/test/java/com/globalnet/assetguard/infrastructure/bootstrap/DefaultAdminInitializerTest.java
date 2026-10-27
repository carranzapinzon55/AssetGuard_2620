package com.globalnet.assetguard.infrastructure.bootstrap;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.globalnet.assetguard.domain.model.User;
import com.globalnet.assetguard.domain.ports.output.UserRepositoryPort;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@ExtendWith(MockitoExtension.class)
class DefaultAdminInitializerTest {

    @Mock
    private UserRepositoryPort userRepositoryPort;

    @Test
    void createsAdminWithBcryptPasswordWhenMissing() {
        var passwordEncoder = new BCryptPasswordEncoder();
        var initializer = new DefaultAdminInitializer(userRepositoryPort, passwordEncoder);
        when(userRepositoryPort.findByEmail("admin@globalnet.com")).thenReturn(Optional.empty());

        initializer.run();

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepositoryPort).save(userCaptor.capture());
        User savedUser = userCaptor.getValue();
        assertTrue("ADMIN".equals(savedUser.getRole()));
        assertTrue(Boolean.TRUE.equals(savedUser.getStatus()));
        assertTrue(passwordEncoder.matches("12345", savedUser.getPassword()));
    }

    @Test
    void doesNotCreateAdminAgainWhenEmailAlreadyExists() {
        var initializer = new DefaultAdminInitializer(userRepositoryPort, new BCryptPasswordEncoder());
        when(userRepositoryPort.findByEmail("admin@globalnet.com"))
                .thenReturn(Optional.of(User.builder().id(1L).email("admin@globalnet.com").build()));

        initializer.run();

        verify(userRepositoryPort, never()).save(any(User.class));
    }
}