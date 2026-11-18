package com.globalnet.assetguard.domain.model;

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
public class LostAssetReport {
    private Long id;
    private Asset asset;
    private Loan loan;
    private User reportedByUser;
    private LocalDateTime reportedAt;
    private String notes;
    private Boolean acknowledged;
}
