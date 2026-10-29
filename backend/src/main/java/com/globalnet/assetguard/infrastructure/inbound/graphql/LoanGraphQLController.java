package com.globalnet.assetguard.infrastructure.inbound.graphql;

import com.globalnet.assetguard.application.usecase.LoanUseCase;
import com.globalnet.assetguard.domain.model.Loan;
import com.globalnet.assetguard.domain.model.LoanAuditPage;
import com.globalnet.assetguard.domain.model.LoanDashboardMetrics;
import com.globalnet.assetguard.infrastructure.security.CurrentAuthenticatedUser;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.stereotype.Controller;
import org.springframework.security.access.prepost.PreAuthorize;

@Controller
public class LoanGraphQLController {

    private final LoanUseCase loanUseCase;
    private final CurrentAuthenticatedUser currentAuthenticatedUser;

    public LoanGraphQLController(LoanUseCase loanUseCase, CurrentAuthenticatedUser currentAuthenticatedUser) {
        this.loanUseCase = loanUseCase;
        this.currentAuthenticatedUser = currentAuthenticatedUser;
    }

    @QueryMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'INSPECTOR')")
    public List<GraphQLViews.LoanView> loans() {
        return loanUseCase.findAll().stream()
                .map(GraphQLViews.LoanView::from)
                .toList();
    }

    @QueryMapping
    @PreAuthorize("hasRole('TECHNICIAN')")
    public List<GraphQLViews.LoanView> myLoanHistory() {
        return loanUseCase.myLoanHistory(currentAuthenticatedUser.requirePrincipal().userId())
                .stream()
                .map(GraphQLViews.LoanView::from)
                .toList();
    }

    @QueryMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'INSPECTOR')")
    public LoanAuditPageView auditLogs(
            @Argument String serialNumber,
            @Argument Long technicianId,
            @Argument String startDate,
            @Argument String endDate,
            @Argument Loan.Status status,
            @Argument Integer page,
            @Argument Integer limit) {
        LoanAuditPage result = loanUseCase.auditLogs(
                serialNumber,
                technicianId,
                parseDate(startDate, false),
                parseDate(endDate, true),
                status,
                page,
                limit);
        return new LoanAuditPageView(
                result.loans().stream().map(GraphQLViews.LoanView::from).toList(),
                result.totalElements(),
                result.page(),
                result.limit(),
                (int) Math.ceil((double) result.totalElements() / result.limit()));
    }

    @QueryMapping
    @PreAuthorize("hasRole('ADMIN')")
    public LoanDashboardMetrics dashboardMetrics(
            @Argument String startDate,
            @Argument String endDate) {
        return loanUseCase.dashboardMetrics(parseDate(startDate, false), parseDate(endDate, true));
    }

    private LocalDateTime parseDate(String value, boolean endOfDay) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDateTime.parse(value);
        } catch (java.time.format.DateTimeParseException ignored) {
            LocalDate date = LocalDate.parse(value);
            return endOfDay ? date.plusDays(1).atStartOfDay().minusNanos(1) : date.atStartOfDay();
        }
    }

    public record LoanAuditPageView(
            List<GraphQLViews.LoanView> loans,
            long totalElements,
            int page,
            int limit,
            int totalPages) {
    }

    @MutationMapping
    @PreAuthorize("hasRole('TECHNICIAN')")
    public GraphQLViews.LoanView requestLoan(@Argument("input") RequestLoanInput input) {
        return GraphQLViews.LoanView.from(loanUseCase.requestLoan(
                currentAuthenticatedUser.requirePrincipal().userId(),
                input.assetId(),
                LocalDate.parse(input.dueDate())));
    }

    @MutationMapping
    @PreAuthorize("hasRole('INSPECTOR')")
    public GraphQLViews.LoanView approveLoan(@Argument("input") ApproveLoanInput input) {
        return GraphQLViews.LoanView.from(
                loanUseCase.approveLoan(input.loanId(), currentAuthenticatedUser.requirePrincipal().userId()));
        }

    @MutationMapping
    @PreAuthorize("hasRole('INSPECTOR')")
    public GraphQLViews.LoanView rejectLoan(@Argument("input") RejectLoanInput input) {
        return GraphQLViews.LoanView.from(
                loanUseCase.rejectLoan(
                        input.loanId(), currentAuthenticatedUser.requirePrincipal().userId(), input.reason()));
        }

    @MutationMapping
    @PreAuthorize("hasAnyRole('TECHNICIAN', 'INSPECTOR')")
    public GraphQLViews.LoanView returnLoan(@Argument("input") ReturnLoanInput input) {
        Long actorId = currentAuthenticatedUser.requirePrincipal().userId();
        if (isInspector()) {
            return GraphQLViews.LoanView.from(
                    loanUseCase.returnAssetAsInspector(input.loanId(), input.condition(), actorId));
        }
        return GraphQLViews.LoanView.from(loanUseCase.returnAsset(
                input.loanId(), input.condition(), actorId));
        }

    private boolean isInspector() {
        return org.springframework.security.core.context.SecurityContextHolder.getContext()
                .getAuthentication().getAuthorities().stream()
                .anyMatch(authority -> "ROLE_INSPECTOR".equals(authority.getAuthority()));
    }

    public record RequestLoanInput(Long assetId, String dueDate) {
    }

    public record ApproveLoanInput(Long loanId) {
    }

    public record RejectLoanInput(Long loanId, String reason) {
    }

    public record ReturnLoanInput(Long loanId, Loan.ReturnCondition condition) {
    }
}
