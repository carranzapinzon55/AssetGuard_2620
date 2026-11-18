package com.globalnet.assetguard.application.usecase;

import com.globalnet.assetguard.domain.model.Provider;
import com.globalnet.assetguard.domain.ports.output.ProviderRepositoryPort;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProviderUseCase {

    private final ProviderRepositoryPort providerRepositoryPort;

    public ProviderUseCase(ProviderRepositoryPort providerRepositoryPort) {
        this.providerRepositoryPort = providerRepositoryPort;
    }

    public List<Provider> findAllActive() {
        return providerRepositoryPort.findAllActive();
    }

    @Transactional
    public Provider createProvider(String name) {
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("El nombre del proveedor es obligatorio");
        }
        String cleanName = name.trim();
        return providerRepositoryPort.findByName(cleanName)
                .map(existing -> {
                    if (Boolean.FALSE.equals(existing.getActive())) {
                        existing.setActive(true);
                        return providerRepositoryPort.save(existing);
                    }
                    return existing;
                })
                .orElseGet(() -> providerRepositoryPort.save(Provider.builder()
                        .name(cleanName)
                        .active(true)
                        .build()));
    }
}
