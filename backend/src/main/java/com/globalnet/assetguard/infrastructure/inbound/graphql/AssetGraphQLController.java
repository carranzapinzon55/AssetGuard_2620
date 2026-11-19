package com.globalnet.assetguard.infrastructure.inbound.graphql;

import com.globalnet.assetguard.application.usecase.AssetUseCase;
import com.globalnet.assetguard.application.usecase.BulkUploadAssetsUseCase;
import com.globalnet.assetguard.application.usecase.LoanUseCase;
import com.globalnet.assetguard.application.usecase.LostAssetReportUseCase;
import com.globalnet.assetguard.domain.model.Asset;
import com.globalnet.assetguard.domain.model.MaintenanceRecord;
import com.globalnet.assetguard.domain.model.Provider;
import com.globalnet.assetguard.domain.ports.output.MaintenanceRecordRepositoryPort;
import com.globalnet.assetguard.infrastructure.security.CurrentAuthenticatedUser;
import java.time.LocalDate;
import java.util.Base64;
import java.util.List;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;

@Controller
public class AssetGraphQLController {

    private final AssetUseCase assetUseCase;
    private final BulkUploadAssetsUseCase bulkUploadAssetsUseCase;
    private final LoanUseCase loanUseCase;
    private final MaintenanceRecordRepositoryPort maintenanceRecordRepositoryPort;
    private final LostAssetReportUseCase lostAssetReportUseCase;
    private final CurrentAuthenticatedUser currentAuthenticatedUser;

    public AssetGraphQLController(
            AssetUseCase assetUseCase,
            BulkUploadAssetsUseCase bulkUploadAssetsUseCase,
            LoanUseCase loanUseCase,
            MaintenanceRecordRepositoryPort maintenanceRecordRepositoryPort,
            LostAssetReportUseCase lostAssetReportUseCase,
            CurrentAuthenticatedUser currentAuthenticatedUser) {
        this.assetUseCase = assetUseCase;
        this.bulkUploadAssetsUseCase = bulkUploadAssetsUseCase;
        this.loanUseCase = loanUseCase;
        this.maintenanceRecordRepositoryPort = maintenanceRecordRepositoryPort;
        this.lostAssetReportUseCase = lostAssetReportUseCase;
        this.currentAuthenticatedUser = currentAuthenticatedUser;
    }

    @QueryMapping
    @PreAuthorize("isAuthenticated()")
    public List<GraphQLViews.AssetView> assets(@Argument Integer limit) {
        int normalizedLimit = normalizeLimit(limit);
        return assetUseCase.findAll().stream()
                .sorted(java.util.Comparator.comparingLong(Asset::getId).reversed())
                .limit(normalizedLimit)
                .map(GraphQLViews.AssetView::from)
                .toList();
    }

    @MutationMapping
    @PreAuthorize("hasRole('ADMIN')")
    public GraphQLViews.AssetView createAsset(@Argument("input") AssetInput input) {
        int initialStock;
        if ("AVAILABLE".equalsIgnoreCase(input.status())) {
            initialStock = (input.stockQuantity() != null && input.stockQuantity() >= 1) ? input.stockQuantity() : 1;
        } else {
            initialStock = 1;
        }
        Asset asset = Asset.builder()
                .serialNumber(input.serialNumber())
                .model(input.model())
                .estimatedValue(input.estimatedValue())
                .status(input.status())
                .purchaseDate(input.purchaseDate() == null ? null : LocalDate.parse(input.purchaseDate()))
                .stockQuantity(initialStock)
                .build();
        Asset savedAsset = assetUseCase.register(asset);
        handleLifecycleSideEffects(
                savedAsset,
                input.status(),
                input.loanTechnicianId(),
                input.loanStartDate(),
                input.loanDueDate(),
                input.loanStartTime(),
                input.loanEndTime(),
                input.maintenanceReason(),
                input.maintenanceCost(),
                input.maintenanceProviderName(),
                input.lostNotes());
        Asset reloaded = assetUseCase.findById(savedAsset.getId());
        return GraphQLViews.AssetView.from(reloaded);
    }

    @MutationMapping
    @PreAuthorize("hasRole('ADMIN')")
    public GraphQLViews.AssetView updateAsset(@Argument("input") UpdateAssetInput input) {
        Asset existing = assetUseCase.findById(input.id());
        Integer stockQuantityToSet;
        if ("AVAILABLE".equalsIgnoreCase(input.status())) {
            stockQuantityToSet = (input.stockQuantity() != null && input.stockQuantity() >= 1)
                    ? input.stockQuantity()
                    : existing.getStockQuantity();
        } else {
            stockQuantityToSet = existing.getStockQuantity();
        }
        Asset changes = Asset.builder()
                .serialNumber(input.serialNumber())
                .model(input.model())
                .estimatedValue(input.estimatedValue())
                .status(input.status())
                .purchaseDate(input.purchaseDate() == null ? null : LocalDate.parse(input.purchaseDate()))
                .stockQuantity(stockQuantityToSet)
                .build();
        Asset updatedAsset = assetUseCase.update(input.id(), changes);
        handleLifecycleSideEffects(
                updatedAsset,
                input.status(),
                input.loanTechnicianId(),
                input.loanStartDate(),
                input.loanDueDate(),
                input.loanStartTime(),
                input.loanEndTime(),
                input.maintenanceReason(),
                input.maintenanceCost(),
                input.maintenanceProviderName(),
                input.lostNotes());
        Asset reloaded = assetUseCase.findById(updatedAsset.getId());
        return GraphQLViews.AssetView.from(reloaded);
    }

    private void handleLifecycleSideEffects(
            Asset asset,
            String status,
            Long technicianId,
            String startDateStr,
            String dueDateStr,
            String startTime,
            String endTime,
            String maintenanceReason,
            Double maintenanceCost,
            String providerName,
            String lostNotes) {
        if ("LOANED".equalsIgnoreCase(status) && technicianId != null && dueDateStr != null) {
            LocalDate startDate = startDateStr != null && !startDateStr.isBlank()
                    ? LocalDate.parse(startDateStr)
                    : LocalDate.now();
            LocalDate dueDate = LocalDate.parse(dueDateStr);
            Long adminId = currentAuthenticatedUser.requirePrincipal().userId();
            loanUseCase.createApprovedLoan(asset.getId(), technicianId, adminId, startDate, dueDate, startTime, endTime);
        } else if ("UNDER_MAINTENANCE".equalsIgnoreCase(status)) {
            String reason = (maintenanceReason != null && !maintenanceReason.isBlank())
                    ? maintenanceReason.trim()
                    : "Mantenimiento preventivo / correctivo asignado";
            Provider provider = (providerName != null && !providerName.isBlank())
                    ? Provider.builder().name(providerName.trim()).build()
                    : null;
            maintenanceRecordRepositoryPort.save(MaintenanceRecord.builder()
                    .asset(asset)
                    .provider(provider)
                    .reason(reason)
                    .cost(maintenanceCost)
                    .startDate(LocalDate.now())
                    .build());
        } else if ("LOST".equalsIgnoreCase(status)) {
            Long adminId = currentAuthenticatedUser.requirePrincipal().userId();
            String notes = (lostNotes != null && !lostNotes.isBlank())
                    ? lostNotes.trim()
                    : "Activo marcado como perdido desde el módulo de inventario";
            lostAssetReportUseCase.reportLost(asset.getId(), null, adminId, notes);
        }
    }

    @MutationMapping
    @PreAuthorize("hasRole('ADMIN')")
    public BulkUploadPayload uploadAssetsBulk(@Argument("input") BulkUploadInput input) throws java.io.IOException {
        byte[] content;
        try {
            content = Base64.getDecoder().decode(input.contentBase64());
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("contentBase64 must contain valid Base64 data", exception);
        }
        var assets = bulkUploadAssetsUseCase.execute(input.filename(), content);
        return new BulkUploadPayload(assets.size(), assets.stream()
                .map(GraphQLViews.AssetView::from)
                .toList());
    }

    public record AssetInput(
            String serialNumber,
            String model,
            Double estimatedValue,
            String status,
            String purchaseDate,
            Integer stockQuantity,
            Long loanTechnicianId,
            String loanStartDate,
            String loanDueDate,
            String loanStartTime,
            String loanEndTime,
            String maintenanceReason,
            Double maintenanceCost,
            String maintenanceProviderName,
            String lostNotes) {
    }

    public record BulkUploadInput(String filename, String contentBase64) {
    }

    public record UpdateAssetInput(
            Long id,
            String serialNumber,
            String model,
            Double estimatedValue,
            String status,
            String purchaseDate,
            Integer stockQuantity,
            Long loanTechnicianId,
            String loanStartDate,
            String loanDueDate,
            String loanStartTime,
            String loanEndTime,
            String maintenanceReason,
            Double maintenanceCost,
            String maintenanceProviderName,
            String lostNotes) {
    }

    public record BulkUploadPayload(int importedCount, List<GraphQLViews.AssetView> assets) {
    }

    private int normalizeLimit(Integer limit) {
        int value = limit == null ? 50 : limit;
        if (value < 1 || value > 200) {
            throw new IllegalArgumentException("limit must be between 1 and 200");
        }
        return value;
    }
}
