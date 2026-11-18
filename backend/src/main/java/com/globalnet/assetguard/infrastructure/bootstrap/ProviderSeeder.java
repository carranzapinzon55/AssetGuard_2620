package com.globalnet.assetguard.infrastructure.bootstrap;

import com.globalnet.assetguard.infrastructure.outbound.persistence.ProviderJpaRepository;
import com.globalnet.assetguard.infrastructure.outbound.persistence.entity.ProviderEntity;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@Order(2)
public class ProviderSeeder implements CommandLineRunner {

    private static final Logger logger = LoggerFactory.getLogger(ProviderSeeder.class);

    private static final List<String> SEED_PROVIDERS = List.of(
            "Lenovo", "HP", "Dell", "Apple", "Cisco",
            "Fluke Networks", "Fujikura", "Anritsu", "MikroTik", "Vertiv",
            "Huawei", "Samsung", "Asus", "Bosch");

    private final ProviderJpaRepository providerJpaRepository;
    private final JdbcTemplate jdbcTemplate;

    public ProviderSeeder(ProviderJpaRepository providerJpaRepository, JdbcTemplate jdbcTemplate) {
        this.providerJpaRepository = providerJpaRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        int created = 0;
        for (String name : SEED_PROVIDERS) {
            if (!providerJpaRepository.existsByName(name)) {
                providerJpaRepository.save(ProviderEntity.builder().name(name).active(true).build());
                created++;
            }
        }
        if (created > 0) {
            logger.info("Seeded {} provider(s) into the providers table", created);
        } else {
            logger.info("All seed providers already exist; skipping provider bootstrap");
        }

        // Migrate any remnant legacy provider_name data to provider_id if column exists
        try {
            jdbcTemplate.execute(
                "INSERT INTO providers (name, active) " +
                "SELECT DISTINCT TRIM(provider_name), true " +
                "FROM maintenance_records " +
                "WHERE provider_name IS NOT NULL AND TRIM(provider_name) <> '' " +
                "ON CONFLICT (name) DO NOTHING"
            );
            int migrated = jdbcTemplate.update(
                "UPDATE maintenance_records mr " +
                "SET provider_id = p.id " +
                "FROM providers p " +
                "WHERE mr.provider_id IS NULL AND mr.provider_name IS NOT NULL AND TRIM(mr.provider_name) = p.name"
            );
            if (migrated > 0) {
                logger.info("Migrated {} maintenance record(s) from legacy provider_name to provider_id", migrated);
            }
        } catch (Exception ex) {
            logger.debug("Legacy provider_name column not found or already migrated: {}", ex.getMessage());
        }
    }
}
