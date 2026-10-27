package com.globalnet.assetguard.domain.model;

import java.math.BigDecimal;

public record LoanDashboardMetrics(
        BigDecimal estimatedLossValue,
        double onTimeReturnPercentage,
        long assetsCurrentlyInField) {
}