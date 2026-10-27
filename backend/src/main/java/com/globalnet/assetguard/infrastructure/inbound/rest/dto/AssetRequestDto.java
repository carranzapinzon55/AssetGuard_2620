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
public class AssetRequestDto {

    private String serialNumber;
    private String model;
    private Double estimatedValue;
    private String status;
    private LocalDate purchaseDate;
}
