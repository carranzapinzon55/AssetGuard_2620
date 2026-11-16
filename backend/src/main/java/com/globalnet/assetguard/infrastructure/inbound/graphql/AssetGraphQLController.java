package com.globalnet.assetguard.infrastructure.inbound.graphql;

import com.globalnet.assetguard.application.usecase.AssetUseCase;
import com.globalnet.assetguard.application.usecase.BulkUploadAssetsUseCase;
import com.globalnet.assetguard.domain.model.Asset;
import java.time.LocalDate;
import java.util.List;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.stereotype.Controller;
import org.springframework.security.access.prepost.PreAuthorize;
import java.util.Base64;

@Controller
public class AssetGraphQLController {

    private final AssetUseCase assetUseCase;
    private final BulkUploadAssetsUseCase bulkUploadAssetsUseCase;

    public AssetGraphQLController(
            AssetUseCase assetUseCase,
            BulkUploadAssetsUseCase bulkUploadAssetsUseCase) {
        this.assetUseCase = assetUseCase;
        this.bulkUploadAssetsUseCase = bulkUploadAssetsUseCase;
    }

    @QueryMapping
    @PreAuthorize("isAuthenticated()")
    public List<GraphQLViews.AssetView> assets(@Argument Integer limit) {
        int normalizedLimit = normalizeLimit(limit);
        return assetUseCase.findAll().stream()
                .limit(normalizedLimit)
                .map(GraphQLViews.AssetView::from)
                .toList();
    }

    @MutationMapping
    @PreAuthorize("hasRole('ADMIN')")
    public GraphQLViews.AssetView createAsset(@Argument("input") AssetInput input) {
        Asset asset = Asset.builder()
                .serialNumber(input.serialNumber())
                .model(input.model())
                .estimatedValue(input.estimatedValue())
                .status(input.status())
                .purchaseDate(input.purchaseDate() == null ? null : LocalDate.parse(input.purchaseDate()))
                .stockQuantity(input.stockQuantity())
                .build();
        return GraphQLViews.AssetView.from(assetUseCase.register(asset));
    }

    @MutationMapping
    @PreAuthorize("hasRole('ADMIN')")
    public GraphQLViews.AssetView updateAsset(@Argument("input") UpdateAssetInput input) {
        Asset changes = Asset.builder()
                .serialNumber(input.serialNumber())
                .model(input.model())
                .estimatedValue(input.estimatedValue())
                .status(input.status())
                .purchaseDate(input.purchaseDate() == null ? null : LocalDate.parse(input.purchaseDate()))
                .stockQuantity(input.stockQuantity())
                .build();
        return GraphQLViews.AssetView.from(assetUseCase.update(input.id(), changes));
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
            Integer stockQuantity) {
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
            Integer stockQuantity) {
        }

    public record BulkUploadPayload(int importedCount, List<GraphQLViews.AssetView> assets) {
    }

    private int normalizeLimit(Integer limit) {
        int value = limit == null ? 10 : limit;
        if (value != 10 && value != 25 && value != 50) {
            throw new IllegalArgumentException("limit must be one of 10, 25, or 50");
        }
        return value;
    }
}
