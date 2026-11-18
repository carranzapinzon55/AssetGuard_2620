package com.globalnet.assetguard.infrastructure.outbound.persistence;

import com.globalnet.assetguard.infrastructure.outbound.persistence.entity.ProviderEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProviderJpaRepository extends JpaRepository<ProviderEntity, Long> {

    Optional<ProviderEntity> findByName(String name);

    boolean existsByName(String name);
}
