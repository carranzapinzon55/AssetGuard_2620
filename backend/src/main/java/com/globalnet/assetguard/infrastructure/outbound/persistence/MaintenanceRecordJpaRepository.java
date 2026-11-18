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

    @Query(value = """
        select coalesce(sum(record.cost), 0.0)
        from maintenance_records record
        where (cast(:startDate as date) is null or record.start_date >= cast(:startDate as date))
          and (cast(:endDate as date) is null or record.start_date <= cast(:endDate as date))
        """, nativeQuery = true)
    Double sumCostsForStartDateRange(
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);
}
