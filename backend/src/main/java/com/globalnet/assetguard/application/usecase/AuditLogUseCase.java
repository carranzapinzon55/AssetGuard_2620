package com.globalnet.assetguard.application.usecase;

import com.globalnet.assetguard.domain.model.AuditLog;
import com.globalnet.assetguard.domain.ports.output.AuditLogRepositoryPort;
import java.time.LocalDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditLogUseCase {

    private final AuditLogRepositoryPort auditLogRepositoryPort;

    public AuditLogUseCase(AuditLogRepositoryPort auditLogRepositoryPort) {
        this.auditLogRepositoryPort = auditLogRepositoryPort;
    }

    @Transactional
    public void record(String eventType, String entityType, Long entityId, String details) {
        auditLogRepositoryPort.save(AuditLog.builder()
                .eventType(eventType)
                .entityType(entityType)
                .entityId(entityId)
                .details(details)
                .occurredAt(LocalDateTime.now())
                .build());
    }

    @Transactional
    public void recordOnce(String eventType, String entityType, Long entityId, String details) {
        if (!auditLogRepositoryPort.existsByEventTypeAndEntityTypeAndEntityId(eventType, entityType, entityId)) {
            record(eventType, entityType, entityId, details);
        }
    }
}