package com.globalnet.assetguard.application.usecase;

import com.globalnet.assetguard.domain.model.Asset;
import com.globalnet.assetguard.domain.model.Loan;
import com.globalnet.assetguard.domain.model.LoanAuditPage;
import com.globalnet.assetguard.domain.model.LoanDashboardMetrics;
import com.globalnet.assetguard.domain.model.User;
import com.globalnet.assetguard.domain.ports.output.AssetRepositoryPort;
import com.globalnet.assetguard.domain.ports.output.LoanRepositoryPort;
import com.globalnet.assetguard.domain.ports.output.UserRepositoryPort;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.NoSuchElementException;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Service;

@Service
public class LoanUseCase {

    private final LoanRepositoryPort loanRepositoryPort;
    private final AssetRepositoryPort assetRepositoryPort;
    private final UserRepositoryPort userRepositoryPort;

    public LoanUseCase(
            LoanRepositoryPort loanRepositoryPort,
            AssetRepositoryPort assetRepositoryPort,
            UserRepositoryPort userRepositoryPort) {
        this.loanRepositoryPort = loanRepositoryPort;
        this.assetRepositoryPort = assetRepositoryPort;
        this.userRepositoryPort = userRepositoryPort;
    }

    @Transactional
    public Loan requestLoan(Long userId, Long assetId, LocalDate dueDate) {
        if (userId == null || assetId == null || dueDate == null) {
            throw new IllegalArgumentException("User ID, asset ID, and due date are required");
        }
        if (dueDate.isBefore(LocalDate.now())) {
            throw new IllegalArgumentException("Due date must not be in the past");
        }

        User user = requireActiveUserWithRole(userId, "TECHNICIAN");
        if (loanRepositoryPort.hasOverdueApprovedLoan(userId, LocalDate.now())) {
            throw new IllegalStateException("User has an overdue loan");
        }

        Asset asset = requireAsset(assetId);
        if (!"AVAILABLE".equals(asset.getStatus())) {
            throw new IllegalStateException("Asset is not available for loan");
        }

        Loan loan = Loan.builder()
                .user(user)
                .asset(asset)
                .requestDate(LocalDateTime.now())
                .dueLocalDate(dueDate)
                .status(Loan.Status.PENDING)
                .delayDays(0)
                .build();
        return loanRepositoryPort.save(loan);
    }

    @Transactional
    public Loan approveLoan(Long loanId, Long inspectorId) {
        User inspector = requireActiveUserWithRole(inspectorId, "INSPECTOR");
        Loan loan = requireLoan(loanId);
        requireStatus(loan, Loan.Status.PENDING);

        Asset asset = requireAssetFromLoan(loan);
        if (!"AVAILABLE".equals(asset.getStatus())) {
            throw new IllegalStateException("Asset is no longer available for loan");
        }

        asset.setStatus("LOANED");
        assetRepositoryPort.save(asset);
        loan.setStatus(Loan.Status.APPROVED);
        loan.setInspector(inspector);
        return loanRepositoryPort.save(loan);
    }

    @Transactional
    public Loan rejectLoan(Long loanId, Long inspectorId, String reason) {
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("Rejection reason must not be blank");
        }
        User inspector = requireActiveUserWithRole(inspectorId, "INSPECTOR");
        Loan loan = requireLoan(loanId);
        requireStatus(loan, Loan.Status.PENDING);

        loan.setStatus(Loan.Status.REJECTED);
        loan.setInspector(inspector);
        loan.setRejectionReason(reason.trim());
        return loanRepositoryPort.save(loan);
    }

    @Transactional
    public Loan returnAsset(Long loanId, Loan.ReturnCondition condition) {
        return returnAsset(loanId, condition, null);
    }

    @Transactional
    public Loan returnAsset(Long loanId, Loan.ReturnCondition condition, Long borrowerId) {
        if (condition == null) {
            throw new IllegalArgumentException("Return condition is required");
        }
        Loan loan = requireLoan(loanId);
        requireStatus(loan, Loan.Status.APPROVED);
        if (borrowerId != null
                && (loan.getUser() == null || !borrowerId.equals(loan.getUser().getId()))) {
            throw new IllegalStateException("Only the borrower can return this loan");
        }
        Asset asset = requireAssetFromLoan(loan);

        LocalDate today = LocalDate.now();
        int delayDays = loan.getDueLocalDate() == null
                ? 0
                : Math.toIntExact(Math.max(0, ChronoUnit.DAYS.between(loan.getDueLocalDate(), today)));

        asset.setStatus(switch (condition) {
            case GOOD -> "AVAILABLE";
            case DAMAGED -> "UNDER_MAINTENANCE";
            case LOST -> "LOST";
        });
        assetRepositoryPort.save(asset);

        loan.setReturnCondition(condition);
        loan.setReturnDateTime(LocalDateTime.now());
        loan.setDelayDays(delayDays);
        loan.setStatus(Loan.Status.RETURNED);
        return loanRepositoryPort.save(loan);
    }

    private User requireActiveUserWithRole(Long userId, String requiredRole) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID must not be null");
        }
        User user = userRepositoryPort.findById(userId)
                .orElseThrow(() -> new NoSuchElementException("User not found with ID: " + userId));
        if (!Boolean.TRUE.equals(user.getStatus())) {
            throw new IllegalStateException("User is inactive");
        }
        if (user.getRole() == null || !requiredRole.equalsIgnoreCase(user.getRole())) {
            throw new IllegalStateException("User must have role " + requiredRole);
        }
        return user;
    }

    private Asset requireAsset(Long assetId) {
        return assetRepositoryPort.findById(assetId)
                .orElseThrow(() -> new NoSuchElementException("Asset not found with ID: " + assetId));
    }

    private Asset requireAssetFromLoan(Loan loan) {
        if (loan.getAsset() == null || loan.getAsset().getId() == null) {
            throw new IllegalStateException("Loan does not reference an asset");
        }
        return requireAsset(loan.getAsset().getId());
    }

    private Loan requireLoan(Long loanId) {
        if (loanId == null) {
            throw new IllegalArgumentException("Loan ID must not be null");
        }
        return loanRepositoryPort.findById(loanId)
                .orElseThrow(() -> new NoSuchElementException("Loan not found with ID: " + loanId));
    }

    private void requireStatus(Loan loan, Loan.Status expectedStatus) {
        if (loan.getStatus() != expectedStatus) {
            throw new IllegalStateException("Loan must be in status " + expectedStatus);
        }
    }

    public List<Loan> findAll() {
        return loanRepositoryPort.findAll();
    }

    public List<Loan> myLoanHistory(Long technicianId) {
        if (technicianId == null) {
            throw new IllegalArgumentException("Technician ID must not be null");
        }
        return loanRepositoryPort.findByUserId(technicianId);
    }

    public LoanAuditPage auditLogs(
            String serialNumber,
            Long technicianId,
            LocalDateTime startDate,
            LocalDateTime endDate,
            Loan.Status status,
            Integer page,
            Integer limit) {
        int normalizedPage = page == null ? 0 : page;
        int normalizedLimit = limit == null ? 20 : limit;
        if (normalizedPage < 0) {
            throw new IllegalArgumentException("page must be zero or greater");
        }
        if (normalizedLimit < 1 || normalizedLimit > 100) {
            throw new IllegalArgumentException("limit must be between 1 and 100");
        }
        if (startDate != null && endDate != null && startDate.isAfter(endDate)) {
            throw new IllegalArgumentException("startDate must be before or equal to endDate");
        }
        return loanRepositoryPort.searchAudit(
                serialNumber, technicianId, startDate, endDate, status, normalizedPage, normalizedLimit);
    }

    public LoanDashboardMetrics dashboardMetrics() {
        return loanRepositoryPort.calculateDashboardMetrics();
    }
}
