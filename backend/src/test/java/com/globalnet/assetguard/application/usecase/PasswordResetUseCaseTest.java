package com.globalnet.assetguard.application.usecase;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.globalnet.assetguard.domain.model.User;
import com.globalnet.assetguard.domain.ports.output.UserRepositoryPort;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PasswordResetUseCaseTest {

    @Mock
    private UserRepositoryPort userRepositoryPort;

    @InjectMocks
    private PasswordResetUseCase passwordResetUseCase;

    @Test
    void createsAndPersistsAnExpiringUuidForNormalizedEmail() {
        User user = User.builder().id(1L).email("person@example.com").build();
        when(userRepositoryPort.findByEmail("person@example.com")).thenReturn(Optional.of(user));
        LocalDateTime beforeRequest = LocalDateTime.now();

        passwordResetUseCase.requestReset(" PERSON@example.com ");

        UUID.fromString(user.getPasswordResetToken());
        assertNotNull(user.getPasswordResetTokenExpiresAt());
        assertTrue(user.getPasswordResetTokenExpiresAt().isAfter(beforeRequest.plusMinutes(29)));
        assertTrue(user.getPasswordResetTokenExpiresAt().isBefore(LocalDateTime.now().plusMinutes(31)));
        verify(userRepositoryPort).save(user);
    }
}
