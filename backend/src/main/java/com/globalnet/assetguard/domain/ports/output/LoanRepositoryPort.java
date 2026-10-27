package com.globalnet.assetguard.domain.ports.output;

import com.globalnet.assetguard.domain.model.Loan;
import com.globalnet.assetguard.domain.model.LoanAuditPage;
import com.globalnet.assetguard.domain.model.LoanDashboardMetrics;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface LoanRepositoryPort {

    Loan save(Loan loan);

    Optional<Loan> findById(Long id);

    List<Loan> findAll();

    boolean hasOverdueApprovedLoan(Long userId, LocalDate today);

    List<Loan> findByUserId(Long userId);

    LoanAuditPage searchAudit(
            String serialNumber,
            Long technicianId,
            LocalDateTime startDate,
            LocalDateTime endDate,
            Loan.Status status,
            int page,
            int limit);

    LoanDashboardMetrics calculateDashboardMetrics();
}