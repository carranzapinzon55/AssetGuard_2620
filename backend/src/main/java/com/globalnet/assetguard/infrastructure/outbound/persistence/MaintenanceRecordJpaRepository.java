package com.globalnet.assetguard.infrastructure.outbound.persistence;

import com.globalnet.assetguard.infrastructure.outbound.persistence.entity.MaintenanceRecordEntity;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface MaintenanceRecordJpaRepository extends JpaRepository<MaintenanceRecordEntity, Long> {

    @Override
    @EntityGraph(attributePaths = "asset")
    List<MaintenanceRecordEntity> findAll();

    List<MaintenanceRecordEntity> findByAssetId(Long assetId);

    @Query("""
        select coalesce(sum(record.cost), 0)
        from MaintenanceRecordEntity record
        where (:startDate is null or record.startDate >= :startDate)
          and (:endDate is null or record.startDate <= :endDate)
        """)
    Double sumCostsForStartDateRange(
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);
}
