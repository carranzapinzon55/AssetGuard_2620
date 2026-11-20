package com.globalnet.assetguard.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.globalnet.assetguard.domain.model.User;
import com.globalnet.assetguard.domain.ports.output.UserRepositoryPort;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class UserUseCaseTest {

    @Mock
    private UserRepositoryPort userRepositoryPort;

    @Mock
    private PasswordEncoder passwordEncoder;

    private UserUseCase userUseCase;

    @BeforeEach
    void setUp() {
        userUseCase = new UserUseCase(userRepositoryPort, passwordEncoder);
    }

    @Test
    void updateManagedUserRejectsEditingProtectedRootAdmin() {
        User rootAdmin = User.builder()
                .id(1L)
                .email("admin@globalnet.com")
                .fullName("System Administrator")
                .role("ADMIN")
                .status(true)
                .build();
        when(userRepositoryPort.findById(1L)).thenReturn(Optional.of(rootAdmin));

        User changes = User.builder()
                .id(1L)
                .fullName("Nuevo Nombre")
                .email("admin@globalnet.com")
                .status(false)
                .build();

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> userUseCase.updateManagedUser(changes));

        assertEquals("La cuenta raíz de seguridad (admin@globalnet.com) está protegida y no puede ser editada ni desactivada.",
                ex.getMessage());
        verify(userRepositoryPort, never()).save(any(User.class));
    }

    @Test
    void updateStatusRejectsDeactivatingProtectedRootAdmin() {
        User rootAdmin = User.builder()
                .id(1L)
                .email("admin@globalnet.com")
                .role("ADMIN")
                .status(true)
                .build();
        when(userRepositoryPort.findById(1L)).thenReturn(Optional.of(rootAdmin));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> userUseCase.updateStatus(1L, false));

        assertEquals("La cuenta raíz de seguridad (admin@globalnet.com) está protegida y no puede ser editada ni desactivada.",
                ex.getMessage());
        verify(userRepositoryPort, never()).save(any(User.class));
    }

    @Test
    void changeRoleRejectsChangingRoleOfProtectedRootAdmin() {
        User rootAdmin = User.builder()
                .id(1L)
                .email("admin@globalnet.com")
                .role("ADMIN")
                .status(true)
                .build();
        when(userRepositoryPort.findById(1L)).thenReturn(Optional.of(rootAdmin));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> userUseCase.changeRole(1L, "TECHNICIAN"));

        assertEquals("La cuenta raíz de seguridad (admin@globalnet.com) está protegida y no puede ser editada ni desactivada.",
                ex.getMessage());
        verify(userRepositoryPort, never()).save(any(User.class));
    }

    @Test
    void updatePasswordRejectsChangingPasswordOfProtectedRootAdmin() {
        User rootAdmin = User.builder()
                .id(1L)
                .email("admin@globalnet.com")
                .role("ADMIN")
                .status(true)
                .build();
        when(userRepositoryPort.findById(1L)).thenReturn(Optional.of(rootAdmin));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> userUseCase.updatePassword(1L, "newSecretPass"));

        assertEquals("La cuenta raíz de seguridad (admin@globalnet.com) está protegida y no puede ser editada ni desactivada.",
                ex.getMessage());
        verify(userRepositoryPort, never()).save(any(User.class));
    }

    @Test
    void updateManagedUserRejectsChangingAnotherUserEmailToProtectedEmail() {
        User regularUser = User.builder()
                .id(2L)
                .email("carlos@globalnet.com")
                .fullName("Carlos Técnico")
                .role("TECHNICIAN")
                .status(true)
                .build();
        when(userRepositoryPort.findById(2L)).thenReturn(Optional.of(regularUser));

        User changes = User.builder()
                .id(2L)
                .fullName("Carlos Técnico")
                .email("admin@globalnet.com")
                .status(true)
                .build();

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> userUseCase.updateManagedUser(changes));

        assertTrue(ex.getMessage().contains("No se permite asignar el correo protegido"));
        verify(userRepositoryPort, never()).save(any(User.class));
    }

    @Test
    void updateManagedUserAllowsEditingNormalUser() {
        User regularUser = User.builder()
                .id(3L)
                .email("normal@globalnet.com")
                .fullName("Normal User")
                .role("TECHNICIAN")
                .status(true)
                .build();
        when(userRepositoryPort.findById(3L)).thenReturn(Optional.of(regularUser));
        when(userRepositoryPort.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User changes = User.builder()
                .id(3L)
                .fullName("Normal User Edited")
                .email("normal.edited@globalnet.com")
                .status(false)
                .build();

        User result = userUseCase.updateManagedUser(changes);

        assertEquals("Normal User Edited", result.getFullName());
        assertEquals("normal.edited@globalnet.com", result.getEmail());
        assertEquals(false, result.getStatus());
        verify(userRepositoryPort).save(regularUser);
    }
}
