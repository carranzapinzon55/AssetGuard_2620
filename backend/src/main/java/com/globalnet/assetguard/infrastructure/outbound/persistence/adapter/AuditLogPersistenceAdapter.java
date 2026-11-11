package com.globalnet.assetguard.infrastructure.outbound.persistence.adapter;

import com.globalnet.assetguard.domain.model.AuditLog;
import com.globalnet.assetguard.domain.ports.output.AuditLogRepositoryPort;
import com.globalnet.assetguard.infrastructure.outbound.persistence.AuditLogJpaRepository;
import com.globalnet.assetguard.infrastructure.outbound.persistence.entity.AuditLogEntity;
import org.springframework.stereotype.Repository;

@Repository
public class AuditLogPersistenceAdapter implements AuditLogRepositoryPort {

    private final AuditLogJpaRepository auditLogJpaRepository;

    public AuditLogPersistenceAdapter(AuditLogJpaRepository auditLogJpaRepository) {
        this.auditLogJpaRepository = auditLogJpaRepository;
    }

    @Override
    public AuditLog save(AuditLog auditLog) {
        AuditLogEntity entity = AuditLogEntity.builder()
                .id(auditLog.getId())
                .eventType(auditLog.getEventType())
                .entityType(auditLog.getEntityType())
                .entityId(auditLog.getEntityId())
                .details(auditLog.getDetails())
                .occurredAt(auditLog.getOccurredAt())
                .build();
        AuditLogEntity saved = auditLogJpaRepository.save(entity);
        return AuditLog.builder()
                .id(saved.getId())
                .eventType(saved.getEventType())
                .entityType(saved.getEntityType())
                .entityId(saved.getEntityId())
                .details(saved.getDetails())
                .occurredAt(saved.getOccurredAt())
                .build();
    }

    @Override
    public boolean existsByEventTypeAndEntityTypeAndEntityId(String eventType, String entityType, Long entityId) {
        return auditLogJpaRepository.existsByEventTypeAndEntityTypeAndEntityId(eventType, entityType, entityId);
    }
}