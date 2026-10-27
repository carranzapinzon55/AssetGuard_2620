package com.globalnet.assetguard.infrastructure.inbound.graphql;

import com.globalnet.assetguard.application.usecase.MaintenanceRecordUseCase;
import com.globalnet.assetguard.domain.model.Asset;
import com.globalnet.assetguard.domain.model.MaintenanceRecord;
import java.time.LocalDate;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.stereotype.Controller;

@Controller
public class MaintenanceRecordGraphQLController {

    private final MaintenanceRecordUseCase maintenanceRecordUseCase;

    public MaintenanceRecordGraphQLController(
            MaintenanceRecordUseCase maintenanceRecordUseCase) {
        this.maintenanceRecordUseCase = maintenanceRecordUseCase;
    }

    @MutationMapping
    public GraphQLViews.MaintenanceRecordView createMaintenanceRecord(
            @Argument("input") MaintenanceRecordInput input) {
        MaintenanceRecord record = MaintenanceRecord.builder()
                .asset(Asset.builder().id(input.assetId()).build())
                .providerName(input.providerName())
                .reason(input.reason())
                .cost(input.cost())
                .startDate(input.startDate() == null ? null : LocalDate.parse(input.startDate()))
                .endDate(input.endDate() == null ? null : LocalDate.parse(input.endDate()))
                .build();
        return GraphQLViews.MaintenanceRecordView.from(maintenanceRecordUseCase.execute(record));
    }

    public record MaintenanceRecordInput(
            Long assetId,
            String providerName,
            String reason,
            Double cost,
            String startDate,
            String endDate) {
    }
}
