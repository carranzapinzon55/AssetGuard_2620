package com.globalnet.assetguard.infrastructure.outbound.persistence;

import com.globalnet.assetguard.infrastructure.outbound.persistence.entity.AuditLogEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditLogJpaRepository extends JpaRepository<AuditLogEntity, Long> {

    boolean existsByEventTypeAndEntityTypeAndEntityId(String eventType, String entityType, Long entityId);
}