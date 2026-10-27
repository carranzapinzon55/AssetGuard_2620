package com.globalnet.assetguard.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.globalnet.assetguard.domain.model.Loan;
import com.globalnet.assetguard.domain.ports.output.LoanRepositoryPort;
import com.globalnet.assetguard.domain.ports.output.AssetRepositoryPort;
import com.globalnet.assetguard.infrastructure.outbound.persistence.AssetJpaRepository;
import com.globalnet.assetguard.infrastructure.outbound.persistence.LoanJpaRepository;
import com.globalnet.assetguard.infrastructure.outbound.persistence.UserEntity;
import com.globalnet.assetguard.infrastructure.outbound.persistence.UserJpaRepository;
import com.globalnet.assetguard.infrastructure.outbound.persistence.entity.AssetEntity;
import com.globalnet.assetguard.infrastructure.outbound.persistence.entity.LoanEntity;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.math.BigDecimal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:bulkassets;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "security.jwt.secret=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="
})
class BulkUploadAssetsUseCaseIntegrationTest {

    @Autowired
    private BulkUploadAssetsUseCase bulkUploadAssetsUseCase;

    @Autowired
    private AssetRepositoryPort assetRepositoryPort;

        @Autowired
        private LoanRepositoryPort loanRepositoryPort;

        @Autowired
        private AssetJpaRepository assetJpaRepository;

        @Autowired
        private LoanJpaRepository loanJpaRepository;

        @Autowired
        private UserJpaRepository userJpaRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void clearAssets() {
        jdbcTemplate.update("delete from loans");
        jdbcTemplate.update("delete from maintenance_records");
        jdbcTemplate.update("delete from assets");
        jdbcTemplate.update("delete from users");
    }

    @Test
    void rollsBackEntireBatchWhenAnyRowIsInvalid() {
        String csv = "serialNumber,model,estimatedValue,purchaseDate\n"
                + "ROLLBACK-1,Camera,120,2026-03-15\n"
                + "ROLLBACK-2,Laptop,-9,2026-03-16\n";

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> bulkUploadAssetsUseCase.execute("assets.csv", csv.getBytes(StandardCharsets.UTF_8)));

        assertEquals("Error en la fila 3: estimatedValue debe ser un valor numérico positivo",
                exception.getMessage());
        assertEquals(0, assetRepositoryPort.findAll().size());
    }

    @Test
    void rejectsDuplicateSerialWithinTheSameUploadBeforePersisting() {
        String csv = "serialNumber,model,estimatedValue,purchaseDate\n"
                + "DUPLICATE-1,Camera,120,2026-03-15\n"
                + "DUPLICATE-1,Laptop,900,2026-03-16\n";

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> bulkUploadAssetsUseCase.execute("assets.csv", csv.getBytes(StandardCharsets.UTF_8)));

        assertEquals("Error en la fila 3: El serial DUPLICATE-1 está duplicado en el archivo",
                exception.getMessage());
        assertEquals(0, assetRepositoryPort.findAll().size());
    }

    @Test
    void personalHistoryAndAuditApplyFiltersAndPaginationWithRelatedDetails() {
        UserEntity technician = saveTechnician("audit-tech@example.com");
        AssetEntity asset = saveAsset("AUDIT-LOST", 125.0, "LOST");
        saveLoan(technician, asset, Loan.Status.RETURNED, Loan.ReturnCondition.LOST,
                LocalDate.now().minusDays(2), LocalDateTime.now().minusDays(1));
        saveLoan(technician, saveAsset("AUDIT-DAMAGED", 225.0, "UNDER_MAINTENANCE"),
                Loan.Status.RETURNED, Loan.ReturnCondition.DAMAGED,
                LocalDate.now().minusDays(1), LocalDateTime.now());

        var history = loanRepositoryPort.findByUserId(technician.getId());
        var audit = loanRepositoryPort.searchAudit(
                "audit-lost", technician.getId(), LocalDate.now().minusDays(5).atStartOfDay(),
                LocalDate.now().plusDays(1).atStartOfDay(), Loan.Status.RETURNED, 0, 1);

        assertEquals(2, history.size());
        assertEquals(true, history.stream().anyMatch(loan ->
                "AUDIT-LOST".equals(loan.getAsset().getSerialNumber())
                        && "Audit Technician".equals(loan.getUser().getFullName())));
        assertEquals(1, audit.loans().size());
        assertEquals(1, audit.totalElements());
        assertEquals("AUDIT-LOST", audit.loans().get(0).getAsset().getSerialNumber());
    }

    @Test
    void dashboardAggregatesLossesOnTimeReturnsAndAssetsInField() {
        UserEntity technician = saveTechnician("metrics-tech@example.com");
        AssetEntity lostAsset = saveAsset("METRIC-LOST", 100.0, "LOST");
        AssetEntity damagedAsset = saveAsset("METRIC-DAMAGED", 250.0, "UNDER_MAINTENANCE");
        AssetEntity fieldAsset = saveAsset("METRIC-FIELD", 400.0, "LOANED");
        LocalDate today = LocalDate.now();
        saveLoan(technician, lostAsset, Loan.Status.RETURNED, Loan.ReturnCondition.LOST,
                today.minusDays(1), today.minusDays(1).atTime(10, 0));
        saveLoan(technician, damagedAsset, Loan.Status.RETURNED, Loan.ReturnCondition.DAMAGED,
                today.minusDays(2), today.atTime(10, 0));
        saveLoan(technician, fieldAsset, Loan.Status.APPROVED, null,
                today.plusDays(2), null);

        var metrics = loanRepositoryPort.calculateDashboardMetrics();

        assertEquals(0, new BigDecimal("350.0").compareTo(metrics.estimatedLossValue()));
        assertEquals(50.0, metrics.onTimeReturnPercentage(), 0.001);
        assertEquals(1, metrics.assetsCurrentlyInField());
    }

    private UserEntity saveTechnician(String email) {
        return userJpaRepository.save(UserEntity.builder()
                .fullName("Audit Technician")
                .email(email)
                .password("hash")
                .role("TECHNICIAN")
                .status(true)
                .build());
    }

    private AssetEntity saveAsset(String serial, double value, String status) {
        return assetJpaRepository.save(AssetEntity.builder()
                .serialNumber(serial)
                .model("Test model")
                .estimatedValue(value)
                .status(status)
                .purchaseDate(LocalDate.now().minusYears(1))
                .build());
    }

    private void saveLoan(
            UserEntity user,
            AssetEntity asset,
            Loan.Status status,
            Loan.ReturnCondition condition,
            LocalDate dueDate,
            LocalDateTime returnedAt) {
        loanJpaRepository.save(LoanEntity.builder()
                .user(user)
                .asset(asset)
                .status(status)
                .returnCondition(condition)
                .requestDate(LocalDateTime.now().minusDays(4))
                .dueLocalDate(dueDate)
                .returnDateTime(returnedAt)
                .build());
    }
}