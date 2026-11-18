package com.globalnet.assetguard.domain.ports.output;

import com.globalnet.assetguard.domain.model.LostAssetReport;
import java.util.List;
import java.util.Optional;

public interface LostAssetReportRepositoryPort {
    LostAssetReport save(LostAssetReport report);
    List<LostAssetReport> findAll();
    Optional<LostAssetReport> findById(Long id);
    long countUnacknowledged();
}
