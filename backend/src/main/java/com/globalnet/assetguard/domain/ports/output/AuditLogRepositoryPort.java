package com.globalnet.assetguard.domain.ports.output;

import com.globalnet.assetguard.domain.model.AuditLog;

public interface AuditLogRepositoryPort {

    AuditLog save(AuditLog auditLog);

    boolean existsByEventTypeAndEntityTypeAndEntityId(String eventType, String entityType, Long entityId);
}