package com.globalnet.assetguard.infrastructure.inbound.graphql;

import com.globalnet.assetguard.application.usecase.MaintenanceRecordUseCase;
import com.globalnet.assetguard.domain.model.Asset;
import com.globalnet.assetguard.domain.model.MaintenanceRecord;
import com.globalnet.assetguard.domain.model.Provider;
import com.globalnet.assetguard.infrastructure.security.CurrentAuthenticatedUser;
import java.time.LocalDate;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.stereotype.Controller;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.security.access.prepost.PreAuthorize;
import java.util.List;

@Controller
public class MaintenanceRecordGraphQLController {

    private final MaintenanceRecordUseCase maintenanceRecordUseCase;
    private final CurrentAuthenticatedUser currentAuthenticatedUser;

    public MaintenanceRecordGraphQLController(
            MaintenanceRecordUseCase maintenanceRecordUseCase,
            CurrentAuthenticatedUser currentAuthenticatedUser) {
        this.maintenanceRecordUseCase = maintenanceRecordUseCase;
        this.currentAuthenticatedUser = currentAuthenticatedUser;
    }

    @QueryMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'INSPECTOR')")
    public List<GraphQLViews.MaintenanceRecordView> maintenanceRecords() {
        return maintenanceRecordUseCase.findAll().stream()
                .map(GraphQLViews.MaintenanceRecordView::from)
                .toList();
    }

    @MutationMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'INSPECTOR')")
    public GraphQLViews.MaintenanceRecordView createMaintenanceRecord(
            @Argument("input") MaintenanceRecordInput input) {
        Provider provider = null;
        if (input.providerId() != null) {
            provider = Provider.builder().id(input.providerId()).build();
        } else if (input.providerName() != null && !input.providerName().isBlank()) {
            provider = Provider.builder().name(input.providerName().trim()).build();
        }

        MaintenanceRecord record = MaintenanceRecord.builder()
                .asset(Asset.builder().id(input.assetId()).build())
                .provider(provider)
                .reason(input.reason())
                .cost(input.cost())
                .startDate(input.startDate() == null ? null : LocalDate.parse(input.startDate()))
                .endDate(input.endDate() == null ? null : LocalDate.parse(input.endDate()))
                .build();
        return GraphQLViews.MaintenanceRecordView.from(maintenanceRecordUseCase.execute(record));
    }

    @MutationMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'INSPECTOR')")
    public GraphQLViews.MaintenanceRecordView completeMaintenance(@Argument("input") CompleteMaintenanceInput input) {
        return GraphQLViews.MaintenanceRecordView.from(maintenanceRecordUseCase.complete(input.recordId()));
    }

    @MutationMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'INSPECTOR')")
    public GraphQLViews.MaintenanceRecordView decommissionFromMaintenance(
            @Argument("id") Long id,
            @Argument("notes") String notes) {
        Long operatorId = currentAuthenticatedUser.requirePrincipal().userId();
        return GraphQLViews.MaintenanceRecordView.from(
                maintenanceRecordUseCase.decommission(id, notes, operatorId));
    }

    @MutationMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'INSPECTOR')")
    public GraphQLViews.MaintenanceRecordView updateMaintenanceRecord(
            @Argument("input") UpdateMaintenanceRecordInput input) {
        Provider provider = null;
        if (input.providerId() != null) {
            provider = Provider.builder().id(input.providerId()).build();
        } else if (input.providerName() != null && !input.providerName().isBlank()) {
            provider = Provider.builder().name(input.providerName().trim()).build();
        }

        MaintenanceRecord changes = MaintenanceRecord.builder()
                .provider(provider)
                .reason(input.reason())
                .cost(input.cost())
                .build();
        return GraphQLViews.MaintenanceRecordView.from(
                maintenanceRecordUseCase.update(input.recordId(), changes));
    }

    public record CompleteMaintenanceInput(Long recordId) {
    }

    public record UpdateMaintenanceRecordInput(
            Long recordId, Long providerId, String providerName, String reason, Double cost) {
    }

    public record MaintenanceRecordInput(
            Long assetId,
            Long providerId,
            String providerName,
            String reason,
            Double cost,
            String startDate,
            String endDate) {
    }
}
