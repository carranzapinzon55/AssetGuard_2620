package com.globalnet.assetguard.infrastructure.inbound.rest.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoanRequestDto {

    private Long userId;
    private Long assetId;
    private LocalDateTime requestDate;
    private LocalDate dueLocalDate;
    private String status;
}
