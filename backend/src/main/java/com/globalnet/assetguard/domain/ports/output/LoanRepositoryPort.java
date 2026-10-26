package com.globalnet.assetguard.domain.ports.output;

import com.globalnet.assetguard.domain.model.Loan;
import java.util.Optional;

public interface LoanRepositoryPort {

    Loan save(Loan loan);

    Optional<Loan> findById(Long id);
}