package com.globalnet.assetguard.infrastructure.outbound.persistence.adapter;

import com.globalnet.assetguard.domain.model.Asset;
import com.globalnet.assetguard.domain.model.Loan;
import com.globalnet.assetguard.domain.model.LostAssetReport;
import com.globalnet.assetguard.domain.model.User;
import com.globalnet.assetguard.domain.ports.output.LostAssetReportRepositoryPort;
import com.globalnet.assetguard.infrastructure.outbound.persistence.AssetJpaRepository;
import com.globalnet.assetguard.infrastructure.outbound.persistence.LoanJpaRepository;
import com.globalnet.assetguard.infrastructure.outbound.persistence.LostAssetReportJpaRepository;
import com.globalnet.assetguard.infrastructure.outbound.persistence.UserEntity;
import com.globalnet.assetguard.infrastructure.outbound.persistence.UserJpaRepository;
import com.globalnet.assetguard.infrastructure.outbound.persistence.entity.AssetEntity;
import com.globalnet.assetguard.infrastructure.outbound.persistence.entity.LoanEntity;
import com.globalnet.assetguard.infrastructure.outbound.persistence.entity.LostAssetReportEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Repository;

@Repository
public class LostAssetReportPersistenceAdapter implements LostAssetReportRepositoryPort {

    private final LostAssetReportJpaRepository lostAssetReportJpaRepository;
    private final AssetJpaRepository assetJpaRepository;
    private final LoanJpaRepository loanJpaRepository;
    private final UserJpaRepository userJpaRepository;

    public LostAssetReportPersistenceAdapter(
            LostAssetReportJpaRepository lostAssetReportJpaRepository,
            AssetJpaRepository assetJpaRepository,
            LoanJpaRepository loanJpaRepository,
            UserJpaRepository userJpaRepository) {
        this.lostAssetReportJpaRepository = lostAssetReportJpaRepository;
        this.assetJpaRepository = assetJpaRepository;
        this.loanJpaRepository = loanJpaRepository;
        this.userJpaRepository = userJpaRepository;
    }

    @Override
    public LostAssetReport save(LostAssetReport report) {
        AssetEntity assetEntity = report.getAsset() != null && report.getAsset().getId() != null
                ? assetJpaRepository.findById(report.getAsset().getId()).orElse(null)
                : null;
        LoanEntity loanEntity = report.getLoan() != null && report.getLoan().getId() != null
                ? loanJpaRepository.findById(report.getLoan().getId()).orElse(null)
                : null;
        UserEntity userEntity = report.getReportedByUser() != null && report.getReportedByUser().getId() != null
                ? userJpaRepository.findById(report.getReportedByUser().getId()).orElse(null)
                : null;

        LostAssetReportEntity entity = LostAssetReportEntity.builder()
                .id(report.getId())
                .asset(assetEntity)
                .loan(loanEntity)
                .reportedByUser(userEntity)
                .reportedAt(report.getReportedAt())
                .notes(report.getNotes())
                .acknowledged(Boolean.TRUE.equals(report.getAcknowledged()))
                .build();

        LostAssetReportEntity saved = lostAssetReportJpaRepository.save(entity);
        return toDomain(saved);
    }

    @Override
    public List<LostAssetReport> findAll() {
        return lostAssetReportJpaRepository.findAllByOrderByReportedAtDesc().stream()
                .map(this::toDomain)
                .toList();
    }

    @Override
    public Optional<LostAssetReport> findById(Long id) {
        return lostAssetReportJpaRepository.findById(id).map(this::toDomain);
    }

    @Override
    public long countUnacknowledged() {
        return lostAssetReportJpaRepository.countByAcknowledgedFalse();
    }

    private LostAssetReport toDomain(LostAssetReportEntity entity) {
        if (entity == null) {
            return null;
        }

        Asset asset = entity.getAsset() == null ? null : Asset.builder()
                .id(entity.getAsset().getId())
                .serialNumber(entity.getAsset().getSerialNumber())
                .model(entity.getAsset().getModel())
                .estimatedValue(entity.getAsset().getEstimatedValue())
                .status(entity.getAsset().getStatus())
                .purchaseDate(entity.getAsset().getPurchaseDate())
                .stockQuantity(entity.getAsset().getStockQuantity())
                .build();

        User user = entity.getReportedByUser() == null ? null : User.builder()
                .id(entity.getReportedByUser().getId())
                .fullName(entity.getReportedByUser().getFullName())
                .email(entity.getReportedByUser().getEmail())
                .role(entity.getReportedByUser().getRole())
                .status(entity.getReportedByUser().getStatus())
                .build();

        Loan loan = entity.getLoan() == null ? null : Loan.builder()
                .id(entity.getLoan().getId())
                .status(entity.getLoan().getStatus())
                .dueLocalDate(entity.getLoan().getDueLocalDate())
                .build();

        return LostAssetReport.builder()
                .id(entity.getId())
                .asset(asset)
                .loan(loan)
                .reportedByUser(user)
                .reportedAt(entity.getReportedAt())
                .notes(entity.getNotes())
                .acknowledged(entity.getAcknowledged())
                .build();
    }
}
