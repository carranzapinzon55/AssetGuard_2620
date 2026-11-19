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

    long countByAsset_Id(Long assetId);

    @org.springframework.data.jpa.repository.Query("""
        select report.asset.id, count(report.id)
        from LostAssetReportEntity report
        where report.asset is not null
        group by report.asset.id
        """)
    List<Object[]> countLostReportsByAsset();
}
