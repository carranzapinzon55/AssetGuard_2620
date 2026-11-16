package com.globalnet.assetguard.domain.model;

import java.math.BigDecimal;
import java.util.List;

public record LoanDashboardMetrics(
        BigDecimal estimatedLossValue,
        BigDecimal maintenanceCostsValue,
        double onTimeReturnPercentage,
        long assetsCurrentlyInField,
        long totalAssets,
        long availableAssets,
        long assetsUnderMaintenance,
        long lostAssets,
        List<AssetModelMetrics> assetsByModel) {
}