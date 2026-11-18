package com.globalnet.assetguard.infrastructure.outbound.persistence.adapter;

import com.globalnet.assetguard.domain.model.PasswordResetToken;
import com.globalnet.assetguard.domain.ports.output.PasswordResetTokenRepositoryPort;
import com.globalnet.assetguard.infrastructure.outbound.persistence.PasswordResetTokenJpaRepository;
import com.globalnet.assetguard.infrastructure.outbound.persistence.UserEntity;
import com.globalnet.assetguard.infrastructure.outbound.persistence.entity.PasswordResetTokenEntity;
import java.util.Optional;
import org.springframework.stereotype.Repository;

@Repository
public class PasswordResetTokenPersistenceAdapter implements PasswordResetTokenRepositoryPort {

    private final PasswordResetTokenJpaRepository passwordResetTokenJpaRepository;

    public PasswordResetTokenPersistenceAdapter(PasswordResetTokenJpaRepository passwordResetTokenJpaRepository) {
        this.passwordResetTokenJpaRepository = passwordResetTokenJpaRepository;
    }

    @Override
    public PasswordResetToken save(PasswordResetToken token) {
        PasswordResetTokenEntity entity = PasswordResetTokenEntity.builder()
                .id(token.getId())
                .user(UserEntity.builder().id(token.getUserId()).build())
                .token(token.getToken())
                .expiresAt(token.getExpiresAt())
                .used(token.getUsed() != null ? token.getUsed() : false)
                .build();
        PasswordResetTokenEntity saved = passwordResetTokenJpaRepository.save(entity);
        return toDomain(saved);
    }

    @Override
    public Optional<PasswordResetToken> findByTokenAndNotUsed(String token) {
        return passwordResetTokenJpaRepository.findByTokenAndUsedFalse(token)
                .map(this::toDomain);
    }

    private PasswordResetToken toDomain(PasswordResetTokenEntity entity) {
        return PasswordResetToken.builder()
                .id(entity.getId())
                .userId(entity.getUser() != null ? entity.getUser().getId() : null)
                .token(entity.getToken())
                .expiresAt(entity.getExpiresAt())
                .used(entity.getUsed())
                .build();
    }
}
