package com.globalnet.assetguard.infrastructure.inbound.rest;

import com.globalnet.assetguard.application.usecase.RegisterUserUseCase;
import com.globalnet.assetguard.domain.model.User;
import com.globalnet.assetguard.infrastructure.inbound.rest.dto.UserRequestDto;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final RegisterUserUseCase registerUserUseCase;

    public UserController(RegisterUserUseCase registerUserUseCase) {
        this.registerUserUseCase = registerUserUseCase;
    }

    @PostMapping("/register")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserResponse> registerUser(@RequestBody UserRequestDto requestDto) {
        // Mapear de DTO a Dominio
        User user = User.builder()
                .fullName(requestDto.getFullName())
                .email(requestDto.getEmail())
                .password(requestDto.getPassword())
                .build();

        // Ejecutar el caso de uso
        User savedUser = registerUserUseCase.execute(user);

        // Retornar respuesta HTTP 201 (Created) con el usuario registrado
        return new ResponseEntity<>(UserResponse.from(savedUser), HttpStatus.CREATED);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<UserResponse> createManagedUser(@RequestBody UserRequestDto requestDto) {
        User user = User.builder()
                .fullName(requestDto.getFullName())
                .email(requestDto.getEmail())
                .password(requestDto.getPassword())
                .role(requestDto.getRole())
                .status(requestDto.getStatus())
                .build();
        User savedUser = registerUserUseCase.createManagedUser(user);
        return new ResponseEntity<>(UserResponse.from(savedUser), HttpStatus.CREATED);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping
    public ResponseEntity<?> findAll() {
        return ResponseEntity.ok(registerUserUseCase.findAll().stream().map(UserResponse::from).toList());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}/password")
    public ResponseEntity<UserResponse> updatePassword(
            @PathVariable Long id,
            @RequestBody PasswordUpdateRequest request) {
        User updatedUser = registerUserUseCase.updatePassword(id, request.password());
        return ResponseEntity.ok(UserResponse.from(updatedUser));
    }

    public record PasswordUpdateRequest(String password) {
    }

    public record UserResponse(Long id, String fullName, String email, String role, Boolean status) {
        static UserResponse from(User user) {
            return new UserResponse(
                    user.getId(), user.getFullName(), user.getEmail(), user.getRole(), user.getStatus());
        }
    }
}