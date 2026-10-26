package com.globalnet.assetguard.infrastructure.outbound.persistence.adapter;

import com.globalnet.assetguard.domain.model.Asset;
import com.globalnet.assetguard.domain.model.Loan;
import com.globalnet.assetguard.domain.model.User;
import com.globalnet.assetguard.domain.ports.output.LoanRepositoryPort;
import com.globalnet.assetguard.infrastructure.outbound.persistence.LoanJpaRepository;
import com.globalnet.assetguard.infrastructure.outbound.persistence.UserEntity;
import com.globalnet.assetguard.infrastructure.outbound.persistence.entity.AssetEntity;
import com.globalnet.assetguard.infrastructure.outbound.persistence.entity.LoanEntity;
import java.util.Optional;
import org.springframework.stereotype.Repository;

@Repository
public class LoanPersistenceAdapter implements LoanRepositoryPort {

    private final LoanJpaRepository loanJpaRepository;

    public LoanPersistenceAdapter(LoanJpaRepository loanJpaRepository) {
        this.loanJpaRepository = loanJpaRepository;
    }

    @Override
    public Loan save(Loan loan) {
        LoanEntity entity = toEntity(loan);
        LoanEntity savedEntity = loanJpaRepository.save(entity);
        return toDomain(savedEntity);
    }

    @Override
    public Optional<Loan> findById(Long id) {
        return loanJpaRepository.findById(id)
                .map(this::toDomain);
    }

    private Loan toDomain(LoanEntity entity) {
        if (entity == null) {
            return null;
        }

        User user = entity.getUser() == null
                ? null
                : User.builder().id(entity.getUser().getId()).build();
        Asset asset = entity.getAsset() == null
                ? null
                : Asset.builder().id(entity.getAsset().getId()).build();

        return Loan.builder()
                .id(entity.getId())
                .requestDate(entity.getRequestDate())
                .dueLocalDate(entity.getDueLocalDate())
                .returnDateTime(entity.getReturnDateTime())
                .status(entity.getStatus())
                .returnCondition(entity.getReturnCondition())
                .delayDays(entity.getDelayDays())
                .user(user)
                .asset(asset)
                .build();
    }

    private LoanEntity toEntity(Loan domain) {
        if (domain == null) {
            return null;
        }

        UserEntity user = domain.getUser() == null
                ? null
                : UserEntity.builder().id(domain.getUser().getId()).build();
        AssetEntity asset = domain.getAsset() == null
                ? null
                : AssetEntity.builder().id(domain.getAsset().getId()).build();

        return LoanEntity.builder()
                .id(domain.getId())
                .requestDate(domain.getRequestDate())
                .dueLocalDate(domain.getDueLocalDate())
                .returnDateTime(domain.getReturnDateTime())
                .status(domain.getStatus())
                .returnCondition(domain.getReturnCondition())
                .delayDays(domain.getDelayDays())
                .user(user)
                .asset(asset)
                .build();
    }
}