package com.globalnet.assetguard.infrastructure.outbound.persistence.adapter;

import com.globalnet.assetguard.domain.model.Provider;
import com.globalnet.assetguard.domain.ports.output.ProviderRepositoryPort;
import com.globalnet.assetguard.infrastructure.outbound.persistence.ProviderJpaRepository;
import com.globalnet.assetguard.infrastructure.outbound.persistence.entity.ProviderEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Repository;

@Repository
public class ProviderPersistenceAdapter implements ProviderRepositoryPort {

    private final ProviderJpaRepository providerJpaRepository;

    public ProviderPersistenceAdapter(ProviderJpaRepository providerJpaRepository) {
        this.providerJpaRepository = providerJpaRepository;
    }

    @Override
    public List<Provider> findAllActive() {
        return providerJpaRepository.findAll().stream()
                .filter(entity -> Boolean.TRUE.equals(entity.getActive()))
                .map(this::toDomain)
                .toList();
    }

    @Override
    public Provider save(Provider provider) {
        ProviderEntity entity = ProviderEntity.builder()
                .id(provider.getId())
                .name(provider.getName())
                .active(provider.getActive() != null ? provider.getActive() : true)
                .build();
        return toDomain(providerJpaRepository.save(entity));
    }

    @Override
    public Optional<Provider> findByName(String name) {
        return providerJpaRepository.findByName(name).map(this::toDomain);
    }

    @Override
    public Optional<Provider> findById(Long id) {
        return providerJpaRepository.findById(id).map(this::toDomain);
    }

    private Provider toDomain(ProviderEntity entity) {
        if (entity == null) {
            return null;
        }
        return Provider.builder()
                .id(entity.getId())
                .name(entity.getName())
                .active(entity.getActive())
                .build();
    }
}
