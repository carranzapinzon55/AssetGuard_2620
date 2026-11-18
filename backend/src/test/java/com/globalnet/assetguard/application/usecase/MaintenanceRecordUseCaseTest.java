package com.globalnet.assetguard.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
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
}
