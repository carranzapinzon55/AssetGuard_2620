package com.globalnet.assetguard.infrastructure.inbound.rest;

import com.globalnet.assetguard.application.usecase.LoanUseCase;
import com.globalnet.assetguard.domain.model.Loan;
import com.globalnet.assetguard.infrastructure.inbound.rest.dto.LoanRequestDto;
import com.globalnet.assetguard.infrastructure.security.CurrentAuthenticatedUser;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/loans")
public class LoanController {

    private final LoanUseCase loanUseCase;
    private final CurrentAuthenticatedUser currentAuthenticatedUser;

    public LoanController(LoanUseCase loanUseCase, CurrentAuthenticatedUser currentAuthenticatedUser) {
        this.loanUseCase = loanUseCase;
        this.currentAuthenticatedUser = currentAuthenticatedUser;
    }

    @PostMapping
    @PreAuthorize("hasRole('TECHNICIAN')")
    public ResponseEntity<Loan> registerLoan(@RequestBody LoanRequestDto request) {
        Loan savedLoan = loanUseCase.requestLoan(
                currentAuthenticatedUser.requirePrincipal().userId(),
                request.getAssetId(),
                request.getDueLocalDate());
        return ResponseEntity.status(HttpStatus.CREATED).body(savedLoan);
    }
}
