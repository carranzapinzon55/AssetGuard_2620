package com.globalnet.assetguard.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.globalnet.assetguard.domain.model.Asset;
import com.globalnet.assetguard.domain.model.Loan;
import com.globalnet.assetguard.domain.model.MaintenanceRecord;
import com.globalnet.assetguard.domain.model.User;
import com.globalnet.assetguard.domain.ports.output.AssetRepositoryPort;
import com.globalnet.assetguard.domain.ports.output.LoanRepositoryPort;
import com.globalnet.assetguard.domain.ports.output.MaintenanceRecordRepositoryPort;
import com.globalnet.assetguard.domain.ports.output.UserRepositoryPort;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.ArgumentCaptor;
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

    @Mock
    private MaintenanceRecordRepositoryPort maintenanceRecordRepositoryPort;

    @Mock
    private AuditLogUseCase auditLogUseCase;

    @Mock
    private LostAssetReportUseCase lostAssetReportUseCase;

    @InjectMocks
    private LoanUseCase loanUseCase;

    private User technician;
    private User inspector;
    private User admin;
    private Asset availableAsset;

    @BeforeEach
    void setUp() {
        technician = User.builder().id(10L).fullName("Tech User").email("tech@globalnet.com").role("TECHNICIAN").status(true).build();
        inspector = User.builder().id(20L).fullName("Inspector User").email("inspector@globalnet.com").role("INSPECTOR").status(true).build();
        admin = User.builder().id(30L).fullName("Admin User").email("admin@globalnet.com").role("ADMIN").status(true).build();
        availableAsset = Asset.builder().id(30L).status("AVAILABLE").stockQuantity(1).availableQuantity(1).build();
        org.mockito.Mockito.lenient().when(assetRepositoryPort.calculateAvailableQuantity(any())).thenReturn(1);
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
        when(assetRepositoryPort.calculateAvailableQuantity(30L)).thenReturn(0);
        when(assetRepositoryPort.save(any(Asset.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(loanRepositoryPort.save(any(Loan.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(maintenanceRecordRepositoryPort.save(any(MaintenanceRecord.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        Loan result = loanUseCase.returnAsset(40L, Loan.ReturnCondition.DAMAGED);

        assertEquals(Loan.Status.RETURNED, result.getStatus());
        assertEquals(Loan.ReturnCondition.DAMAGED, result.getReturnCondition());
        assertEquals(3, result.getDelayDays());
        assertEquals("UNDER_MAINTENANCE", availableAsset.getStatus());
        verify(assetRepositoryPort).save(availableAsset);
        ArgumentCaptor<MaintenanceRecord> recordCaptor = ArgumentCaptor.forClass(MaintenanceRecord.class);
        verify(maintenanceRecordRepositoryPort).save(recordCaptor.capture());
        assertNull(recordCaptor.getValue().getEndDate());
        assertEquals(LocalDate.now(), recordCaptor.getValue().getStartDate());
        verify(auditLogUseCase).record("LOAN_RETURNED", "LOAN", 40L,
            "Devolución registrada con condición DAMAGED");
    }

    @Test
    void adminCanRegisterReturn() {
        Loan approvedLoan = Loan.builder()
                .id(40L)
                .status(Loan.Status.APPROVED)
                .asset(Asset.builder().id(30L).build())
                .build();
        when(userRepositoryPort.findById(30L)).thenReturn(Optional.of(admin));
        when(loanRepositoryPort.findById(40L)).thenReturn(Optional.of(approvedLoan));
        when(assetRepositoryPort.findById(30L)).thenReturn(Optional.of(availableAsset));
        when(assetRepositoryPort.calculateAvailableQuantity(30L)).thenReturn(0);
        when(assetRepositoryPort.save(any(Asset.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(loanRepositoryPort.save(any(Loan.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Loan result = loanUseCase.returnAssetAsAdmin(40L, Loan.ReturnCondition.GOOD, 30L);

        assertEquals(Loan.Status.RETURNED, result.getStatus());
        assertEquals(Loan.ReturnCondition.GOOD, result.getReturnCondition());
        verify(auditLogUseCase).record("LOAN_RETURNED", "LOAN", 40L,
            "Devolución registrada con condición GOOD");
    }

    @Test
    void returnAssetDamagedWithDescriptionOpensMaintenanceRecord() {
        Loan approvedLoan = Loan.builder()
                .id(40L)
                .status(Loan.Status.APPROVED)
                .asset(Asset.builder().id(30L).build())
                .user(technician)
                .build();
        when(userRepositoryPort.findById(30L)).thenReturn(Optional.of(admin));
        when(loanRepositoryPort.findById(40L)).thenReturn(Optional.of(approvedLoan));
        when(assetRepositoryPort.findById(30L)).thenReturn(Optional.of(availableAsset));
        when(assetRepositoryPort.calculateAvailableQuantity(30L)).thenReturn(0);
        when(assetRepositoryPort.save(any(Asset.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(loanRepositoryPort.save(any(Loan.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(maintenanceRecordRepositoryPort.save(any(MaintenanceRecord.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        loanUseCase.returnAssetAsAdmin(40L, Loan.ReturnCondition.DAMAGED, 30L, "Pantalla rota por impacto");

        ArgumentCaptor<MaintenanceRecord> captor = ArgumentCaptor.forClass(MaintenanceRecord.class);
        verify(maintenanceRecordRepositoryPort).save(captor.capture());
        assertTrue(captor.getValue().getReason().contains("Pantalla rota por impacto"));
        assertTrue(captor.getValue().getReason().contains("Tech User"));
        assertTrue(captor.getValue().getReason().contains("Admin User"));
        assertNull(captor.getValue().getCost());
    }

    @Test
    void returnAssetLostCreatesLostAssetReport() {
        Loan approvedLoan = Loan.builder()
                .id(40L)
                .status(Loan.Status.APPROVED)
                .asset(Asset.builder().id(30L).build())
                .user(technician)
                .build();
        when(userRepositoryPort.findById(30L)).thenReturn(Optional.of(admin));
        when(loanRepositoryPort.findById(40L)).thenReturn(Optional.of(approvedLoan));
        when(assetRepositoryPort.findById(30L)).thenReturn(Optional.of(availableAsset));
        when(assetRepositoryPort.calculateAvailableQuantity(30L)).thenReturn(0);
        when(assetRepositoryPort.save(any(Asset.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(loanRepositoryPort.save(any(Loan.class))).thenAnswer(invocation -> invocation.getArgument(0));

        loanUseCase.returnAssetAsAdmin(40L, Loan.ReturnCondition.LOST, 30L, "Equipo extraviado en ruta");

        verify(lostAssetReportUseCase).reportLost(eq(30L), eq(40L), eq(10L), contains("Equipo extraviado en ruta"));
    }

    @Test
    void requestLoanValidatesCustomStartDate() {
        when(userRepositoryPort.findById(10L)).thenReturn(Optional.of(technician));
        when(loanRepositoryPort.findByUserId(10L)).thenReturn(java.util.List.of());
        when(loanRepositoryPort.hasOverdueApprovedLoan(eq(10L), any())).thenReturn(false);
        when(assetRepositoryPort.findById(30L)).thenReturn(Optional.of(availableAsset));
        when(loanRepositoryPort.save(any(Loan.class))).thenAnswer(invocation -> invocation.getArgument(0));

        LocalDate startDate = LocalDate.now().plusDays(2);
        LocalDate dueDate = startDate.plusDays(3);

        Loan loan = loanUseCase.requestLoan(10L, 30L, dueDate, startDate, "09:00", "17:00");

        assertEquals(startDate.atTime(9, 0), loan.getRequestDate());
        assertEquals(dueDate, loan.getDueLocalDate());
    }

    @Test
    void requestLoanRejectsDurationShorterThanOneHourOnSameDay() {
        LocalDate sameDay = LocalDate.now().plusDays(1);
        assertThrows(IllegalArgumentException.class,
                () -> loanUseCase.requestLoan(10L, 30L, sameDay, sameDay, "10:00", "10:30"));
    }

    @Test
    void approveLoanKeepsAssetAvailableWhenMultipleUnitsRemain() {
        Loan pendingLoan = pendingLoan();
        Asset multiUnitAsset = Asset.builder().id(30L).status("AVAILABLE").stockQuantity(5).availableQuantity(5).build();
        when(userRepositoryPort.findById(20L)).thenReturn(Optional.of(inspector));
        when(loanRepositoryPort.findById(40L)).thenReturn(Optional.of(pendingLoan));
        when(assetRepositoryPort.findById(30L)).thenReturn(Optional.of(multiUnitAsset));
        when(assetRepositoryPort.calculateAvailableQuantity(30L)).thenReturn(5);
        when(assetRepositoryPort.save(any(Asset.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(loanRepositoryPort.save(any(Loan.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Loan result = loanUseCase.approveLoan(40L, 20L);

        assertEquals(Loan.Status.APPROVED, result.getStatus());
        assertEquals("AVAILABLE", multiUnitAsset.getStatus());
    }

    @Test
    void requestLoanFailsWhenNoUnitsAvailable() {
        when(userRepositoryPort.findById(10L)).thenReturn(Optional.of(technician));
        when(loanRepositoryPort.hasOverdueApprovedLoan(eq(10L), any(LocalDate.class))).thenReturn(false);
        when(assetRepositoryPort.findById(30L)).thenReturn(Optional.of(availableAsset));
        when(assetRepositoryPort.calculateAvailableQuantity(30L)).thenReturn(0);

        assertThrows(IllegalStateException.class,
                () -> loanUseCase.requestLoan(10L, 30L, LocalDate.now().plusDays(7)));
    }

    private Loan pendingLoan() {
        return Loan.builder()
                .id(40L)
                .status(Loan.Status.PENDING)
                .asset(Asset.builder().id(30L).build())
                .build();
    }
}