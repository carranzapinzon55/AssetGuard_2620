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

    private final MaintenanceRecordRepositoryPort maintenanceRecordRepositoryPort;
    private final AssetRepositoryPort assetRepositoryPort;

    public MaintenanceRecordUseCase(
            MaintenanceRecordRepositoryPort maintenanceRecordRepositoryPort,
            AssetRepositoryPort assetRepositoryPort) {
        this.maintenanceRecordRepositoryPort = maintenanceRecordRepositoryPort;
        this.assetRepositoryPort = assetRepositoryPort;
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

        Long assetId = maintenanceRecord.getAsset().getId();
        Asset asset = assetRepositoryPort.findById(assetId)
                .orElseThrow(() -> new NoSuchElementException("Asset not found with ID: " + assetId));
        if ("LOST".equals(asset.getStatus())) {
            throw new IllegalStateException("A lost asset cannot enter maintenance");
        }
        if ("UNDER_MAINTENANCE".equals(asset.getStatus())) {
            throw new IllegalStateException("Asset is already under maintenance");
        }
        maintenanceRecord.setAsset(asset);
        asset.setStatus("UNDER_MAINTENANCE");
        assetRepositoryPort.save(asset);

        return maintenanceRecordRepositoryPort.save(maintenanceRecord);
    }

    public List<MaintenanceRecord> findAll() {
        return maintenanceRecordRepositoryPort.findAll();
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
        if (!"UNDER_MAINTENANCE".equals(asset.getStatus())) {
            throw new IllegalStateException("Asset is not under maintenance");
        }
        record.setEndDate(LocalDate.now());
        asset.setStatus("AVAILABLE");
        assetRepositoryPort.save(asset);
        record.setAsset(asset);
        return maintenanceRecordRepositoryPort.save(record);
    }
}
