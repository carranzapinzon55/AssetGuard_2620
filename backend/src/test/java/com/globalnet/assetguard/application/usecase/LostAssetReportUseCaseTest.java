package com.globalnet.assetguard.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.globalnet.assetguard.domain.model.Asset;
import com.globalnet.assetguard.domain.model.Loan;
import com.globalnet.assetguard.domain.model.LostAssetReport;
import com.globalnet.assetguard.domain.model.User;
import com.globalnet.assetguard.domain.ports.output.AssetRepositoryPort;
import com.globalnet.assetguard.domain.ports.output.LoanRepositoryPort;
import com.globalnet.assetguard.domain.ports.output.LostAssetReportRepositoryPort;
import com.globalnet.assetguard.domain.ports.output.UserRepositoryPort;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class LostAssetReportUseCaseTest {

    @Mock
    private LostAssetReportRepositoryPort lostAssetReportRepositoryPort;

    @Mock
    private AssetRepositoryPort assetRepositoryPort;

    @Mock
    private LoanRepositoryPort loanRepositoryPort;

    @Mock
    private UserRepositoryPort userRepositoryPort;

    @Mock
    private AuditLogUseCase auditLogUseCase;

    @InjectMocks
    private LostAssetReportUseCase lostAssetReportUseCase;

    @Test
    void reportLostPersistsUnacknowledgedReportAndAudits() {
        Asset asset = Asset.builder().id(5L).serialNumber("SN-LOST-1").build();
        User user = User.builder().id(12L).fullName("Tech 1").build();
        when(assetRepositoryPort.findById(5L)).thenReturn(Optional.of(asset));
        when(userRepositoryPort.findById(12L)).thenReturn(Optional.of(user));
        when(lostAssetReportRepositoryPort.save(any(LostAssetReport.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        LostAssetReport report = lostAssetReportUseCase.reportLost(5L, null, 12L, "Equipo extraviado");

        assertEquals(asset, report.getAsset());
        assertEquals(user, report.getReportedByUser());
        assertEquals("Equipo extraviado", report.getNotes());
        assertFalse(report.getAcknowledged());
        verify(auditLogUseCase).record("ASSET_REPORTED_LOST", "ASSET", 5L,
                "Activo reportado como perdido: Equipo extraviado");
    }

    @Test
    void acknowledgeMarksReportAsAcknowledged() {
        LostAssetReport report = LostAssetReport.builder()
                .id(1L)
                .acknowledged(false)
                .build();
        when(lostAssetReportRepositoryPort.findById(1L)).thenReturn(Optional.of(report));
        when(lostAssetReportRepositoryPort.save(any(LostAssetReport.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        LostAssetReport acknowledged = lostAssetReportUseCase.acknowledge(1L);

        assertTrue(acknowledged.getAcknowledged());
        verify(auditLogUseCase).record("LOST_REPORT_ACKNOWLEDGED", "LOST_REPORT", 1L,
                "Reporte de activo perdido marcado como revisado");
    }
}
