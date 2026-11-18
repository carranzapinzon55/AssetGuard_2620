package com.globalnet.assetguard.infrastructure.inbound.rest;

import com.globalnet.assetguard.application.usecase.MaintenanceRecordUseCase;
import com.globalnet.assetguard.domain.model.Asset;
import com.globalnet.assetguard.domain.model.MaintenanceRecord;
import com.globalnet.assetguard.domain.model.Provider;
import com.globalnet.assetguard.infrastructure.inbound.rest.dto.MaintenanceRecordRequestDto;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/maintenance-records")
public class MaintenanceRecordController {

    private final MaintenanceRecordUseCase maintenanceRecordUseCase;

    public MaintenanceRecordController(MaintenanceRecordUseCase maintenanceRecordUseCase) {
        this.maintenanceRecordUseCase = maintenanceRecordUseCase;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'INSPECTOR')")
    public ResponseEntity<MaintenanceRecord> registerMaintenanceRecord(
            @RequestBody MaintenanceRecordRequestDto request) {
        Provider provider = request.getProviderId() != null
                ? Provider.builder().id(request.getProviderId()).build()
                : (request.getProviderName() != null && !request.getProviderName().isBlank()
                        ? Provider.builder().name(request.getProviderName().trim()).build()
                        : null);

        MaintenanceRecord maintenanceRecord = MaintenanceRecord.builder()
                .asset(request.getAssetId() == null ? null : Asset.builder().id(request.getAssetId()).build())
                .provider(provider)
                .reason(request.getReason())
                .cost(request.getCost())
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .build();

        MaintenanceRecord savedRecord = maintenanceRecordUseCase.execute(maintenanceRecord);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedRecord);
    }

    @PutMapping("/{recordId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'INSPECTOR')")
    public ResponseEntity<MaintenanceRecord> updateMaintenanceRecord(
            @PathVariable Long recordId,
            @RequestBody MaintenanceRecordUpdateRequest request) {
        Provider provider = request.providerId() != null
                ? Provider.builder().id(request.providerId()).build()
                : (request.providerName() != null && !request.providerName().isBlank()
                        ? Provider.builder().name(request.providerName().trim()).build()
                        : null);

        MaintenanceRecord changes = MaintenanceRecord.builder()
                .provider(provider)
                .reason(request.reason())
                .cost(request.cost())
                .build();
        return ResponseEntity.ok(maintenanceRecordUseCase.update(recordId, changes));
    }

    public record MaintenanceRecordUpdateRequest(Long providerId, String providerName, String reason, Double cost) {
    }
}
