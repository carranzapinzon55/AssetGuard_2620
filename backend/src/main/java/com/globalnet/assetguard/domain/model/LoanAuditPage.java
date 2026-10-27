package com.globalnet.assetguard.domain.model;

import java.util.List;

public record LoanAuditPage(List<Loan> loans, long totalElements, int page, int limit) {
}