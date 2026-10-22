package com.globalnet.assetguard.infrastructure.inbound.rest;

import com.globalnet.assetguard.application.usecase.RegisterUserUseCase;
import com.globalnet.assetguard.domain.model.User;
import com.globalnet.assetguard.infrastructure.inbound.rest.dto.UserRequestDto;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final RegisterUserUseCase registerUserUseCase;

    public UserController(RegisterUserUseCase registerUserUseCase) {
        this.registerUserUseCase = registerUserUseCase;
    }

    @PostMapping("/register")
    public ResponseEntity<User> registerUser(@RequestBody UserRequestDto requestDto) {
        // Mapear de DTO a Dominio
        User user = User.builder()
                .fullName(requestDto.getFullName())
                .email(requestDto.getEmail())
                .password(requestDto.getPassword())
                .role(requestDto.getRole())
                .status(requestDto.getStatus() != null ? requestDto.getStatus() : true)
                .build();

        // Ejecutar el caso de uso
        User savedUser = registerUserUseCase.execute(user);

        // Retornar respuesta HTTP 201 (Created) con el usuario registrado
        return new ResponseEntity<>(savedUser, HttpStatus.CREATED);
    }
}