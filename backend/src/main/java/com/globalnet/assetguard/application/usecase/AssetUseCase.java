package com.globalnet.assetguard.application.usecase;

import com.globalnet.assetguard.domain.model.Asset;
import com.globalnet.assetguard.domain.ports.output.AssetRepositoryPort;
import java.util.List;
import java.util.Locale;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AssetUseCase {

    private static final Set<String> ALLOWED_STATUSES =
            Set.of("AVAILABLE", "LOANED", "UNDER_MAINTENANCE", "LOST", "ON_LOAN", "MAINTENANCE");

    private final AssetRepositoryPort assetRepositoryPort;
    private final AuditLogUseCase auditLogUseCase;

    public AssetUseCase(AssetRepositoryPort assetRepositoryPort, AuditLogUseCase auditLogUseCase) {
        this.assetRepositoryPort = assetRepositoryPort;
        this.auditLogUseCase = auditLogUseCase;
    }

    @Transactional
    public Asset register(Asset asset) {
        if (asset == null) {
            throw new IllegalArgumentException("Asset must not be null");
        }

        if (asset.getStatus() == null || !ALLOWED_STATUSES.contains(asset.getStatus())) {
            throw new IllegalArgumentException(
                    "Asset status must be a recognized lifecycle status");
        }

        asset.setSerialNumber(generateSerialNumber(asset.getModel()));
        Asset savedAsset = assetRepositoryPort.save(asset);
        auditLogUseCase.record("ASSET_CREATED", "ASSET", savedAsset.getId(),
                "Activo creado con serial " + savedAsset.getSerialNumber());
        return savedAsset;
    }

    public Asset findById(Long id) {
        if (id == null) {
            throw new IllegalArgumentException("Asset ID must not be null");
        }
        return assetRepositoryPort.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Asset not found with ID: " + id));
    }

    @Transactional
    public Asset update(Long id, Asset changes) {
        if (id == null || changes == null) {
            throw new IllegalArgumentException("Asset ID and changes are required");
        }
        Asset existing = findById(id);
        if (changes.getStatus() == null || !ALLOWED_STATUSES.contains(changes.getStatus())) {
            throw new IllegalArgumentException("Asset status must be a recognized lifecycle status");
        }
        String previousStatus = existing.getStatus();
        existing.setModel(changes.getModel());
        existing.setEstimatedValue(changes.getEstimatedValue());
        existing.setPurchaseDate(changes.getPurchaseDate());
        existing.setStatus(changes.getStatus());
        Asset savedAsset = assetRepositoryPort.save(existing);
        auditLogUseCase.record("ASSET_UPDATED", "ASSET", savedAsset.getId(),
                "Activo actualizado: " + savedAsset.getSerialNumber());
        if (!java.util.Objects.equals(previousStatus, savedAsset.getStatus())) {
            auditLogUseCase.record("ASSET_STATUS_CHANGED", "ASSET", savedAsset.getId(),
                    previousStatus + " -> " + savedAsset.getStatus());
        }
        return savedAsset;
    }

    public Asset findBySerialNumber(String serialNumber) {
        if (serialNumber == null || serialNumber.isBlank()) {
            throw new IllegalArgumentException("Asset serial number must not be blank");
        }
        String normalizedSerialNumber = serialNumber.trim();
        return assetRepositoryPort.findBySerialNumber(normalizedSerialNumber)
                .orElseThrow(() -> new NoSuchElementException(
                        "Asset not found with serial number: " + normalizedSerialNumber));
    }

    public List<Asset> findAll() {
        return assetRepositoryPort.findAll();
    }

    private String generateSerialNumber(String model) {
        String brand = model == null || model.isBlank()
                ? "UNKNOWN"
                : model.trim().split("\\s+", 2)[0].replaceAll("[^A-Za-z0-9]", "")
                        .toUpperCase(Locale.ROOT);
        if (brand.isBlank()) {
            brand = "UNKNOWN";
        }
        String shortId = UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase(Locale.ROOT);
        return "SN-" + brand + "-" + shortId;
    }
}
