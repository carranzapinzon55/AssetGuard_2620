package com.globalnet.assetguard.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.globalnet.assetguard.domain.model.Loan;
import com.globalnet.assetguard.domain.model.LoanAuditPage;
import com.globalnet.assetguard.domain.model.LoanDashboardMetrics;
import com.globalnet.assetguard.domain.model.AssetModelMetrics;
import com.globalnet.assetguard.domain.ports.output.AssetRepositoryPort;
import com.globalnet.assetguard.domain.ports.output.LoanRepositoryPort;
import com.globalnet.assetguard.domain.ports.output.UserRepositoryPort;
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
}