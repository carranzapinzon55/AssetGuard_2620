package com.globalnet.assetguard.infrastructure.inbound.rest;

import com.globalnet.assetguard.application.usecase.LoanUseCase;
import com.globalnet.assetguard.domain.model.Asset;
import com.globalnet.assetguard.domain.model.Loan;
import com.globalnet.assetguard.domain.model.User;
import com.globalnet.assetguard.infrastructure.inbound.rest.dto.LoanRequestDto;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/loans")
public class LoanController {

    private final LoanUseCase loanUseCase;

    public LoanController(LoanUseCase loanUseCase) {
        this.loanUseCase = loanUseCase;
    }

    @PostMapping
    public ResponseEntity<Loan> registerLoan(@RequestBody LoanRequestDto request) {
        Loan loan = Loan.builder()
                .user(request.getUserId() == null ? null : User.builder().id(request.getUserId()).build())
                .asset(request.getAssetId() == null ? null : Asset.builder().id(request.getAssetId()).build())
                .requestDate(request.getRequestDate())
                .dueLocalDate(request.getDueLocalDate())
                .status(request.getStatus())
                .build();

        Loan savedLoan = loanUseCase.execute(loan);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedLoan);
    }
}
