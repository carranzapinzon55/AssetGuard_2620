package com.globalnet.assetguard.domain.ports.output;

import com.globalnet.assetguard.domain.model.MaintenanceRecord;
import java.util.List;
import java.util.Optional;

public interface MaintenanceRecordRepositoryPort {

    MaintenanceRecord save(MaintenanceRecord maintenanceRecord);

    Optional<MaintenanceRecord> findById(Long id);

    List<MaintenanceRecord> findByAssetId(Long assetId);

    List<MaintenanceRecord> findAll();
}
