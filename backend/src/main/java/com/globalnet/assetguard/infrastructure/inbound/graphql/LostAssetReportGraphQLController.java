package com.globalnet.assetguard.infrastructure.inbound.graphql;

import com.globalnet.assetguard.application.usecase.LostAssetReportUseCase;
import java.util.List;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;

@Controller
public class LostAssetReportGraphQLController {

    private final LostAssetReportUseCase lostAssetReportUseCase;

    public LostAssetReportGraphQLController(LostAssetReportUseCase lostAssetReportUseCase) {
        this.lostAssetReportUseCase = lostAssetReportUseCase;
    }

    @QueryMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'INSPECTOR')")
    public List<GraphQLViews.LostAssetReportView> lostAssetReports() {
        return lostAssetReportUseCase.findAll().stream()
                .map(GraphQLViews.LostAssetReportView::from)
                .toList();
    }

    @MutationMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'INSPECTOR')")
    public GraphQLViews.LostAssetReportView acknowledgeLostAssetReport(@Argument("id") Long id) {
        return GraphQLViews.LostAssetReportView.from(lostAssetReportUseCase.acknowledge(id));
    }
}
