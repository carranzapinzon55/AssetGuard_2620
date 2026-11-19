package com.globalnet.assetguard.infrastructure.inbound.graphql;

import com.globalnet.assetguard.domain.model.Asset;
import com.globalnet.assetguard.domain.model.Loan;
import com.globalnet.assetguard.domain.model.MaintenanceRecord;
import com.globalnet.assetguard.domain.model.User;

public final class GraphQLViews {

    private GraphQLViews() {
    }

    public record UserView(
            Long id,
            String fullName,
            String email,
            String role,
            Boolean status) {
        public static UserView from(User user) {
            return user == null
                    ? null
                    : new UserView(
                            user.getId(),
                            user.getFullName(),
                            user.getEmail(),
                            user.getRole(),
                            user.getStatus());
        }
    }

    public record UserMutationInput(
            String fullName,
            String email,
            String password,
            String role,
            Boolean status) {
        public User toDomain() {
            return User.builder()
                    .fullName(fullName)
                    .email(email)
                    .password(password)
                    .role(role)
                    .status(status)
                    .build();
        }
    }

    public record AssetView(
            Long id,
            String serialNumber,
            String model,
            Double estimatedValue,
            String status,
            String purchaseDate,
            Integer stockQuantity,
            Integer availableQuantity) {
        public static AssetView from(Asset asset) {
            if (asset == null) {
                return null;
            }
            int stock = asset.getStockQuantity() != null ? asset.getStockQuantity() : 1;
            int available = asset.getAvailableQuantity() != null ? asset.getAvailableQuantity() : stock;
            return new AssetView(
                    asset.getId(),
                    asset.getSerialNumber(),
                    asset.getModel(),
                    asset.getEstimatedValue(),
                    asset.getStatus(),
                    asset.getPurchaseDate() == null ? null : asset.getPurchaseDate().toString(),
                    stock,
                    available);
        }
    }

    public record LoanView(
            Long id,
            String requestDate,
            String dueLocalDate,
            String returnDateTime,
            Loan.Status status,
            Loan.ReturnCondition returnCondition,
            Integer delayDays,
            UserView user,
            AssetView asset,
            UserView inspector,
            String rejectionReason) {
        public static LoanView from(Loan loan) {
            return loan == null
                    ? null
                    : new LoanView(
                            loan.getId(),
                            loan.getRequestDate() == null ? null : loan.getRequestDate().toString(),
                            loan.getDueLocalDate() == null ? null : loan.getDueLocalDate().toString(),
                            loan.getReturnDateTime() == null ? null : loan.getReturnDateTime().toString(),
                            loan.getStatus(),
                            loan.getReturnCondition(),
                            loan.getDelayDays(),
                            UserView.from(loan.getUser()),
                            AssetView.from(loan.getAsset()),
                            UserView.from(loan.getInspector()),
                            loan.getRejectionReason());
        }
    }

    public record MaintenanceRecordView(
            Long id,
            AssetView asset,
            ProviderView provider,
            String providerName,
            String reason,
            Double cost,
            String startDate,
            String endDate) {
        public static MaintenanceRecordView from(MaintenanceRecord record) {
            return record == null
                    ? null
                    : new MaintenanceRecordView(
                            record.getId(),
                            AssetView.from(record.getAsset()),
                            record.getProvider() == null ? null : ProviderView.from(record.getProvider()),
                            record.getProvider() == null ? null : record.getProvider().getName(),
                            record.getReason(),
                            record.getCost(),
                            record.getStartDate() == null ? null : record.getStartDate().toString(),
                            record.getEndDate() == null ? null : record.getEndDate().toString());
        }
    }

    public record ProviderView(Long id, String name, Boolean active) {
        public static ProviderView from(com.globalnet.assetguard.domain.model.Provider provider) {
            return provider == null ? null : new ProviderView(provider.getId(), provider.getName(), provider.getActive());
        }
    }

    public record LostAssetReportView(
            Long id,
            AssetView asset,
            LoanView loan,
            UserView reportedByUser,
            String reportedAt,
            String notes,
            Boolean acknowledged) {
        public static LostAssetReportView from(com.globalnet.assetguard.domain.model.LostAssetReport report) {
            return report == null ? null : new LostAssetReportView(
                    report.getId(),
                    AssetView.from(report.getAsset()),
                    LoanView.from(report.getLoan()),
                    UserView.from(report.getReportedByUser()),
                    report.getReportedAt() == null ? null : report.getReportedAt().toString(),
                    report.getNotes(),
                    report.getAcknowledged());
        }
    }
}
