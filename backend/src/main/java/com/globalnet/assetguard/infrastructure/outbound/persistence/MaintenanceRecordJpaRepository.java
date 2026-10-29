package com.globalnet.assetguard.infrastructure.outbound.persistence;

import com.globalnet.assetguard.infrastructure.outbound.persistence.entity.MaintenanceRecordEntity;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MaintenanceRecordJpaRepository extends JpaRepository<MaintenanceRecordEntity, Long> {

    @Override
    @EntityGraph(attributePaths = "asset")
    List<MaintenanceRecordEntity> findAll();

    List<MaintenanceRecordEntity> findByAssetId(Long assetId);
}
