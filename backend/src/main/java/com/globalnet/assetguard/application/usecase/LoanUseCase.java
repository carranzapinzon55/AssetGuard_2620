package com.globalnet.assetguard.application.usecase;

import com.globalnet.assetguard.domain.model.Asset;
import com.globalnet.assetguard.domain.model.Loan;
import com.globalnet.assetguard.domain.model.LoanAuditPage;
import com.globalnet.assetguard.domain.model.LoanDashboardMetrics;
import com.globalnet.assetguard.domain.model.MaintenanceRecord;
import com.globalnet.assetguard.domain.model.User;
import com.globalnet.assetguard.domain.ports.output.AssetRepositoryPort;
import com.globalnet.assetguard.domain.ports.output.LoanRepositoryPort;
import com.globalnet.assetguard.domain.ports.output.MaintenanceRecordRepositoryPort;
import com.globalnet.assetguard.domain.ports.output.UserRepositoryPort;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.NoSuchElementException;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Service;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;

@Service
public class LoanUseCase {

    private final LoanRepositoryPort loanRepositoryPort;
    private final AssetRepositoryPort assetRepositoryPort;
    private final UserRepositoryPort userRepositoryPort;
    private final MaintenanceRecordRepositoryPort maintenanceRecordRepositoryPort;
    private final AuditLogUseCase auditLogUseCase;

    public LoanUseCase(
            LoanRepositoryPort loanRepositoryPort,
            AssetRepositoryPort assetRepositoryPort,
            UserRepositoryPort userRepositoryPort,
            MaintenanceRecordRepositoryPort maintenanceRecordRepositoryPort,
            AuditLogUseCase auditLogUseCase) {
        this.loanRepositoryPort = loanRepositoryPort;
        this.assetRepositoryPort = assetRepositoryPort;
        this.userRepositoryPort = userRepositoryPort;
        this.maintenanceRecordRepositoryPort = maintenanceRecordRepositoryPort;
        this.auditLogUseCase = auditLogUseCase;
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
        LocalDate today = LocalDate.now();
        List<Loan> overdueLoans = loanRepositoryPort.findByUserId(userId).stream()
            .filter(loan -> loan.getStatus() == Loan.Status.APPROVED
                && loan.getDueLocalDate() != null
                && loan.getDueLocalDate().isBefore(today))
            .toList();
        for (Loan overdueLoan : overdueLoans) {
            auditLogUseCase.recordOnce("LOAN_BECAME_OVERDUE", "LOAN", overdueLoan.getId(),
                "Préstamo vencido desde " + overdueLoan.getDueLocalDate());
        }
        if (loanRepositoryPort.hasOverdueApprovedLoan(userId, today)) {
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
        Loan savedLoan = loanRepositoryPort.save(loan);
        auditLogUseCase.record("LOAN_REQUESTED", "LOAN", savedLoan.getId(),
            "Solicitud de préstamo para el activo " + assetId);
        return savedLoan;
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

        String previousAssetStatus = asset.getStatus();
        asset.setStatus("LOANED");
        assetRepositoryPort.save(asset);
        loan.setStatus(Loan.Status.APPROVED);
        loan.setInspector(inspector);
        Loan savedLoan = loanRepositoryPort.save(loan);
        auditLogUseCase.record("LOAN_APPROVED", "LOAN", savedLoan.getId(),
            "Préstamo aprobado por inspector " + inspectorId);
        recordAssetStatusChange(asset, previousAssetStatus);
        return savedLoan;
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
        Loan savedLoan = loanRepositoryPort.save(loan);
        auditLogUseCase.record("LOAN_REJECTED", "LOAN", savedLoan.getId(),
            "Préstamo rechazado: " + loan.getRejectionReason());
        return savedLoan;
    }

    @Transactional
    public Loan returnAsset(Long loanId, Loan.ReturnCondition condition) {
        return returnAssetInternal(loanId, condition, null);
    }

    @Transactional
    public Loan returnAsset(Long loanId, Loan.ReturnCondition condition, Long borrowerId) {
        if (borrowerId == null) {
            throw new IllegalArgumentException("Borrower ID is required");
        }
        return returnAssetInternal(loanId, condition, borrowerId);
    }

    @Transactional
    public Loan returnAssetAsInspector(Long loanId, Loan.ReturnCondition condition, Long inspectorId) {
        requireActiveUserWithRole(inspectorId, "INSPECTOR");
        return returnAssetInternal(loanId, condition, null);
    }

    @Transactional
    public Loan returnAssetAsAdmin(Long loanId, Loan.ReturnCondition condition, Long adminId) {
        requireActiveUserWithRole(adminId, "ADMIN");
        return returnAssetInternal(loanId, condition, null);
    }

    private Loan returnAssetInternal(Long loanId, Loan.ReturnCondition condition, Long borrowerId) {
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

        String previousAssetStatus = asset.getStatus();
        asset.setStatus(switch (condition) {
            case GOOD -> "AVAILABLE";
            case DAMAGED -> "UNDER_MAINTENANCE";
            case LOST -> "LOST";
        });
        assetRepositoryPort.save(asset);

        if (condition == Loan.ReturnCondition.DAMAGED) {
            MaintenanceRecord maintenanceRecord = maintenanceRecordRepositoryPort.save(MaintenanceRecord.builder()
                .asset(asset)
                .reason("Daño reportado al devolver el préstamo " + loan.getId())
                .startDate(today)
                .build());
            auditLogUseCase.record("MAINTENANCE_OPENED", "MAINTENANCE", maintenanceRecord.getId(),
                "Intervención abierta por devolución dañada del activo " + asset.getId());
        }

        loan.setReturnCondition(condition);
        loan.setReturnDateTime(LocalDateTime.now());
        loan.setDelayDays(delayDays);
        loan.setStatus(Loan.Status.RETURNED);
        Loan savedLoan = loanRepositoryPort.save(loan);
        auditLogUseCase.record("LOAN_RETURNED", "LOAN", savedLoan.getId(),
            "Devolución registrada con condición " + condition);
        recordAssetStatusChange(asset, previousAssetStatus);
        if (delayDays > 0) {
            auditLogUseCase.recordOnce("LOAN_BECAME_OVERDUE", "LOAN", savedLoan.getId(),
                "Devolución con " + delayDays + " días de mora");
        }
        return savedLoan;
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

    private void recordAssetStatusChange(Asset asset, String previousStatus) {
        if (!java.util.Objects.equals(previousStatus, asset.getStatus())) {
            auditLogUseCase.record("ASSET_STATUS_CHANGED", "ASSET", asset.getId(),
                    previousStatus + " -> " + asset.getStatus());
        }
    }

    @EventListener(ApplicationReadyEvent.class)
    @Scheduled(cron = "0 0 0 * * *")
    @Transactional
    public void recordOverdueLoans() {
        LocalDate today = LocalDate.now();
        loanRepositoryPort.findAll().stream()
                .filter(loan -> loan.getStatus() == Loan.Status.APPROVED
                        && loan.getDueLocalDate() != null
                        && loan.getDueLocalDate().isBefore(today))
                .forEach(loan -> auditLogUseCase.recordOnce(
                        "LOAN_BECAME_OVERDUE", "LOAN", loan.getId(),
                        "Préstamo vencido desde " + loan.getDueLocalDate()));
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

    public LoanDashboardMetrics dashboardMetrics(LocalDateTime startDate, LocalDateTime endDate) {
        if (startDate != null && endDate != null && startDate.isAfter(endDate)) {
            throw new IllegalArgumentException("startDate must be before or equal to endDate");
        }
        return loanRepositoryPort.calculateDashboardMetrics(startDate, endDate);
    }
}
