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

    @org.springframework.data.jpa.repository.Query(value = """
        select coalesce(sum(asset.estimated_value), 0)
        from assets asset
        where asset.status = 'LOST'
          and (
            (CAST(:startDate AS timestamp) is null and CAST(:endDate AS timestamp) is null
             and asset.id not in (
                 select distinct loan.asset_id from loans loan
                 where loan.return_condition = 'LOST'
                   and loan.id not in (select report.loan_id from lost_asset_reports report where report.loan_id is not null)
             ))
            or asset.id in (
                select distinct report.asset_id
                from lost_asset_reports report
                where (CAST(:startDate AS timestamp) is null or report.reported_at >= CAST(:startDate AS timestamp))
                  and (CAST(:endDate AS timestamp) is null or report.reported_at <= CAST(:endDate AS timestamp))
            )
          )
        """, nativeQuery = true)
    java.math.BigDecimal sumEstimatedLossValue(
        @org.springframework.data.repository.query.Param("startDate") java.time.LocalDateTime startDate,
        @org.springframework.data.repository.query.Param("endDate") java.time.LocalDateTime endDate);
}
