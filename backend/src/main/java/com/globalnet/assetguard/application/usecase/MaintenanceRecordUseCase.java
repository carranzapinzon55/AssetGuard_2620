package com.globalnet.assetguard.application.usecase;

import com.globalnet.assetguard.domain.model.Asset;
import com.globalnet.assetguard.domain.model.MaintenanceRecord;
import com.globalnet.assetguard.domain.ports.output.AssetRepositoryPort;
import com.globalnet.assetguard.domain.ports.output.MaintenanceRecordRepositoryPort;
import java.util.NoSuchElementException;
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
        maintenanceRecord.setAsset(asset);

        return maintenanceRecordRepositoryPort.save(maintenanceRecord);
    }
}
