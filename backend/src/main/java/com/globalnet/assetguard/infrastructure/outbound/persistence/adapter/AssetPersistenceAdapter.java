package com.globalnet.assetguard.infrastructure.outbound.persistence.adapter;

import com.globalnet.assetguard.domain.model.Asset;
import com.globalnet.assetguard.domain.ports.output.AssetRepositoryPort;
import com.globalnet.assetguard.infrastructure.outbound.persistence.AssetJpaRepository;
import com.globalnet.assetguard.infrastructure.outbound.persistence.entity.AssetEntity;
import java.util.Optional;
import org.springframework.stereotype.Repository;

@Repository
public class AssetPersistenceAdapter implements AssetRepositoryPort {

    private final AssetJpaRepository assetJpaRepository;

    public AssetPersistenceAdapter(AssetJpaRepository assetJpaRepository) {
        this.assetJpaRepository = assetJpaRepository;
    }

    @Override
    public Asset save(Asset asset) {
        AssetEntity entity = toEntity(asset);
        AssetEntity savedEntity = assetJpaRepository.save(entity);
        return toDomain(savedEntity);
    }

    @Override
    public Optional<Asset> findBySerialNumber(String serialNumber) {
        return assetJpaRepository.findBySerialNumber(serialNumber)
                .map(this::toDomain);
    }

    @Override
    public Optional<Asset> findById(Long id) {
        return assetJpaRepository.findById(id)
                .map(this::toDomain);
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
                .build();
    }
}