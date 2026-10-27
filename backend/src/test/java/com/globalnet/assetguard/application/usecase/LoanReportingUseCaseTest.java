package com.globalnet.assetguard.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.globalnet.assetguard.domain.model.Loan;
import com.globalnet.assetguard.domain.model.LoanAuditPage;
import com.globalnet.assetguard.domain.model.LoanDashboardMetrics;
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
        LoanDashboardMetrics expected = new LoanDashboardMetrics(new BigDecimal("125.00"), 75.0, 4);
        when(loanRepositoryPort.calculateDashboardMetrics()).thenReturn(expected);

        assertEquals(expected, loanUseCase.dashboardMetrics());
        verify(loanRepositoryPort).calculateDashboardMetrics();
    }
}