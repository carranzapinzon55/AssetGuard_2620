package com.globalnet.assetguard.infrastructure.outbound.persistence;

import com.globalnet.assetguard.infrastructure.outbound.persistence.entity.AssetEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AssetJpaRepository extends JpaRepository<AssetEntity, Long> {

    Optional<AssetEntity> findBySerialNumber(String serialNumber);
}