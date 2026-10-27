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
import org.springframework.stereotype.Repository;

@Repository
public interface LoanJpaRepository extends JpaRepository<LoanEntity, Long> {

	boolean existsByUser_IdAndStatusAndDueLocalDateBeforeAndReturnDateTimeIsNull(
			Long userId, Loan.Status status, LocalDate today);

	    @EntityGraph(attributePaths = {"user", "asset", "inspector"})
	    List<LoanEntity> findByUser_IdOrderByRequestDateDesc(Long userId);

	    @EntityGraph(attributePaths = {"user", "asset", "inspector"})
	    @Query("""
		    select loan from LoanEntity loan
		    join loan.asset asset
		    where (:serialNumber is null or lower(asset.serialNumber) = lower(:serialNumber))
		      and (:technicianId is null or loan.user.id = :technicianId)
		      and (:startDate is null or loan.requestDate >= :startDate)
		      and (:endDate is null or loan.requestDate <= :endDate)
		      and (:status is null or loan.status = :status)
		    order by loan.requestDate desc, loan.id desc
		    """)
	    Page<LoanEntity> searchAudit(
		    @Param("serialNumber") String serialNumber,
		    @Param("technicianId") Long technicianId,
		    @Param("startDate") LocalDateTime startDate,
		    @Param("endDate") LocalDateTime endDate,
		    @Param("status") Loan.Status status,
		    Pageable pageable);

	    @Query(value = """
		    select coalesce(sum(asset.estimated_value), 0)
		    from assets asset
		    where asset.id in (
			select distinct loan.asset_id from loans loan
			where loan.return_condition in ('DAMAGED', 'LOST')
		    )
		    """, nativeQuery = true)
	    BigDecimal sumEstimatedLossValue();

	    @Query(value = """
		    select case when count(*) = 0 then 0.0
			 else 100.0 * sum(case when cast(loan.return_date_time as date) <= loan.due_local_date
					       then 1 else 0 end) / count(*) end
		    from loans loan
		    where loan.status = 'RETURNED'
		      and loan.return_date_time is not null
		      and loan.due_local_date is not null
		    """, nativeQuery = true)
	    Double onTimeReturnPercentage();
}