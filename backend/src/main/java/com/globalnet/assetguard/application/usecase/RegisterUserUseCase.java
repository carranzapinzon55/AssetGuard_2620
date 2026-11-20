package com.globalnet.assetguard.application.usecase;

import com.globalnet.assetguard.domain.ports.output.UserRepositoryPort;
import org.springframework.context.annotation.Primary;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@Primary
public class RegisterUserUseCase extends UserUseCase {

    public RegisterUserUseCase(UserRepositoryPort userRepositoryPort, PasswordEncoder passwordEncoder) {
        super(userRepositoryPort, passwordEncoder);
    }
}
