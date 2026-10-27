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
    public enum Status {
        PENDING,
        APPROVED,
        REJECTED,
        RETURNED
    }

    public enum ReturnCondition {
        GOOD,
        DAMAGED,
        LOST
    }

    private Long id;
    private LocalDateTime requestDate;
    private LocalDate dueLocalDate;
    private LocalDateTime returnDateTime;
    private Status status;
    private ReturnCondition returnCondition;
    private Integer delayDays;
    private User user;
    private Asset asset;
    private User inspector;
    private String rejectionReason;
}