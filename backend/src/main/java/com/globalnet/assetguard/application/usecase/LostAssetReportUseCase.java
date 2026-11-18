package com.globalnet.assetguard.application.usecase;

import com.globalnet.assetguard.domain.model.Asset;
import com.globalnet.assetguard.domain.model.Loan;
import com.globalnet.assetguard.domain.model.LostAssetReport;
import com.globalnet.assetguard.domain.model.User;
import com.globalnet.assetguard.domain.ports.output.AssetRepositoryPort;
import com.globalnet.assetguard.domain.ports.output.LoanRepositoryPort;
import com.globalnet.assetguard.domain.ports.output.LostAssetReportRepositoryPort;
import com.globalnet.assetguard.domain.ports.output.UserRepositoryPort;
import java.time.LocalDateTime;
import java.util.List;
import java.util.NoSuchElementException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LostAssetReportUseCase {

    private final LostAssetReportRepositoryPort lostAssetReportRepositoryPort;
    private final AssetRepositoryPort assetRepositoryPort;
    private final LoanRepositoryPort loanRepositoryPort;
    private final UserRepositoryPort userRepositoryPort;
    private final AuditLogUseCase auditLogUseCase;

    public LostAssetReportUseCase(
            LostAssetReportRepositoryPort lostAssetReportRepositoryPort,
            AssetRepositoryPort assetRepositoryPort,
            LoanRepositoryPort loanRepositoryPort,
            UserRepositoryPort userRepositoryPort,
            AuditLogUseCase auditLogUseCase) {
        this.lostAssetReportRepositoryPort = lostAssetReportRepositoryPort;
        this.assetRepositoryPort = assetRepositoryPort;
        this.loanRepositoryPort = loanRepositoryPort;
        this.userRepositoryPort = userRepositoryPort;
        this.auditLogUseCase = auditLogUseCase;
    }

    @Transactional
    public LostAssetReport reportLost(Long assetId, Long loanId, Long reportedByUserId, String notes) {
        Asset asset = assetRepositoryPort.findById(assetId)
                .orElseThrow(() -> new NoSuchElementException("Asset not found with ID: " + assetId));
        Loan loan = loanId != null ? loanRepositoryPort.findById(loanId).orElse(null) : null;
        User user = reportedByUserId != null ? userRepositoryPort.findById(reportedByUserId).orElse(null) : null;

        LostAssetReport report = LostAssetReport.builder()
                .asset(asset)
                .loan(loan)
                .reportedByUser(user)
                .reportedAt(LocalDateTime.now())
                .notes(notes != null ? notes.trim() : null)
                .acknowledged(false)
                .build();

        LostAssetReport saved = lostAssetReportRepositoryPort.save(report);
        auditLogUseCase.record("ASSET_REPORTED_LOST", "ASSET", asset.getId(),
                "Activo reportado como perdido: " + (notes != null ? notes : ""));
        return saved;
    }

    @Transactional
    public LostAssetReport acknowledge(Long reportId) {
        LostAssetReport report = lostAssetReportRepositoryPort.findById(reportId)
                .orElseThrow(() -> new NoSuchElementException("Lost asset report not found with ID: " + reportId));
        report.setAcknowledged(true);
        LostAssetReport saved = lostAssetReportRepositoryPort.save(report);
        auditLogUseCase.record("LOST_REPORT_ACKNOWLEDGED", "LOST_REPORT", reportId,
                "Reporte de activo perdido marcado como revisado");
        return saved;
    }

    public List<LostAssetReport> findAll() {
        return lostAssetReportRepositoryPort.findAll();
    }

    public long countUnacknowledged() {
        return lostAssetReportRepositoryPort.countUnacknowledged();
    }
}
