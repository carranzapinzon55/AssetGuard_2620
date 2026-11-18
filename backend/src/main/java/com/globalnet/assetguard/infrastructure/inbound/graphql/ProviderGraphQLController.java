package com.globalnet.assetguard.infrastructure.inbound.graphql;

import com.globalnet.assetguard.application.usecase.ProviderUseCase;
import java.util.List;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;

@Controller
public class ProviderGraphQLController {

    private final ProviderUseCase providerUseCase;

    public ProviderGraphQLController(ProviderUseCase providerUseCase) {
        this.providerUseCase = providerUseCase;
    }

    @QueryMapping
    public List<GraphQLViews.ProviderView> providers() {
        return providerUseCase.findAllActive().stream()
                .map(GraphQLViews.ProviderView::from)
                .toList();
    }

    @MutationMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'INSPECTOR')")
    public GraphQLViews.ProviderView createProvider(@Argument("name") String name) {
        return GraphQLViews.ProviderView.from(providerUseCase.createProvider(name));
    }
}
