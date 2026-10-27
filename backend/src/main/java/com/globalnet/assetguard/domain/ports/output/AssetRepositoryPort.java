package com.globalnet.assetguard.domain.ports.output;

import com.globalnet.assetguard.domain.model.Asset;
import java.util.List;
import java.util.Optional;

public interface AssetRepositoryPort {

    Asset save(Asset asset);

    Optional<Asset> findBySerialNumber(String serialNumber);

    Optional<Asset> findById(Long id);

    List<Asset> findAll();
}