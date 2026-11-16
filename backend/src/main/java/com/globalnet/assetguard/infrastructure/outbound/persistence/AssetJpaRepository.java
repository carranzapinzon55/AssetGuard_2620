package com.globalnet.assetguard.infrastructure.outbound.persistence;

import com.globalnet.assetguard.domain.model.AssetModelMetrics;
import com.globalnet.assetguard.infrastructure.outbound.persistence.entity.AssetEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

@Repository
public interface AssetJpaRepository extends JpaRepository<AssetEntity, Long> {

    Optional<AssetEntity> findBySerialNumber(String serialNumber);

    long countByStatusIn(Iterable<String> statuses);

    @Query("""
        select new com.globalnet.assetguard.domain.model.AssetModelMetrics(
            coalesce(asset.model, 'Sin categoría'),
            count(asset.id),
            sum(case when asset.status = 'AVAILABLE' then 1L else 0L end))
        from AssetEntity asset
        group by coalesce(asset.model, 'Sin categoría')
        order by coalesce(asset.model, 'Sin categoría')
        """)
    List<AssetModelMetrics> summarizeByModel();
}