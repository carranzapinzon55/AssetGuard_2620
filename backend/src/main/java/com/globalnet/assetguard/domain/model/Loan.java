package com.globalnet.assetguard.domain.model;

import java.time.LocalDate;
import java.time.LocalDateTime;
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
public class Loan {
    private Long id;
    private LocalDateTime requestDate;
    private LocalDate dueLocalDate;
    private LocalDateTime returnDateTime;
    private String status;
    private String returnCondition;
    private Integer delayDays;
    private User user;
    private Asset asset;
}