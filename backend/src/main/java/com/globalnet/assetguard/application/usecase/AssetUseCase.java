package com.globalnet.assetguard.application.usecase;

import com.globalnet.assetguard.domain.model.Asset;
import com.globalnet.assetguard.domain.ports.output.AssetRepositoryPort;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class AssetUseCase {

    private static final Set<String> ALLOWED_STATUSES =
            Set.of("AVAILABLE", "LOANED", "UNDER_MAINTENANCE", "LOST", "ON_LOAN", "MAINTENANCE");

    private final AssetRepositoryPort assetRepositoryPort;

    public AssetUseCase(AssetRepositoryPort assetRepositoryPort) {
        this.assetRepositoryPort = assetRepositoryPort;
    }

    public Asset register(Asset asset) {
        if (asset == null) {
            throw new IllegalArgumentException("Asset must not be null");
        }

        String serialNumber = asset.getSerialNumber();
        if (serialNumber == null || serialNumber.isBlank()) {
            throw new IllegalArgumentException("Asset serial number must not be blank");
        }
        asset.setSerialNumber(serialNumber.trim());

        if (assetRepositoryPort.findBySerialNumber(asset.getSerialNumber()).isPresent()) {
            throw new IllegalArgumentException(
                    "Asset serial number already exists: " + asset.getSerialNumber());
        }
        if (asset.getStatus() == null || !ALLOWED_STATUSES.contains(asset.getStatus())) {
            throw new IllegalArgumentException(
                    "Asset status must be a recognized lifecycle status");
        }

        return assetRepositoryPort.save(asset);
    }

    public Asset findById(Long id) {
        if (id == null) {
            throw new IllegalArgumentException("Asset ID must not be null");
        }
        return assetRepositoryPort.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Asset not found with ID: " + id));
    }

    public Asset update(Long id, Asset changes) {
        if (id == null || changes == null) {
            throw new IllegalArgumentException("Asset ID and changes are required");
        }
        Asset existing = findById(id);
        if (changes.getSerialNumber() == null || changes.getSerialNumber().isBlank()) {
            throw new IllegalArgumentException("Asset serial number must not be blank");
        }
        String serialNumber = changes.getSerialNumber().trim();
        Asset duplicate = assetRepositoryPort.findBySerialNumber(serialNumber).orElse(null);
        if (duplicate != null && !id.equals(duplicate.getId())) {
            throw new IllegalArgumentException("Asset serial number already exists: " + serialNumber);
        }
        if (changes.getStatus() == null || !ALLOWED_STATUSES.contains(changes.getStatus())) {
            throw new IllegalArgumentException("Asset status must be a recognized lifecycle status");
        }
        existing.setSerialNumber(serialNumber);
        existing.setModel(changes.getModel());
        existing.setEstimatedValue(changes.getEstimatedValue());
        existing.setPurchaseDate(changes.getPurchaseDate());
        existing.setStatus(changes.getStatus());
        return assetRepositoryPort.save(existing);
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
}
