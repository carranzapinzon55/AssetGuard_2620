package com.globalnet.assetguard.application.usecase;

import com.globalnet.assetguard.domain.model.Asset;
import com.globalnet.assetguard.domain.model.Loan;
import com.globalnet.assetguard.domain.ports.output.AssetRepositoryPort;
import com.globalnet.assetguard.domain.ports.output.LoanRepositoryPort;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.NoSuchElementException;
import org.springframework.stereotype.Service;

@Service
public class LoanUseCase {

    private final LoanRepositoryPort loanRepositoryPort;
    private final AssetRepositoryPort assetRepositoryPort;

    public LoanUseCase(
            LoanRepositoryPort loanRepositoryPort,
            AssetRepositoryPort assetRepositoryPort) {
        this.loanRepositoryPort = loanRepositoryPort;
        this.assetRepositoryPort = assetRepositoryPort;
    }

    public Loan execute(Loan loan) {
        if (loan == null) {
            throw new IllegalArgumentException("Loan must not be null");
        }
        if (loan.getAsset() == null || loan.getAsset().getId() == null) {
            throw new IllegalArgumentException("Loan must reference an asset with an ID");
        }

        Asset asset = assetRepositoryPort.findById(loan.getAsset().getId())
                .orElseThrow(() -> new NoSuchElementException(
                        "Asset not found with ID: " + loan.getAsset().getId()));
        loan.setAsset(asset);

        if (loan.getDueLocalDate() != null) {
            long daysLate = ChronoUnit.DAYS.between(loan.getDueLocalDate(), LocalDate.now());
            loan.setDelayDays(daysLate > 0 ? Math.toIntExact(daysLate) : 0);
        }

        return loanRepositoryPort.save(loan);
    }

    public List<Loan> findAll() {
        return loanRepositoryPort.findAll();
    }
}
