package com.globalnet.assetguard.infrastructure.outbound.persistence;

import com.globalnet.assetguard.domain.model.Loan;
import com.globalnet.assetguard.infrastructure.outbound.persistence.entity.LoanEntity;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LoanJpaRepository extends JpaRepository<LoanEntity, Long> {

  @Override
  @EntityGraph(attributePaths = {"user", "asset", "inspector"})
  List<LoanEntity> findAll();

    boolean existsByUser_IdAndStatusAndDueLocalDateBeforeAndReturnDateTimeIsNull(
            Long userId, Loan.Status status, LocalDate today);

    @EntityGraph(attributePaths = {"user", "asset", "inspector"})
    List<LoanEntity> findByUser_IdOrderByRequestDateDesc(Long userId);

    @Query(value = """
        select loan.* from loans loan
        inner join assets asset on loan.asset_id = asset.id
        where (:serialNumber is null or lower(cast(asset.serial_number as text)) = lower(cast(:serialNumber as text)))
          and (:technicianId is null or loan.user_id = :technicianId)
          and (CAST(:startDate AS timestamp) is null or loan.request_date >= CAST(:startDate AS timestamp))
          and (CAST(:endDate AS timestamp) is null or loan.request_date <= CAST(:endDate AS timestamp))
          and (:status is null or loan.status = :status)
        order by loan.request_date desc, loan.id desc
        """,
        countQuery = """
        select count(loan.id) from loans loan
        inner join assets asset on loan.asset_id = asset.id
        where (:serialNumber is null or lower(cast(asset.serial_number as text)) = lower(cast(:serialNumber as text)))
          and (:technicianId is null or loan.user_id = :technicianId)
          and (CAST(:startDate AS timestamp) is null or loan.request_date >= CAST(:startDate AS timestamp))
          and (CAST(:endDate AS timestamp) is null or loan.request_date <= CAST(:endDate AS timestamp))
          and (:status is null or loan.status = :status)
        """,
        nativeQuery = true)
    Page<LoanEntity> searchAudit(
        @Param("serialNumber") String serialNumber,
        @Param("technicianId") Long technicianId,
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate,
        @Param("status") String status,
        Pageable pageable);

    @Query(value = """
        select coalesce(sum(asset.estimated_value), 0)
        from assets asset
        where asset.id in (
        select distinct loan.asset_id from loans loan
        where loan.return_condition in ('DAMAGED', 'LOST')
              and (CAST(:startDate AS timestamp) is null or loan.return_date_time >= CAST(:startDate AS timestamp))
              and (CAST(:endDate AS timestamp) is null or loan.return_date_time <= CAST(:endDate AS timestamp))
        )
        """, nativeQuery = true)
    BigDecimal sumEstimatedLossValue(
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate);

    @Query(value = """
        select case when count(*) = 0 then 0.0
         else 100.0 * sum(case when cast(loan.return_date_time as date) <= loan.due_local_date
                       then 1 else 0 end) / count(*) end
        from loans loan
        where loan.status = 'RETURNED'
          and loan.return_date_time is not null
          and loan.due_local_date is not null
          and (CAST(:startDate AS timestamp) is null or loan.return_date_time >= CAST(:startDate AS timestamp))
          and (CAST(:endDate AS timestamp) is null or loan.return_date_time <= CAST(:endDate AS timestamp))
        """, nativeQuery = true)
    Double onTimeReturnPercentage(
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate);
}