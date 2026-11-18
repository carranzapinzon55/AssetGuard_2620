package com.globalnet.assetguard.infrastructure.outbound.persistence;

import com.globalnet.assetguard.infrastructure.outbound.persistence.entity.LostAssetReportEntity;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LostAssetReportJpaRepository extends JpaRepository<LostAssetReportEntity, Long> {

    @EntityGraph(attributePaths = {"asset", "loan", "reportedByUser"})
    List<LostAssetReportEntity> findAllByOrderByReportedAtDesc();

    long countByAcknowledgedFalse();
}
