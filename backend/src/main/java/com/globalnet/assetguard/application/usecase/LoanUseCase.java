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
    private final LostAssetReportUseCase lostAssetReportUseCase;

    public LoanUseCase(
            LoanRepositoryPort loanRepositoryPort,
            AssetRepositoryPort assetRepositoryPort,
            UserRepositoryPort userRepositoryPort,
            MaintenanceRecordRepositoryPort maintenanceRecordRepositoryPort,
            AuditLogUseCase auditLogUseCase,
            LostAssetReportUseCase lostAssetReportUseCase) {
        this.loanRepositoryPort = loanRepositoryPort;
        this.assetRepositoryPort = assetRepositoryPort;
        this.userRepositoryPort = userRepositoryPort;
        this.maintenanceRecordRepositoryPort = maintenanceRecordRepositoryPort;
        this.auditLogUseCase = auditLogUseCase;
        this.lostAssetReportUseCase = lostAssetReportUseCase;
    }

    @Transactional
    public Loan requestLoan(Long userId, Long assetId, LocalDate dueDate) {
        return requestLoan(userId, assetId, dueDate, null, null, null);
    }

    @Transactional
    public Loan requestLoan(Long userId, Long assetId, LocalDate dueDate, LocalDate startDate, String startTime, String endTime) {
        if (userId == null || assetId == null || dueDate == null) {
            throw new IllegalArgumentException("User ID, asset ID, and due date are required");
        }
        LocalDate effectiveStartDate = startDate != null ? startDate : LocalDate.now();
        LocalDate today = LocalDate.now();
        if (effectiveStartDate.isBefore(today)) {
            throw new IllegalArgumentException("Start date must not be in the past");
        }
        if (dueDate.isBefore(effectiveStartDate)) {
            throw new IllegalArgumentException("Due date must not be before start date");
        }

        String sTime = (startTime != null && !startTime.isBlank()) ? startTime : "08:00";
        String eTime = (endTime != null && !endTime.isBlank()) ? endTime : "18:00";
        java.time.LocalTime parsedStartTime = java.time.LocalTime.parse(sTime);
        java.time.LocalTime parsedEndTime = java.time.LocalTime.parse(eTime);

        if (dueDate.isEqual(effectiveStartDate)) {
            long minutes = java.time.Duration.between(parsedStartTime, parsedEndTime).toMinutes();
            if (minutes < 60) {
                throw new IllegalArgumentException("Loan duration must be at least 1 hour");
            }
        }

        User user = requireActiveUserWithRole(userId, "TECHNICIAN");
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
        int available = assetRepositoryPort.calculateAvailableQuantity(assetId);
        if (available <= 0) {
            throw new IllegalStateException("Asset is not available for loan");
        }

        LocalDateTime startDateTime = effectiveStartDate.atTime(parsedStartTime);

        Loan loan = Loan.builder()
                .user(user)
                .asset(asset)
                .requestDate(startDateTime)
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
        int available = assetRepositoryPort.calculateAvailableQuantity(asset.getId());
        if (available <= 0) {
            throw new IllegalStateException("Asset is no longer available for loan");
        }

        String previousAssetStatus = asset.getStatus();
        int remaining = available - 1;
        if (remaining <= 0) {
            asset.setStatus("LOANED");
        } else {
            asset.setStatus("AVAILABLE");
        }
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
    public Loan createApprovedLoan(
            Long assetId,
            Long technicianId,
            Long inspectorId,
            LocalDate startDate,
            LocalDate dueDate,
            String startTime,
            String endTime) {
        if (assetId == null || technicianId == null || dueDate == null) {
            throw new IllegalArgumentException("assetId, technicianId, and dueDate are required");
        }
        User technician = requireActiveUserWithRole(technicianId, "TECHNICIAN");
        User inspector = inspectorId != null ? userRepositoryPort.findById(inspectorId).orElse(null) : null;
        Asset asset = requireAsset(assetId);
        int available = assetRepositoryPort.calculateAvailableQuantity(assetId);
        if (available <= 0) {
            throw new IllegalStateException("Asset is not available for loan");
        }

        LocalDate start = startDate != null ? startDate : LocalDate.now();
        String sTime = (startTime != null && !startTime.isBlank()) ? startTime : "08:00";
        LocalDateTime startDateTime = start.atTime(java.time.LocalTime.parse(sTime));

        String previousStatus = asset.getStatus();
        int remaining = available - 1;
        if (remaining <= 0) {
            asset.setStatus("LOANED");
        } else {
            asset.setStatus("AVAILABLE");
        }
        assetRepositoryPort.save(asset);

        Loan loan = Loan.builder()
                .asset(asset)
                .user(technician)
                .inspector(inspector)
                .requestDate(startDateTime)
                .dueLocalDate(dueDate)
                .status(Loan.Status.APPROVED)
                .delayDays(0)
                .build();
        Loan savedLoan = loanRepositoryPort.save(loan);
        auditLogUseCase.record("LOAN_APPROVED", "LOAN", savedLoan.getId(),
                "Préstamo directo asignado y aprobado para " + technician.getFullName());
        recordAssetStatusChange(asset, previousStatus);
        return savedLoan;
    }

    @Transactional
    public Loan returnAsset(Long loanId, Loan.ReturnCondition condition) {
        return returnAssetInternal(loanId, condition, null, null);
    }

    @Transactional
    public Loan returnAsset(Long loanId, Loan.ReturnCondition condition, String damageDescription) {
        return returnAssetInternal(loanId, condition, null, damageDescription);
    }

    @Transactional
    public Loan returnAsset(Long loanId, Loan.ReturnCondition condition, Long borrowerId) {
        return returnAsset(loanId, condition, borrowerId, null);
    }

    @Transactional
    public Loan returnAsset(Long loanId, Loan.ReturnCondition condition, Long borrowerId, String damageDescription) {
        if (borrowerId == null) {
            throw new IllegalArgumentException("Borrower ID is required");
        }
        return returnAssetInternal(loanId, condition, borrowerId, damageDescription);
    }

    @Transactional
    public Loan returnAssetAsInspector(Long loanId, Loan.ReturnCondition condition, Long inspectorId) {
        return returnAssetAsInspector(loanId, condition, inspectorId, null);
    }

    @Transactional
    public Loan returnAssetAsInspector(Long loanId, Loan.ReturnCondition condition, Long inspectorId, String damageDescription) {
        requireActiveUserWithRole(inspectorId, "INSPECTOR");
        return returnAssetInternal(loanId, condition, null, damageDescription, inspectorId);
    }

    @Transactional
    public Loan returnAssetAsAdmin(Long loanId, Loan.ReturnCondition condition, Long adminId) {
        return returnAssetAsAdmin(loanId, condition, adminId, null);
    }

    @Transactional
    public Loan returnAssetAsAdmin(Long loanId, Loan.ReturnCondition condition, Long adminId, String damageDescription) {
        requireActiveUserWithRole(adminId, "ADMIN");
        return returnAssetInternal(loanId, condition, null, damageDescription, adminId);
    }

    private Loan returnAssetInternal(Long loanId, Loan.ReturnCondition condition, Long borrowerId, String damageDescription) {
        return returnAssetInternal(loanId, condition, borrowerId, damageDescription, borrowerId);
    }

    private Loan returnAssetInternal(Long loanId, Loan.ReturnCondition condition, Long borrowerId, String damageDescription, Long operatorId) {
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
        User custodian = loan.getUser();
        User operator = operatorId != null ? userRepositoryPort.findById(operatorId).orElse(null) : null;
        String custodianSummary = custodian != null
                ? formatUserInfo(custodian, "técnico") + " · Préstamo #" + loan.getId()
                : "Sin técnico asignado · Préstamo #" + loan.getId();
        String operatorSummary = operator != null
                ? "Recibido por: " + formatUserInfo(operator, "inspector")
                : null;
        String diagnostic = (damageDescription != null && !damageDescription.isBlank()) ? damageDescription.trim() : null;

        if (condition == Loan.ReturnCondition.GOOD) {
            int available = assetRepositoryPort.calculateAvailableQuantity(asset.getId()) + 1;
            if (available > 0) {
                asset.setStatus("AVAILABLE");
            }
            assetRepositoryPort.save(asset);
        } else if (condition == Loan.ReturnCondition.DAMAGED) {
            String reason = (diagnostic != null ? diagnostic : "Daño reportado al devolver el préstamo " + loan.getId())
                    + " [Custodio: " + custodianSummary + "]"
                    + (operatorSummary != null ? " [" + operatorSummary + "]" : "");
            MaintenanceRecord maintenanceRecord = maintenanceRecordRepositoryPort.save(MaintenanceRecord.builder()
                .asset(asset)
                .reason(reason)
                .cost(null)
                .startDate(today)
                .build());
            auditLogUseCase.record("MAINTENANCE_OPENED", "MAINTENANCE", maintenanceRecord.getId(),
                "Intervención abierta por devolución dañada del activo " + asset.getId() + " (Custodio: " + custodianSummary + (operatorSummary != null ? ", " + operatorSummary : "") + "): " + (diagnostic != null ? diagnostic : "Sin detalle adicional"));
            int available = assetRepositoryPort.calculateAvailableQuantity(asset.getId());
            if (available <= 0) {
                asset.setStatus("UNDER_MAINTENANCE");
            } else {
                asset.setStatus("AVAILABLE");
            }
            assetRepositoryPort.save(asset);
        } else if (condition == Loan.ReturnCondition.LOST) {
            String notes = (diagnostic != null ? diagnostic : "Equipo reportado no localizado al registrar devolución del préstamo " + loan.getId())
                    + " [Custodio: " + custodianSummary + "]"
                    + (operatorSummary != null ? " [" + operatorSummary + "]" : "");
            Long responsibleUserId = (custodian != null && custodian.getId() != null)
                    ? custodian.getId()
                    : (operatorId != null ? operatorId : borrowerId);
            lostAssetReportUseCase.reportLost(asset.getId(), loan.getId(), responsibleUserId, notes);
            int available = assetRepositoryPort.calculateAvailableQuantity(asset.getId());
            if (available <= 0) {
                asset.setStatus("LOST");
            } else {
                asset.setStatus("AVAILABLE");
            }
            assetRepositoryPort.save(asset);
        }

        loan.setReturnCondition(condition);
        loan.setReturnDateTime(LocalDateTime.now());
        loan.setDelayDays(delayDays);
        loan.setStatus(Loan.Status.RETURNED);
        Loan savedLoan = loanRepositoryPort.save(loan);

        String returnAudit = "Devolución registrada con condición " + condition;
        if (condition != Loan.ReturnCondition.GOOD) {
            if (custodian != null) {
                returnAudit += " | Responsable: " + formatUserInfo(custodian, "técnico");
            }
            if (operator != null) {
                returnAudit += " | Inspector/Receptor: " + formatUserInfo(operator, "inspector");
            }
        }
        auditLogUseCase.record("LOAN_RETURNED", "LOAN", savedLoan.getId(), returnAudit);
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

    private String formatUserInfo(User user, String fallbackRole) {
        if (user == null) {
            return "Sin " + fallbackRole + " asignado";
        }
        String name = user.getFullName() != null && !user.getFullName().isBlank()
                ? user.getFullName().trim()
                : (user.getEmail() != null && !user.getEmail().isBlank() ? user.getEmail().trim() : "Usuario #" + user.getId());
        return user.getEmail() != null && !user.getEmail().isBlank() && !name.equalsIgnoreCase(user.getEmail().trim())
                ? name + " (" + user.getEmail().trim() + ")"
                : name;
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
