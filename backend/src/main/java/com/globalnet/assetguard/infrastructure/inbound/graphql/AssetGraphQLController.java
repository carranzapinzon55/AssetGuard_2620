package com.globalnet.assetguard.infrastructure.inbound.graphql;

import com.globalnet.assetguard.application.usecase.AssetUseCase;
import com.globalnet.assetguard.domain.model.Asset;
import java.time.LocalDate;
import java.util.List;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.stereotype.Controller;

@Controller
public class AssetGraphQLController {

    private final AssetUseCase assetUseCase;

    public AssetGraphQLController(AssetUseCase assetUseCase) {
        this.assetUseCase = assetUseCase;
    }

    @QueryMapping
    public List<GraphQLViews.AssetView> assets() {
        return assetUseCase.findAll().stream()
                .map(GraphQLViews.AssetView::from)
                .toList();
    }

    @MutationMapping
    public GraphQLViews.AssetView createAsset(@Argument("input") AssetInput input) {
        Asset asset = Asset.builder()
                .serialNumber(input.serialNumber())
                .model(input.model())
                .estimatedValue(input.estimatedValue())
                .status(input.status())
                .purchaseDate(input.purchaseDate() == null ? null : LocalDate.parse(input.purchaseDate()))
                .build();
        return GraphQLViews.AssetView.from(assetUseCase.register(asset));
    }

    public record AssetInput(
            String serialNumber,
            String model,
            Double estimatedValue,
            String status,
            String purchaseDate) {
    }
}
