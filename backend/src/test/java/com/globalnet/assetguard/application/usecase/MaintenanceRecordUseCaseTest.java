package com.globalnet.assetguard.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.globalnet.assetguard.domain.model.Asset;
import com.globalnet.assetguard.domain.model.MaintenanceRecord;
import com.globalnet.assetguard.domain.model.Provider;
import com.globalnet.assetguard.domain.ports.output.AssetRepositoryPort;
import com.globalnet.assetguard.domain.ports.output.MaintenanceRecordRepositoryPort;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class MaintenanceRecordUseCaseTest {

    @Mock
    private MaintenanceRecordRepositoryPort maintenanceRecordRepositoryPort;

    @Mock
    private AssetRepositoryPort assetRepositoryPort;

    @Mock
    private AuditLogUseCase auditLogUseCase;

    @Mock
    private LostAssetReportUseCase lostAssetReportUseCase;

    @InjectMocks
    private MaintenanceRecordUseCase maintenanceRecordUseCase;

    @Test
    void updatesOpenRecordWithoutChangingMaintenanceStatus() {
        Asset asset = Asset.builder().id(4L).status("UNDER_MAINTENANCE").build();
        Provider oldProvider = Provider.builder().id(1L).name("Old provider").build();
        Provider newProvider = Provider.builder().id(2L).name("New provider").build();
        MaintenanceRecord record = MaintenanceRecord.builder()
                .id(7L)
                .asset(asset)
                .provider(oldProvider)
                .reason("Old failure")
                .cost(50.0)
                .build();
        when(maintenanceRecordRepositoryPort.findById(7L)).thenReturn(Optional.of(record));
        when(assetRepositoryPort.findById(4L)).thenReturn(Optional.of(asset));
        when(maintenanceRecordRepositoryPort.save(record)).thenReturn(record);

        MaintenanceRecord updated = maintenanceRecordUseCase.update(7L, MaintenanceRecord.builder()
                .provider(newProvider)
                .reason("New failure")
                .cost(75.0)
                .build());

        assertEquals(newProvider, updated.getProvider());
        assertEquals("New failure", updated.getReason());
        assertEquals(75.0, updated.getCost());
        assertEquals("UNDER_MAINTENANCE", asset.getStatus());
        verify(auditLogUseCase).record(
                eq("MAINTENANCE_UPDATED"), eq("MAINTENANCE"), eq(7L), anyString());
    }

    @Test
    void rejectsUpdateForCompletedRecord() {
        MaintenanceRecord record = MaintenanceRecord.builder()
                .id(7L)
                .endDate(LocalDate.now())
                .build();
        when(maintenanceRecordRepositoryPort.findById(7L)).thenReturn(Optional.of(record));

        assertThrows(IllegalStateException.class, () -> maintenanceRecordUseCase.update(
                7L, MaintenanceRecord.builder().reason("Changed").build()));
    }

    @Test
    void rejectsCostsAboveMaximumUsd() {
        MaintenanceRecord record = MaintenanceRecord.builder()
                .id(7L)
                .build();
        when(maintenanceRecordRepositoryPort.findById(7L)).thenReturn(Optional.of(record));

        assertThrows(IllegalArgumentException.class, () -> maintenanceRecordUseCase.update(
                7L, MaintenanceRecord.builder()
                        .cost(MaintenanceRecordUseCase.MAX_MAINTENANCE_COST_USD + 0.01)
                        .build()));
    }

    @Test
    void executeKeepsAssetAvailableWhenMultipleUnitsRemain() {
        Asset asset = Asset.builder().id(4L).status("AVAILABLE").stockQuantity(5).build();
        MaintenanceRecord record = MaintenanceRecord.builder()
                .asset(asset)
                .reason("Calibración")
                .cost(100.0)
                .build();
        when(assetRepositoryPort.findById(4L)).thenReturn(Optional.of(asset));
        when(assetRepositoryPort.calculateAvailableQuantity(4L)).thenReturn(5);
        when(assetRepositoryPort.save(any(Asset.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(maintenanceRecordRepositoryPort.save(any(MaintenanceRecord.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MaintenanceRecord saved = maintenanceRecordUseCase.execute(record);

        assertEquals("AVAILABLE", asset.getStatus());
        verify(maintenanceRecordRepositoryPort).save(record);
    }

    @Test
    void executeSetsUnderMaintenanceWhenLastUnitEntersMaintenance() {
        Asset asset = Asset.builder().id(4L).status("AVAILABLE").stockQuantity(1).build();
        MaintenanceRecord record = MaintenanceRecord.builder()
                .asset(asset)
                .reason("Reparación completa")
                .cost(200.0)
                .build();
        when(assetRepositoryPort.findById(4L)).thenReturn(Optional.of(asset));
        when(assetRepositoryPort.calculateAvailableQuantity(4L)).thenReturn(1);
        when(assetRepositoryPort.save(any(Asset.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(maintenanceRecordRepositoryPort.save(any(MaintenanceRecord.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MaintenanceRecord saved = maintenanceRecordUseCase.execute(record);

        assertEquals("UNDER_MAINTENANCE", asset.getStatus());
        verify(maintenanceRecordRepositoryPort).save(record);
    }

    @Test
    void completeRestoresAssetToAvailable() {
        Asset asset = Asset.builder().id(4L).status("UNDER_MAINTENANCE").build();
        MaintenanceRecord record = MaintenanceRecord.builder()
                .id(7L)
                .asset(asset)
                .build();
        when(maintenanceRecordRepositoryPort.findById(7L)).thenReturn(Optional.of(record));
        when(assetRepositoryPort.findById(4L)).thenReturn(Optional.of(asset));
        when(assetRepositoryPort.save(any(Asset.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(maintenanceRecordRepositoryPort.save(any(MaintenanceRecord.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MaintenanceRecord completed = maintenanceRecordUseCase.complete(7L);

        assertEquals("AVAILABLE", asset.getStatus());
        assertEquals(LocalDate.now(), completed.getEndDate());
    }

    @Test
    void decommissionRejectsCompletedRecord() {
        MaintenanceRecord record = MaintenanceRecord.builder()
                .id(7L)
                .endDate(LocalDate.now())
                .build();
        when(maintenanceRecordRepositoryPort.findById(7L)).thenReturn(Optional.of(record));

        assertThrows(IllegalStateException.class, () ->
                maintenanceRecordUseCase.decommission(7L, "Daño irreparable en placa", 1L));
    }

    @Test
    void decommissionRejectsShortOrNullNotes() {
        assertThrows(IllegalArgumentException.class, () ->
                maintenanceRecordUseCase.decommission(7L, null, 1L));
        assertThrows(IllegalArgumentException.class, () ->
                maintenanceRecordUseCase.decommission(7L, "corto", 1L));
    }

    @Test
    void decommissionClosesRecordAndReportsLoss() {
        Asset asset = Asset.builder().id(4L).status("UNDER_MAINTENANCE").build();
        MaintenanceRecord record = MaintenanceRecord.builder()
                .id(7L)
                .asset(asset)
                .reason("Revisión de tarjeta madre")
                .build();
        when(maintenanceRecordRepositoryPort.findById(7L)).thenReturn(Optional.of(record));
        when(assetRepositoryPort.findById(4L)).thenReturn(Optional.of(asset));
        when(maintenanceRecordRepositoryPort.save(any(MaintenanceRecord.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MaintenanceRecord decommissioned = maintenanceRecordUseCase.decommission(
                7L, "Fallo total e irreparable de circuitos", 99L);

        assertEquals(LocalDate.now(), decommissioned.getEndDate());
        verify(lostAssetReportUseCase).reportLost(
                eq(4L),
                isNull(),
                eq(99L),
                eq("[BAJA DEFINITIVA EN MANTENIMIENTO] Fallo total e irreparable de circuitos")
        );
        verify(auditLogUseCase).record(
                eq("ASSET_DECOMMISSIONED"),
                eq("MAINTENANCE"),
                eq(7L),
                anyString()
        );
    }
}
