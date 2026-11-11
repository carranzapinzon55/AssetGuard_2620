package com.globalnet.assetguard.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.globalnet.assetguard.domain.model.Asset;
import com.globalnet.assetguard.domain.ports.output.AssetRepositoryPort;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AssetUseCaseTest {

    @Mock
    private AssetRepositoryPort assetRepositoryPort;

    @Mock
    private AuditLogUseCase auditLogUseCase;

    @InjectMocks
    private AssetUseCase assetUseCase;

    @Test
    void registerIgnoresClientSerialAndCreatesBrandBasedSerial() {
        Asset request = Asset.builder()
                .serialNumber("CLIENT-SERIAL")
                .model("HP EliteBook 840")
                .status("AVAILABLE")
                .build();
        when(assetRepositoryPort.save(any(Asset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Asset saved = assetUseCase.register(request);

        assertTrue(saved.getSerialNumber().matches("SN-HP-[A-F0-9]{8}"));
        assertNotEquals("CLIENT-SERIAL", saved.getSerialNumber());
        verify(auditLogUseCase).record(eq("ASSET_CREATED"), eq("ASSET"), any(), anyString());
    }

    @Test
    void updateKeepsGeneratedSerialAndAuditsStatusChanges() {
        Asset existing = Asset.builder()
                .id(12L)
                .serialNumber("SN-HP-A1B2C3D4")
                .model("HP EliteBook")
                .status("AVAILABLE")
                .build();
        when(assetRepositoryPort.findById(12L)).thenReturn(Optional.of(existing));
        when(assetRepositoryPort.save(any(Asset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Asset saved = assetUseCase.update(12L, Asset.builder()
                .serialNumber("MANUAL-CHANGE")
                .model("HP EliteBook G10")
                .status("LOANED")
                .build());

        assertEquals("SN-HP-A1B2C3D4", saved.getSerialNumber());
        assertEquals("LOANED", saved.getStatus());
        verify(auditLogUseCase).record(eq("ASSET_UPDATED"), eq("ASSET"), eq(12L), anyString());
        verify(auditLogUseCase).record(eq("ASSET_STATUS_CHANGED"), eq("ASSET"), eq(12L), anyString());
    }
}