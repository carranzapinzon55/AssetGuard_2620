package com.globalnet.assetguard.domain.ports.output;

import com.globalnet.assetguard.domain.model.User;
import java.util.Optional;

public interface UserRepositoryPort {

    Optional<User> findByEmail(String email);

    User save(User user);
}