package com.globalnet.assetguard.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.globalnet.assetguard.domain.model.Asset;
import com.globalnet.assetguard.domain.model.Loan;
import com.globalnet.assetguard.domain.model.User;
import com.globalnet.assetguard.domain.ports.output.AssetRepositoryPort;
import com.globalnet.assetguard.domain.ports.output.LoanRepositoryPort;
import com.globalnet.assetguard.domain.ports.output.UserRepositoryPort;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class LoanUseCaseTest {

    @Mock
    private LoanRepositoryPort loanRepositoryPort;

    @Mock
    private AssetRepositoryPort assetRepositoryPort;

    @Mock
    private UserRepositoryPort userRepositoryPort;

    @InjectMocks
    private LoanUseCase loanUseCase;

    private User technician;
    private User inspector;
    private Asset availableAsset;

    @BeforeEach
    void setUp() {
        technician = User.builder().id(10L).role("TECHNICIAN").status(true).build();
        inspector = User.builder().id(20L).role("INSPECTOR").status(true).build();
        availableAsset = Asset.builder().id(30L).status("AVAILABLE").build();
    }

    @Test
    void requestLoanCreatesPendingLoanWhenTechnicianHasNoOverdueLoan() {
        when(userRepositoryPort.findById(10L)).thenReturn(Optional.of(technician));
        when(loanRepositoryPort.hasOverdueApprovedLoan(eq(10L), any(LocalDate.class)))
                .thenReturn(false);
        when(assetRepositoryPort.findById(30L)).thenReturn(Optional.of(availableAsset));
        when(loanRepositoryPort.save(any(Loan.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Loan result = loanUseCase.requestLoan(10L, 30L, LocalDate.now().plusDays(7));

        assertEquals(Loan.Status.PENDING, result.getStatus());
        assertEquals(10L, result.getUser().getId());
        assertEquals(30L, result.getAsset().getId());
    }

    @Test
    void requestLoanRejectsTechnicianWithOverdueLoan() {
        when(userRepositoryPort.findById(10L)).thenReturn(Optional.of(technician));
        when(loanRepositoryPort.hasOverdueApprovedLoan(eq(10L), any(LocalDate.class)))
                .thenReturn(true);

        assertThrows(IllegalStateException.class,
                () -> loanUseCase.requestLoan(10L, 30L, LocalDate.now().plusDays(7)));
    }

    @Test
    void approveLoanChangesLoanAndAssetStatuses() {
        Loan pendingLoan = pendingLoan();
        when(userRepositoryPort.findById(20L)).thenReturn(Optional.of(inspector));
        when(loanRepositoryPort.findById(40L)).thenReturn(Optional.of(pendingLoan));
        when(assetRepositoryPort.findById(30L)).thenReturn(Optional.of(availableAsset));
        when(assetRepositoryPort.save(any(Asset.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(loanRepositoryPort.save(any(Loan.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Loan result = loanUseCase.approveLoan(40L, 20L);

        assertEquals(Loan.Status.APPROVED, result.getStatus());
        assertEquals("LOANED", availableAsset.getStatus());
        assertEquals(20L, result.getInspector().getId());
    }

    @Test
    void rejectLoanStoresReasonWithoutChangingAssetState() {
        Loan pendingLoan = pendingLoan();
        availableAsset.setStatus("LOANED");
        when(userRepositoryPort.findById(20L)).thenReturn(Optional.of(inspector));
        when(loanRepositoryPort.findById(40L)).thenReturn(Optional.of(pendingLoan));
        when(loanRepositoryPort.save(any(Loan.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Loan result = loanUseCase.rejectLoan(40L, 20L, "  No longer needed  ");

        assertEquals(Loan.Status.REJECTED, result.getStatus());
        assertEquals("No longer needed", result.getRejectionReason());
        assertEquals("LOANED", availableAsset.getStatus());
    }

    @Test
    void returnDamagedAssetRecordsDelayAndSetsMaintenanceStatus() {
        Loan approvedLoan = Loan.builder()
                .id(40L)
                .status(Loan.Status.APPROVED)
                .dueLocalDate(LocalDate.now().minusDays(3))
                .asset(Asset.builder().id(30L).build())
                .build();
        when(loanRepositoryPort.findById(40L)).thenReturn(Optional.of(approvedLoan));
        when(assetRepositoryPort.findById(30L)).thenReturn(Optional.of(availableAsset));
        when(assetRepositoryPort.save(any(Asset.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(loanRepositoryPort.save(any(Loan.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Loan result = loanUseCase.returnAsset(40L, Loan.ReturnCondition.DAMAGED);

        assertEquals(Loan.Status.RETURNED, result.getStatus());
        assertEquals(Loan.ReturnCondition.DAMAGED, result.getReturnCondition());
        assertEquals(3, result.getDelayDays());
        assertEquals("UNDER_MAINTENANCE", availableAsset.getStatus());
        verify(assetRepositoryPort).save(availableAsset);
    }

    private Loan pendingLoan() {
        return Loan.builder()
                .id(40L)
                .status(Loan.Status.PENDING)
                .asset(Asset.builder().id(30L).build())
                .build();
    }
}