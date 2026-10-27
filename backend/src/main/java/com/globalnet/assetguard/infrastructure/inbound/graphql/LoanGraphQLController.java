package com.globalnet.assetguard.infrastructure.inbound.graphql;

import com.globalnet.assetguard.application.usecase.LoanUseCase;
import com.globalnet.assetguard.domain.model.Asset;
import com.globalnet.assetguard.domain.model.Loan;
import com.globalnet.assetguard.domain.model.User;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.stereotype.Controller;

@Controller
public class LoanGraphQLController {

    private final LoanUseCase loanUseCase;

    public LoanGraphQLController(LoanUseCase loanUseCase) {
        this.loanUseCase = loanUseCase;
    }

    @QueryMapping
    public List<GraphQLViews.LoanView> loans() {
        return loanUseCase.findAll().stream()
                .map(GraphQLViews.LoanView::from)
                .toList();
    }

    @MutationMapping
    public GraphQLViews.LoanView createLoan(@Argument("input") LoanInput input) {
        Loan loan = Loan.builder()
                .user(User.builder().id(input.userId()).build())
                .asset(Asset.builder().id(input.assetId()).build())
                .requestDate(input.requestDate() == null ? null : LocalDateTime.parse(input.requestDate()))
                .dueLocalDate(input.dueLocalDate() == null ? null : LocalDate.parse(input.dueLocalDate()))
                .status(input.status())
                .build();
        return GraphQLViews.LoanView.from(loanUseCase.execute(loan));
    }

    public record LoanInput(
            Long userId,
            Long assetId,
            String requestDate,
            String dueLocalDate,
            String status) {
    }
}
