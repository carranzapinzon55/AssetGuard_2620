package com.globalnet.assetguard.domain.model;

import java.time.LocalDate;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MaintenanceRecord {
    private Long id;
    private Asset asset;
    private String providerName;
    private String reason;
    private Double cost;
    private LocalDate startDate;
    private LocalDate endDate;
}
