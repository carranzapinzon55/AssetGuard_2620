package com.globalnet.assetguard.infrastructure.inbound.rest.dto;

import java.time.LocalDate;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MaintenanceRecordRequestDto {

    private Long assetId;
    private String providerName;
    private String reason;
    private Double cost;
    private LocalDate startDate;
    private LocalDate endDate;
}
