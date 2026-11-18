package com.globalnet.assetguard.domain.ports.output;

import com.globalnet.assetguard.domain.model.PasswordResetToken;
import java.util.Optional;

public interface PasswordResetTokenRepositoryPort {

    PasswordResetToken save(PasswordResetToken token);

    Optional<PasswordResetToken> findByTokenAndNotUsed(String token);
}
