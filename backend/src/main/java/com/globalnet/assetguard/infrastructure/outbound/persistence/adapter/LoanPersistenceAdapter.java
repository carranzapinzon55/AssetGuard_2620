package com.globalnet.assetguard.infrastructure.outbound.persistence.adapter;

import com.globalnet.assetguard.domain.model.Asset;
import com.globalnet.assetguard.domain.model.Loan;
import com.globalnet.assetguard.domain.model.LoanAuditPage;
import com.globalnet.assetguard.domain.model.LoanDashboardMetrics;
import com.globalnet.assetguard.domain.model.User;
import com.globalnet.assetguard.domain.ports.output.LoanRepositoryPort;
import com.globalnet.assetguard.infrastructure.outbound.persistence.AssetJpaRepository;
import com.globalnet.assetguard.infrastructure.outbound.persistence.LoanJpaRepository;
import com.globalnet.assetguard.infrastructure.outbound.persistence.UserEntity;
import com.globalnet.assetguard.infrastructure.outbound.persistence.entity.AssetEntity;
import com.globalnet.assetguard.infrastructure.outbound.persistence.entity.LoanEntity;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;

@Repository
public class LoanPersistenceAdapter implements LoanRepositoryPort {

    private final LoanJpaRepository loanJpaRepository;
    private final AssetJpaRepository assetJpaRepository;

    public LoanPersistenceAdapter(
            LoanJpaRepository loanJpaRepository,
            AssetJpaRepository assetJpaRepository) {
        this.loanJpaRepository = loanJpaRepository;
        this.assetJpaRepository = assetJpaRepository;
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

    @Override
    public List<Loan> findAll() {
        return loanJpaRepository.findAll()
                .stream()
                .map(this::toDomain)
                .toList();
    }

    @Override
    public boolean hasOverdueApprovedLoan(Long userId, LocalDate today) {
        return loanJpaRepository.existsByUser_IdAndStatusAndDueLocalDateBeforeAndReturnDateTimeIsNull(
                userId, Loan.Status.APPROVED, today);
    }

        @Override
        public List<Loan> findByUserId(Long userId) {
        return loanJpaRepository.findByUser_IdOrderByRequestDateDesc(userId)
            .stream()
            .map(this::toDomain)
            .toList();
        }

        @Override
        public LoanAuditPage searchAudit(
            String serialNumber,
            Long technicianId,
            LocalDateTime startDate,
            LocalDateTime endDate,
            Loan.Status status,
            int page,
            int limit) {
        String normalizedSerial = serialNumber == null || serialNumber.isBlank()
            ? null
            : serialNumber.trim();
        Page<LoanEntity> results = loanJpaRepository.searchAudit(
            normalizedSerial,
            technicianId,
            startDate,
            endDate,
            status,
            PageRequest.of(page, limit));
        return new LoanAuditPage(
            results.getContent().stream().map(this::toDomain).toList(),
            results.getTotalElements(),
            results.getNumber(),
            results.getSize());
        }

        @Override
        public LoanDashboardMetrics calculateDashboardMetrics() {
        return new LoanDashboardMetrics(
            loanJpaRepository.sumEstimatedLossValue(),
            Optional.ofNullable(loanJpaRepository.onTimeReturnPercentage()).orElse(0.0),
            assetJpaRepository.countByStatusIn(List.of("LOANED", "ON_LOAN")));
        }

    private Loan toDomain(LoanEntity entity) {
        if (entity == null) {
            return null;
        }

        User user = entity.getUser() == null
                ? null
            : User.builder()
                .id(entity.getUser().getId())
                .fullName(entity.getUser().getFullName())
                .email(entity.getUser().getEmail())
                .role(entity.getUser().getRole())
                .status(entity.getUser().getStatus())
                .build();
        Asset asset = entity.getAsset() == null
                ? null
            : Asset.builder()
                .id(entity.getAsset().getId())
                .serialNumber(entity.getAsset().getSerialNumber())
                .model(entity.getAsset().getModel())
                .estimatedValue(entity.getAsset().getEstimatedValue())
                .status(entity.getAsset().getStatus())
                .purchaseDate(entity.getAsset().getPurchaseDate())
                .build();
        User inspector = entity.getInspector() == null
            ? null
            : User.builder()
                .id(entity.getInspector().getId())
                .fullName(entity.getInspector().getFullName())
                .email(entity.getInspector().getEmail())
                .role(entity.getInspector().getRole())
                .status(entity.getInspector().getStatus())
                .build();

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
                .inspector(inspector)
                .rejectionReason(entity.getRejectionReason())
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
        UserEntity inspector = domain.getInspector() == null
            ? null
            : UserEntity.builder().id(domain.getInspector().getId()).build();

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
                .inspector(inspector)
                .rejectionReason(domain.getRejectionReason())
                .build();
    }
}