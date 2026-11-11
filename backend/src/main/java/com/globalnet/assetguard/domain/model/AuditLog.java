package com.globalnet.assetguard.domain.model;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {
    private Long id;
    private String eventType;
    private String entityType;
    private Long entityId;
    private String details;
    private LocalDateTime occurredAt;
}