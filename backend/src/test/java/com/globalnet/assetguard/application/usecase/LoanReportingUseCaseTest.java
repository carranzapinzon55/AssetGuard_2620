package com.globalnet.assetguard.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.globalnet.assetguard.domain.model.Loan;
import com.globalnet.assetguard.domain.model.LoanAuditPage;
import com.globalnet.assetguard.domain.model.LoanDashboardMetrics;
import com.globalnet.assetguard.domain.model.AssetModelMetrics;
import com.globalnet.assetguard.domain.ports.output.AssetRepositoryPort;
import com.globalnet.assetguard.domain.ports.output.LoanRepositoryPort;
import com.globalnet.assetguard.domain.ports.output.UserRepositoryPort;
import com.globalnet.assetguard.infrastructure.outbound.persistence.AssetJpaRepository;
import com.globalnet.assetguard.infrastructure.outbound.persistence.LoanJpaRepository;
import com.globalnet.assetguard.infrastructure.outbound.persistence.LostAssetReportJpaRepository;
import com.globalnet.assetguard.infrastructure.outbound.persistence.MaintenanceRecordJpaRepository;
import com.globalnet.assetguard.infrastructure.outbound.persistence.adapter.LoanPersistenceAdapter;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class LoanReportingUseCaseTest {

    @Mock
    private LoanRepositoryPort loanRepositoryPort;

    @Mock
    private AssetRepositoryPort assetRepositoryPort;

    @Mock
    private UserRepositoryPort userRepositoryPort;

    @Mock
    private LoanJpaRepository loanJpaRepository;

    @Mock
    private AssetJpaRepository assetJpaRepository;

    @Mock
    private MaintenanceRecordJpaRepository maintenanceRecordJpaRepository;

    @Mock
    private LostAssetReportJpaRepository lostAssetReportJpaRepository;

    @InjectMocks
    private LoanUseCase loanUseCase;

    @Test
    void auditLogsDefaultsPaginationAndDelegatesFilters() {
        LoanAuditPage expected = new LoanAuditPage(List.of(), 0, 0, 20);
        when(loanRepositoryPort.searchAudit(null, 12L, null, null, Loan.Status.RETURNED, 0, 20))
                .thenReturn(expected);

        LoanAuditPage result = loanUseCase.auditLogs(
                null, 12L, null, null, Loan.Status.RETURNED, null, null);

        assertEquals(expected, result);
        verify(loanRepositoryPort).searchAudit(null, 12L, null, null, Loan.Status.RETURNED, 0, 20);
    }

    @Test
    void auditLogsRejectsInvalidPageSizeAndDateRange() {
        assertThrows(IllegalArgumentException.class,
                () -> loanUseCase.auditLogs(null, null, null, null, null, -1, 20));
        assertThrows(IllegalArgumentException.class,
                () -> loanUseCase.auditLogs(null, null, null, null, null, 0, 101));
        assertThrows(IllegalArgumentException.class,
                () -> loanUseCase.auditLogs(null, null,
                        LocalDateTime.now(), LocalDateTime.now().minusDays(1), null, 0, 20));
    }

    @Test
    void dashboardMetricsDelegatesAggregateQuery() {
        LoanDashboardMetrics expected = new LoanDashboardMetrics(
                new BigDecimal("125.00"), new BigDecimal("0.00"), 75.0, 4, 12, 5, 2, 1,
                List.of(new AssetModelMetrics("Laptop", 4, 2)));
        when(loanRepositoryPort.calculateDashboardMetrics()).thenReturn(expected);

        assertEquals(expected, loanUseCase.dashboardMetrics());
        verify(loanRepositoryPort).calculateDashboardMetrics();
    }

    @Test
    void dashboardMetricsWithDateRangeDelegatesAggregateQuery() {
        LocalDateTime start = LocalDateTime.of(2026, 11, 4, 0, 0, 0);
        LocalDateTime end = LocalDateTime.of(2026, 11, 30, 23, 59, 59, 999_000_000);
        LoanDashboardMetrics expected = new LoanDashboardMetrics(
                new BigDecimal("250.00"), new BigDecimal("50.00"), 85.0, 3, 10, 6, 1, 0,
                List.of(new AssetModelMetrics("Monitor", 3, 2)));
        when(loanRepositoryPort.calculateDashboardMetrics(start, end)).thenReturn(expected);

        LoanDashboardMetrics result = loanUseCase.dashboardMetrics(start, end);

        assertEquals(expected, result);
        verify(loanRepositoryPort).calculateDashboardMetrics(start, end);
    }

    @Test
    void dashboardMetricsRejectsStartDateAfterEndDate() {
        LocalDateTime start = LocalDateTime.of(2026, 11, 30, 0, 0, 0);
        LocalDateTime end = LocalDateTime.of(2026, 11, 4, 0, 0, 0);

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> loanUseCase.dashboardMetrics(start, end));

        assertEquals("startDate must be before or equal to endDate", exception.getMessage());
    }

    @Test
    void loanPersistenceAdapterCalculatesEstimatedLossCombiningLostLoansAndLostReports() {
        LoanPersistenceAdapter adapter = new LoanPersistenceAdapter(
                loanJpaRepository, assetJpaRepository, maintenanceRecordJpaRepository, lostAssetReportJpaRepository);

        when(loanJpaRepository.sumEstimatedLossValue(null, null)).thenReturn(new BigDecimal("250.00"));
        when(lostAssetReportJpaRepository.sumEstimatedLossValue(null, null)).thenReturn(new BigDecimal("150.00"));
        when(maintenanceRecordJpaRepository.sumCostsForStartDateRange(null, null)).thenReturn(40.0);
        when(loanJpaRepository.onTimeReturnPercentage(null, null)).thenReturn(80.0);
        when(assetJpaRepository.countByStatusIn(any())).thenReturn(2L);
        when(assetJpaRepository.count()).thenReturn(10L);
        when(assetJpaRepository.summarizeByModel()).thenReturn(List.of());

        LoanDashboardMetrics metrics = adapter.calculateDashboardMetrics();

        assertEquals(0, new BigDecimal("400.00").compareTo(metrics.estimatedLossValue()));
        assertEquals(0, new BigDecimal("440.00").compareTo(metrics.totalEconomicLoss()));
        verify(loanJpaRepository).sumEstimatedLossValue(null, null);
        verify(lostAssetReportJpaRepository).sumEstimatedLossValue(null, null);
    }

    @Test
    void loanPersistenceAdapterFiltersEstimatedLossByDateRangeForLoansAndLostReports() {
        LoanPersistenceAdapter adapter = new LoanPersistenceAdapter(
                loanJpaRepository, assetJpaRepository, maintenanceRecordJpaRepository, lostAssetReportJpaRepository);

        LocalDateTime start = LocalDateTime.of(2026, 11, 1, 0, 0);
        LocalDateTime end = LocalDateTime.of(2026, 11, 30, 23, 59, 59);

        when(loanJpaRepository.sumEstimatedLossValue(start, end)).thenReturn(new BigDecimal("300.00"));
        when(lostAssetReportJpaRepository.sumEstimatedLossValue(start, end)).thenReturn(new BigDecimal("200.00"));
        when(maintenanceRecordJpaRepository.sumCostsForStartDateRange(start.toLocalDate(), end.toLocalDate())).thenReturn(50.0);
        when(loanJpaRepository.onTimeReturnPercentage(start, end)).thenReturn(90.0);
        when(assetJpaRepository.countByStatusIn(any())).thenReturn(1L);
        when(assetJpaRepository.count()).thenReturn(5L);
        when(assetJpaRepository.summarizeByModel()).thenReturn(List.of());

        LoanDashboardMetrics metrics = adapter.calculateDashboardMetrics(start, end);

        assertEquals(0, new BigDecimal("500.00").compareTo(metrics.estimatedLossValue()));
        assertEquals(0, new BigDecimal("550.00").compareTo(metrics.totalEconomicLoss()));
        verify(loanJpaRepository).sumEstimatedLossValue(start, end);
        verify(lostAssetReportJpaRepository).sumEstimatedLossValue(start, end);
    }

    @Test
    void loanPersistenceAdapterAvoidsDuplicateLossWhenReportBelongsToLostLoan() {
        LoanPersistenceAdapter adapter = new LoanPersistenceAdapter(
                loanJpaRepository, assetJpaRepository, maintenanceRecordJpaRepository, lostAssetReportJpaRepository);

        when(loanJpaRepository.sumEstimatedLossValue(null, null)).thenReturn(new BigDecimal("350.00"));
        when(lostAssetReportJpaRepository.sumEstimatedLossValue(null, null)).thenReturn(BigDecimal.ZERO);
        when(maintenanceRecordJpaRepository.sumCostsForStartDateRange(null, null)).thenReturn(0.0);
        when(loanJpaRepository.onTimeReturnPercentage(null, null)).thenReturn(100.0);
        when(assetJpaRepository.countByStatusIn(any())).thenReturn(0L);
        when(assetJpaRepository.count()).thenReturn(3L);
        when(assetJpaRepository.summarizeByModel()).thenReturn(List.of());

        LoanDashboardMetrics metrics = adapter.calculateDashboardMetrics();

        assertEquals(0, new BigDecimal("350.00").compareTo(metrics.estimatedLossValue()));
        assertEquals(0, new BigDecimal("350.00").compareTo(metrics.totalEconomicLoss()));
    }
}