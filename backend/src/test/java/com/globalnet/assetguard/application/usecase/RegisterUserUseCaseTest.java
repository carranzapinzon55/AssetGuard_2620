package com.globalnet.assetguard.application.usecase;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
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
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class RegisterUserUseCaseTest {

    @Mock
    private UserRepositoryPort userRepositoryPort;

    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    private RegisterUserUseCase registerUserUseCase;

    @Test
    void registrationStoresBcryptEncodedPasswordAndForcesTechnicianRole() {
        when(userRepositoryPort.findByEmail("new.user@example.com")).thenReturn(Optional.empty());
        when(userRepositoryPort.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        registerUserUseCase = new RegisterUserUseCase(userRepositoryPort, passwordEncoder);

        User result = registerUserUseCase.execute(User.builder()
                .email(" New.User@Example.com ")
                .password("plain-password")
                .role("ADMIN")
                .status(false)
                .build());

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepositoryPort).save(userCaptor.capture());
        User storedUser = userCaptor.getValue();
        assertTrue(passwordEncoder.matches("plain-password", storedUser.getPassword()));
        assertTrue(!"plain-password".equals(storedUser.getPassword()));
        assertTrue("TECHNICIAN".equals(storedUser.getRole()));
        assertTrue(Boolean.TRUE.equals(storedUser.getStatus()));
        assertTrue(result.getPassword().startsWith("$2"));
    }
}