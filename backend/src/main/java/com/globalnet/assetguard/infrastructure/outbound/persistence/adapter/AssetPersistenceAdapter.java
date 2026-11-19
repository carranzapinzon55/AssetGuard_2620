package com.globalnet.assetguard.infrastructure.outbound.persistence.adapter;

import com.globalnet.assetguard.domain.model.Asset;
import com.globalnet.assetguard.domain.model.Loan;
import com.globalnet.assetguard.domain.ports.output.AssetRepositoryPort;
import com.globalnet.assetguard.infrastructure.outbound.persistence.AssetJpaRepository;
import com.globalnet.assetguard.infrastructure.outbound.persistence.LoanJpaRepository;
import com.globalnet.assetguard.infrastructure.outbound.persistence.LostAssetReportJpaRepository;
import com.globalnet.assetguard.infrastructure.outbound.persistence.MaintenanceRecordJpaRepository;
import com.globalnet.assetguard.infrastructure.outbound.persistence.entity.AssetEntity;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Repository;

@Repository
public class AssetPersistenceAdapter implements AssetRepositoryPort {

    private final AssetJpaRepository assetJpaRepository;
    private final LoanJpaRepository loanJpaRepository;
    private final MaintenanceRecordJpaRepository maintenanceRecordJpaRepository;
    private final LostAssetReportJpaRepository lostAssetReportJpaRepository;

    public AssetPersistenceAdapter(
            AssetJpaRepository assetJpaRepository,
            LoanJpaRepository loanJpaRepository,
            MaintenanceRecordJpaRepository maintenanceRecordJpaRepository,
            LostAssetReportJpaRepository lostAssetReportJpaRepository) {
        this.assetJpaRepository = assetJpaRepository;
        this.loanJpaRepository = loanJpaRepository;
        this.maintenanceRecordJpaRepository = maintenanceRecordJpaRepository;
        this.lostAssetReportJpaRepository = lostAssetReportJpaRepository;
    }

    @Override
    public Asset save(Asset asset) {
        AssetEntity entity = toEntity(asset);
        AssetEntity savedEntity = assetJpaRepository.save(entity);
        Asset domain = toDomain(savedEntity);
        if (savedEntity.getId() != null) {
            domain.setAvailableQuantity(calculateAvailableQuantity(savedEntity.getId()));
        } else {
            domain.setAvailableQuantity(domain.getStockQuantity());
        }
        return domain;
    }

    @Override
    public Optional<Asset> findBySerialNumber(String serialNumber) {
        return assetJpaRepository.findBySerialNumber(serialNumber)
                .map(entity -> {
                    Asset domain = toDomain(entity);
                    int available = calculateAvailableQuantity(entity.getId());
                    domain.setAvailableQuantity(available);
                    if (available > 0 && ("LOANED".equalsIgnoreCase(domain.getStatus()) || "UNDER_MAINTENANCE".equalsIgnoreCase(domain.getStatus()))) {
                        domain.setStatus("AVAILABLE");
                    }
                    return domain;
                });
    }

    @Override
    public Optional<Asset> findById(Long id) {
        return assetJpaRepository.findById(id)
                .map(entity -> {
                    Asset domain = toDomain(entity);
                    int available = calculateAvailableQuantity(entity.getId());
                    domain.setAvailableQuantity(available);
                    if (available > 0 && ("LOANED".equalsIgnoreCase(domain.getStatus()) || "UNDER_MAINTENANCE".equalsIgnoreCase(domain.getStatus()))) {
                        domain.setStatus("AVAILABLE");
                    }
                    return domain;
                });
    }

    @Override
    public List<Asset> findAll() {
        List<AssetEntity> entities = assetJpaRepository.findAll();
        if (entities.isEmpty()) {
            return List.of();
        }

        Map<Long, Long> loansMap = new HashMap<>();
        for (Object[] row : loanJpaRepository.countApprovedLoansByAsset()) {
            if (row != null && row.length >= 2 && row[0] != null && row[1] != null) {
                loansMap.put((Long) row[0], ((Number) row[1]).longValue());
            }
        }
        Map<Long, Long> maintMap = new HashMap<>();
        for (Object[] row : maintenanceRecordJpaRepository.countOpenMaintenanceByAsset()) {
            if (row != null && row.length >= 2 && row[0] != null && row[1] != null) {
                maintMap.put((Long) row[0], ((Number) row[1]).longValue());
            }
        }
        Map<Long, Long> lostMap = new HashMap<>();
        for (Object[] row : lostAssetReportJpaRepository.countLostReportsByAsset()) {
            if (row != null && row.length >= 2 && row[0] != null && row[1] != null) {
                lostMap.put((Long) row[0], ((Number) row[1]).longValue());
            }
        }

        return entities.stream().map(entity -> {
            Asset domain = toDomain(entity);
            int totalStock = entity.getStockQuantity() != null && entity.getStockQuantity() > 0 ? entity.getStockQuantity() : 1;
            long activeLoans = loansMap.getOrDefault(entity.getId(), 0L);
            long openMaint = maintMap.getOrDefault(entity.getId(), 0L);
            long lost = lostMap.getOrDefault(entity.getId(), 0L);
            if (lost == 0 && "LOST".equalsIgnoreCase(entity.getStatus())) {
                lost = 1L;
            }
            long committed = activeLoans + openMaint + lost;
            int available = (int) Math.max(0, totalStock - committed);
            domain.setAvailableQuantity(available);
            if (available > 0 && ("LOANED".equalsIgnoreCase(domain.getStatus()) || "UNDER_MAINTENANCE".equalsIgnoreCase(domain.getStatus()))) {
                domain.setStatus("AVAILABLE");
            }
            return domain;
        }).toList();
    }

    @Override
    public long countCurrentlyInField() {
        return assetJpaRepository.countByStatusIn(List.of("LOANED", "ON_LOAN"));
    }

    @Override
    public int calculateAvailableQuantity(Long assetId) {
        if (assetId == null) {
            return 0;
        }
        Optional<AssetEntity> optional = assetJpaRepository.findById(assetId);
        if (optional.isEmpty()) {
            return 0;
        }
        AssetEntity entity = optional.get();
        int totalStock = entity.getStockQuantity() != null && entity.getStockQuantity() > 0 ? entity.getStockQuantity() : 1;
        long activeLoans = loanJpaRepository.countByAsset_IdAndStatus(assetId, Loan.Status.APPROVED);
        long openMaintenance = maintenanceRecordJpaRepository.countByAsset_IdAndEndDateIsNull(assetId);
        long lostReports = lostAssetReportJpaRepository.countByAsset_Id(assetId);
        if (lostReports == 0 && "LOST".equalsIgnoreCase(entity.getStatus())) {
            lostReports = 1;
        }
        long committed = activeLoans + openMaintenance + lostReports;
        return (int) Math.max(0, totalStock - committed);
    }

    private Asset toDomain(AssetEntity entity) {
        if (entity == null) {
            return null;
        }
        return Asset.builder()
                .id(entity.getId())
                .serialNumber(entity.getSerialNumber())
                .model(entity.getModel())
                .estimatedValue(entity.getEstimatedValue())
                .status(entity.getStatus())
                .purchaseDate(entity.getPurchaseDate())
                .stockQuantity(entity.getStockQuantity() != null ? entity.getStockQuantity() : 1)
                .build();
    }

    private AssetEntity toEntity(Asset domain) {
        if (domain == null) {
            return null;
        }
        return AssetEntity.builder()
                .id(domain.getId())
                .serialNumber(domain.getSerialNumber())
                .model(domain.getModel())
                .estimatedValue(domain.getEstimatedValue())
                .status(domain.getStatus())
                .purchaseDate(domain.getPurchaseDate())
                .stockQuantity(domain.getStockQuantity() != null ? domain.getStockQuantity() : 1)
                .build();
    }
}
