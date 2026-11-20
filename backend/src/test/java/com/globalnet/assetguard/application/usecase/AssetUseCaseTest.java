package com.globalnet.assetguard.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.globalnet.assetguard.domain.model.Asset;
import com.globalnet.assetguard.domain.ports.output.AssetRepositoryPort;
import java.util.List;
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

    @Test
    void registerRejectsEstimatedValuesBelowMinimum() {
        Asset request = Asset.builder()
                .model("HP EliteBook")
                .estimatedValue(0.24)
                .status("AVAILABLE")
                .build();

        assertThrows(IllegalArgumentException.class, () -> assetUseCase.register(request));
    }

    @Test
    void registerAcceptsMinimumEstimatedValue() {
        Asset request = Asset.builder()
                .model("HP EliteBook")
                .estimatedValue(0.25)
                .status("AVAILABLE")
                .build();
        when(assetRepositoryPort.save(any(Asset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Asset saved = assetUseCase.register(request);
        assertEquals(0.25, saved.getEstimatedValue());
        assertEquals(1, saved.getStockQuantity());
    }

    @Test
    void registerDefaultsStockQuantityToOneWhenNull() {
        Asset request = Asset.builder()
                .model("HP EliteBook")
                .status("AVAILABLE")
                .stockQuantity(null)
                .build();
        when(assetRepositoryPort.save(any(Asset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Asset saved = assetUseCase.register(request);
        assertEquals(1, saved.getStockQuantity());
    }

    @Test
    void registerForcesStockToOneWhenInitialStatusIsNotAvailable() {
        Asset request = Asset.builder()
                .model("Dell Latitude")
                .status("LOANED")
                .stockQuantity(10)
                .build();
        when(assetRepositoryPort.save(any(Asset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Asset saved = assetUseCase.register(request);
        assertEquals(1, saved.getStockQuantity());
    }

    @Test
    void updateDoesNotOverwriteStockQuantityWhenStatusIsNotAvailable() {
        Asset existing = Asset.builder()
                .id(15L)
                .serialNumber("SN-DELL-12345678")
                .model("Dell Latitude")
                .status("AVAILABLE")
                .stockQuantity(5)
                .build();
        when(assetRepositoryPort.findById(15L)).thenReturn(Optional.of(existing));
        when(assetRepositoryPort.save(any(Asset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Asset updated = assetUseCase.update(15L, Asset.builder()
                .model("Dell Latitude")
                .status("UNDER_MAINTENANCE")
                .stockQuantity(99)
                .build());

        assertEquals(5, updated.getStockQuantity());
        assertEquals("UNDER_MAINTENANCE", updated.getStatus());
    }

    @Test
    void registerMultipleCreatesRequestedQuantityOfAssetsWithUniqueSerials() {
        Asset template = Asset.builder()
                .model("Audi pro 3472")
                .status("AVAILABLE")
                .estimatedValue(1200.0)
                .build();
        when(assetRepositoryPort.save(any(Asset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        List<Asset> created = assetUseCase.registerMultiple(template, 5);

        assertEquals(5, created.size());
        java.util.Set<String> serials = new java.util.HashSet<>();
        for (Asset a : created) {
            assertEquals("Audi pro 3472", a.getModel());
            assertEquals(1, a.getStockQuantity());
            assertTrue(a.getSerialNumber().startsWith("SN-AUDI-"));
            serials.add(a.getSerialNumber());
        }
        assertEquals(5, serials.size(), "Each unit must have a unique generated serial number");
        verify(auditLogUseCase, times(5)).record(eq("ASSET_CREATED"), eq("ASSET"), any(), anyString());
    }

    @Test
    void registerMultipleValidatesQuantityLimits() {
        Asset template = Asset.builder()
                .model("Lenovo ThinkPad")
                .status("AVAILABLE")
                .build();

        assertThrows(IllegalArgumentException.class, () -> assetUseCase.registerMultiple(template, 0));
        assertThrows(IllegalArgumentException.class, () -> assetUseCase.registerMultiple(template, 501));
        assertThrows(IllegalArgumentException.class, () -> assetUseCase.registerMultiple(null, 5));
    }

    @Test
    void registerMultipleForcesQuantityToOneWhenStatusIsNotAvailable() {
        Asset template = Asset.builder()
                .model("MacBook Pro")
                .status("LOANED")
                .build();
        when(assetRepositoryPort.save(any(Asset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        List<Asset> created = assetUseCase.registerMultiple(template, 10);

        assertEquals(1, created.size());
        assertEquals(1, created.get(0).getStockQuantity());
    }

    @Test
    void updateAllowsStockAdjustmentWhenStatusIsAvailable() {
        Asset existing = Asset.builder()
                .id(16L)
                .serialNumber("SN-DELL-87654321")
                .model("Dell Latitude")
                .status("AVAILABLE")
                .stockQuantity(3)
                .build();
        when(assetRepositoryPort.findById(16L)).thenReturn(Optional.of(existing));
        when(assetRepositoryPort.save(any(Asset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Asset updated = assetUseCase.update(16L, Asset.builder()
                .model("Dell Latitude")
                .status("AVAILABLE")
                .stockQuantity(8)
                .build());

        assertEquals(8, updated.getStockQuantity());
        assertEquals("AVAILABLE", updated.getStatus());
    }
}