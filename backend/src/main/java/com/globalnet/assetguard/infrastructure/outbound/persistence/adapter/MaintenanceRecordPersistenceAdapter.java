package com.globalnet.assetguard.infrastructure.outbound.persistence.adapter;

import com.globalnet.assetguard.domain.model.Asset;
import com.globalnet.assetguard.domain.model.MaintenanceRecord;
import com.globalnet.assetguard.domain.model.Provider;
import com.globalnet.assetguard.domain.ports.output.MaintenanceRecordRepositoryPort;
import com.globalnet.assetguard.infrastructure.outbound.persistence.MaintenanceRecordJpaRepository;
import com.globalnet.assetguard.infrastructure.outbound.persistence.ProviderJpaRepository;
import com.globalnet.assetguard.infrastructure.outbound.persistence.entity.AssetEntity;
import com.globalnet.assetguard.infrastructure.outbound.persistence.entity.MaintenanceRecordEntity;
import com.globalnet.assetguard.infrastructure.outbound.persistence.entity.ProviderEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Repository;

@Repository
public class MaintenanceRecordPersistenceAdapter implements MaintenanceRecordRepositoryPort {

    private final MaintenanceRecordJpaRepository maintenanceRecordJpaRepository;
    private final ProviderJpaRepository providerJpaRepository;

    public MaintenanceRecordPersistenceAdapter(
            MaintenanceRecordJpaRepository maintenanceRecordJpaRepository,
            ProviderJpaRepository providerJpaRepository) {
        this.maintenanceRecordJpaRepository = maintenanceRecordJpaRepository;
        this.providerJpaRepository = providerJpaRepository;
    }

    @Override
    public MaintenanceRecord save(MaintenanceRecord maintenanceRecord) {
        MaintenanceRecordEntity entity = toEntity(maintenanceRecord);
        MaintenanceRecordEntity savedEntity = maintenanceRecordJpaRepository.save(entity);
        return toDomain(savedEntity);
    }

    @Override
    public Optional<MaintenanceRecord> findById(Long id) {
        return maintenanceRecordJpaRepository.findById(id)
                .map(this::toDomain);
    }

    @Override
    public List<MaintenanceRecord> findByAssetId(Long assetId) {
        return maintenanceRecordJpaRepository.findByAssetId(assetId)
                .stream()
                .map(this::toDomain)
                .toList();
    }

    @Override
    public List<MaintenanceRecord> findAll() {
        return maintenanceRecordJpaRepository.findAll()
                .stream()
                .map(this::toDomain)
                .toList();
    }

    private MaintenanceRecord toDomain(MaintenanceRecordEntity entity) {
        if (entity == null) {
            return null;
        }

        Asset asset = entity.getAsset() == null
                ? null
            : Asset.builder()
                .id(entity.getAsset().getId())
                .serialNumber(entity.getAsset().getSerialNumber())
                .model(entity.getAsset().getModel())
                .estimatedValue(entity.getAsset().getEstimatedValue())
                .status(entity.getAsset().getStatus())
                .purchaseDate(entity.getAsset().getPurchaseDate())
                .stockQuantity(entity.getAsset().getStockQuantity())
                .build();

        Provider provider = entity.getProvider() == null
                ? null
                : Provider.builder()
                        .id(entity.getProvider().getId())
                        .name(entity.getProvider().getName())
                        .active(entity.getProvider().getActive())
                        .build();

        return MaintenanceRecord.builder()
                .id(entity.getId())
                .asset(asset)
                .provider(provider)
                .reason(entity.getReason())
                .cost(entity.getCost())
                .startDate(entity.getStartDate())
                .endDate(entity.getEndDate())
                .build();
    }

    private MaintenanceRecordEntity toEntity(MaintenanceRecord domain) {
        if (domain == null) {
            return null;
        }

        AssetEntity asset = domain.getAsset() == null
                ? null
                : AssetEntity.builder().id(domain.getAsset().getId()).build();

        ProviderEntity providerEntity = null;
        if (domain.getProvider() != null) {
            if (domain.getProvider().getId() != null) {
                providerEntity = providerJpaRepository.findById(domain.getProvider().getId())
                        .orElse(null);
            } else if (domain.getProvider().getName() != null && !domain.getProvider().getName().isBlank()) {
                String cleanName = domain.getProvider().getName().trim();
                providerEntity = providerJpaRepository.findByName(cleanName)
                        .orElseGet(() -> providerJpaRepository.save(
                                ProviderEntity.builder().name(cleanName).active(true).build()));
            }
        }

        return MaintenanceRecordEntity.builder()
                .id(domain.getId())
                .asset(asset)
                .provider(providerEntity)
                .reason(domain.getReason())
                .cost(domain.getCost())
                .startDate(domain.getStartDate())
                .endDate(domain.getEndDate())
                .build();
    }
}
