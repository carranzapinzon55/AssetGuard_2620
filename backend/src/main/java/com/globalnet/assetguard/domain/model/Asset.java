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
public class Asset {
    private Long id;
    private String serialNumber;
    private String model;
    private Double estimatedValue;
    private String status;
    private LocalDate purchaseDate;
}