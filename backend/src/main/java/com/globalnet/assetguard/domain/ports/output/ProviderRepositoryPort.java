package com.globalnet.assetguard.domain.ports.output;

import com.globalnet.assetguard.domain.model.Provider;
import java.util.List;
import java.util.Optional;

public interface ProviderRepositoryPort {
    List<Provider> findAllActive();
    Provider save(Provider provider);
    Optional<Provider> findByName(String name);
    Optional<Provider> findById(Long id);
}
