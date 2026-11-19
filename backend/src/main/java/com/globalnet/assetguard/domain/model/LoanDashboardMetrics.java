package com.globalnet.assetguard.domain.model;

import java.math.BigDecimal;
import java.util.List;

public record LoanDashboardMetrics(
        BigDecimal estimatedLossValue,
        BigDecimal maintenanceCostsValue,
        BigDecimal totalEconomicLoss,
        double onTimeReturnPercentage,
        long assetsCurrentlyInField,
        long totalAssets,
        long availableAssets,
        long assetsUnderMaintenance,
        long lostAssets,
        List<AssetModelMetrics> assetsByModel) {

    public LoanDashboardMetrics {
        if (totalEconomicLoss == null) {
            BigDecimal loss = estimatedLossValue != null ? estimatedLossValue : BigDecimal.ZERO;
            BigDecimal maint = maintenanceCostsValue != null ? maintenanceCostsValue : BigDecimal.ZERO;
            totalEconomicLoss = loss.add(maint);
        }
    }

    public LoanDashboardMetrics(
            BigDecimal estimatedLossValue,
            BigDecimal maintenanceCostsValue,
            double onTimeReturnPercentage,
            long assetsCurrentlyInField,
            long totalAssets,
            long availableAssets,
            long assetsUnderMaintenance,
            long lostAssets,
            List<AssetModelMetrics> assetsByModel) {
        this(
                estimatedLossValue,
                maintenanceCostsValue,
                (estimatedLossValue != null ? estimatedLossValue : BigDecimal.ZERO)
                        .add(maintenanceCostsValue != null ? maintenanceCostsValue : BigDecimal.ZERO),
                onTimeReturnPercentage,
                assetsCurrentlyInField,
                totalAssets,
                availableAssets,
                assetsUnderMaintenance,
                lostAssets,
                assetsByModel);
    }
}
