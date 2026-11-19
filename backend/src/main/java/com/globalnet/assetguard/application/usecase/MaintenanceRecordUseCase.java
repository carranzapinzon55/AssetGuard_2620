package com.globalnet.assetguard.application.usecase;

import com.globalnet.assetguard.domain.model.Asset;
import com.globalnet.assetguard.domain.model.MaintenanceRecord;
import com.globalnet.assetguard.domain.ports.output.AssetRepositoryPort;
import com.globalnet.assetguard.domain.ports.output.MaintenanceRecordRepositoryPort;
import java.util.NoSuchElementException;
import java.time.LocalDate;
import java.util.List;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Service;

@Service
public class MaintenanceRecordUseCase {

    public static final double MAX_MAINTENANCE_COST_USD = 100_000.0;

    private final MaintenanceRecordRepositoryPort maintenanceRecordRepositoryPort;
    private final AssetRepositoryPort assetRepositoryPort;
    private final AuditLogUseCase auditLogUseCase;
    private final LostAssetReportUseCase lostAssetReportUseCase;

    public MaintenanceRecordUseCase(
            MaintenanceRecordRepositoryPort maintenanceRecordRepositoryPort,
            AssetRepositoryPort assetRepositoryPort,
            AuditLogUseCase auditLogUseCase,
            LostAssetReportUseCase lostAssetReportUseCase) {
        this.maintenanceRecordRepositoryPort = maintenanceRecordRepositoryPort;
        this.assetRepositoryPort = assetRepositoryPort;
        this.auditLogUseCase = auditLogUseCase;
        this.lostAssetReportUseCase = lostAssetReportUseCase;
    }

    @Transactional
    public MaintenanceRecord execute(MaintenanceRecord maintenanceRecord) {
        if (maintenanceRecord == null) {
            throw new IllegalArgumentException("Maintenance record must not be null");
        }
        if (maintenanceRecord.getAsset() == null || maintenanceRecord.getAsset().getId() == null) {
            throw new IllegalArgumentException(
                    "Maintenance record must reference an asset with an ID");
        }
        validateCost(maintenanceRecord.getCost());

        Long assetId = maintenanceRecord.getAsset().getId();
        Asset asset = assetRepositoryPort.findById(assetId)
                .orElseThrow(() -> new NoSuchElementException("Asset not found with ID: " + assetId));
        int available = assetRepositoryPort.calculateAvailableQuantity(assetId);
        if (available <= 0) {
            throw new IllegalStateException("Asset has no available units for maintenance");
        }
        maintenanceRecord.setAsset(asset);
        String previousStatus = asset.getStatus();
        int remaining = available - 1;
        if (remaining <= 0) {
            asset.setStatus("UNDER_MAINTENANCE");
        } else {
            asset.setStatus("AVAILABLE");
        }
        assetRepositoryPort.save(asset);

        MaintenanceRecord savedRecord = maintenanceRecordRepositoryPort.save(maintenanceRecord);
        auditLogUseCase.record("MAINTENANCE_OPENED", "MAINTENANCE", savedRecord.getId(),
            "Intervención abierta para el activo " + assetId);
        if (!java.util.Objects.equals(previousStatus, asset.getStatus())) {
            auditLogUseCase.record("ASSET_STATUS_CHANGED", "ASSET", asset.getId(),
                previousStatus + " -> " + asset.getStatus());
        }
        return savedRecord;
    }

    public List<MaintenanceRecord> findAll() {
        return maintenanceRecordRepositoryPort.findAll();
    }

    @Transactional
    public MaintenanceRecord update(Long recordId, MaintenanceRecord changes) {
        if (recordId == null || changes == null) {
            throw new IllegalArgumentException("Maintenance record ID and changes are required");
        }
        MaintenanceRecord record = maintenanceRecordRepositoryPort.findById(recordId)
                .orElseThrow(() -> new NoSuchElementException(
                        "Maintenance record not found: " + recordId));
        if (record.getEndDate() != null) {
            throw new IllegalStateException("Completed maintenance records cannot be updated");
        }
        validateCost(changes.getCost());
        if (changes.getProvider() == null && changes.getReason() == null && changes.getCost() == null) {
            throw new IllegalArgumentException("At least one maintenance field must be provided");
        }
        if (record.getAsset() == null || record.getAsset().getId() == null) {
            throw new IllegalStateException("Maintenance record has no asset");
        }
        Asset asset = assetRepositoryPort.findById(record.getAsset().getId())
                .orElseThrow(() -> new NoSuchElementException(
                        "Asset not found: " + record.getAsset().getId()));

        if (changes.getProvider() != null) {
            record.setProvider(changes.getProvider());
        }
        if (changes.getReason() != null) {
            record.setReason(changes.getReason());
        }
        if (changes.getCost() != null) {
            record.setCost(changes.getCost());
        }
        MaintenanceRecord savedRecord = maintenanceRecordRepositoryPort.save(record);
        auditLogUseCase.record("MAINTENANCE_UPDATED", "MAINTENANCE", savedRecord.getId(),
                "Intervención actualizada para el activo " + asset.getId());
        return savedRecord;
    }

    private void validateCost(Double cost) {
        if (cost != null && (!Double.isFinite(cost) || cost < 0 || cost > MAX_MAINTENANCE_COST_USD)) {
            throw new IllegalArgumentException(
                    "Maintenance cost must be between 0 and 100000 USD");
        }
    }

    @Transactional
    public MaintenanceRecord complete(Long recordId) {
        MaintenanceRecord record = maintenanceRecordRepositoryPort.findById(recordId)
                .orElseThrow(() -> new NoSuchElementException("Maintenance record not found: " + recordId));
        if (record.getEndDate() != null) {
            throw new IllegalStateException("Maintenance record is already completed");
        }
        if (record.getAsset() == null || record.getAsset().getId() == null) {
            throw new IllegalStateException("Maintenance record has no asset");
        }
        Asset asset = assetRepositoryPort.findById(record.getAsset().getId())
                .orElseThrow(() -> new NoSuchElementException("Asset not found: " + record.getAsset().getId()));
        record.setEndDate(LocalDate.now());
        String previousStatus = asset.getStatus();
        asset.setStatus("AVAILABLE");
        assetRepositoryPort.save(asset);
        record.setAsset(asset);
        MaintenanceRecord savedRecord = maintenanceRecordRepositoryPort.save(record);
        auditLogUseCase.record("MAINTENANCE_COMPLETED", "MAINTENANCE", savedRecord.getId(),
            "Intervención cerrada para el activo " + asset.getId());
        if (!"AVAILABLE".equals(previousStatus)) {
            auditLogUseCase.record("ASSET_STATUS_CHANGED", "ASSET", asset.getId(),
                previousStatus + " -> AVAILABLE");
        }
        return savedRecord;
    }

    @Transactional
    public MaintenanceRecord decommission(Long recordId, String notes, Long operatorId) {
        if (recordId == null) {
            throw new IllegalArgumentException("Maintenance record ID is required");
        }
        if (notes == null || notes.trim().length() < 10) {
            throw new IllegalArgumentException("Decommission notes must be at least 10 characters long");
        }
        MaintenanceRecord record = maintenanceRecordRepositoryPort.findById(recordId)
                .orElseThrow(() -> new NoSuchElementException("Maintenance record not found: " + recordId));
        if (record.getEndDate() != null) {
            throw new IllegalStateException("Completed maintenance records cannot be decommissioned");
        }
        if (record.getAsset() == null || record.getAsset().getId() == null) {
            throw new IllegalStateException("Maintenance record has no asset");
        }
        Asset asset = assetRepositoryPort.findById(record.getAsset().getId())
                .orElseThrow(() -> new NoSuchElementException("Asset not found: " + record.getAsset().getId()));

        record.setEndDate(LocalDate.now());
        String reasonPrefix = (record.getReason() != null && !record.getReason().isBlank()) ? record.getReason() + " | " : "";
        record.setReason(reasonPrefix + "[BAJA DEFINITIVA] " + notes.trim());
        MaintenanceRecord savedRecord = maintenanceRecordRepositoryPort.save(record);

        lostAssetReportUseCase.reportLost(
                asset.getId(),
                null,
                operatorId,
                "[BAJA DEFINITIVA EN MANTENIMIENTO] " + notes.trim()
        );

        Asset updatedAsset = assetRepositoryPort.findById(asset.getId()).orElse(asset);
        savedRecord.setAsset(updatedAsset);

        auditLogUseCase.record("ASSET_DECOMMISSIONED", "MAINTENANCE", savedRecord.getId(),
                "Baja definitiva en mantenimiento para el activo " + asset.getId() + ": " + notes.trim());

        return savedRecord;
    }
}
