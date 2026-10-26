package com.globalnet.assetguard.infrastructure.outbound.persistence;

import com.globalnet.assetguard.infrastructure.outbound.persistence.entity.LoanEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LoanJpaRepository extends JpaRepository<LoanEntity, Long> {
}