package com.globalnet.assetguard.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.globalnet.assetguard.domain.model.Provider;
import com.globalnet.assetguard.domain.ports.output.ProviderRepositoryPort;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ProviderUseCaseTest {

    @Mock
    private ProviderRepositoryPort providerRepositoryPort;

    @InjectMocks
    private ProviderUseCase providerUseCase;

    @Test
    void createsNewProviderWhenNotExisting() {
        when(providerRepositoryPort.findByName("TechCorp")).thenReturn(Optional.empty());
        when(providerRepositoryPort.save(any(Provider.class))).thenAnswer(invocation -> {
            Provider p = invocation.getArgument(0);
            return Provider.builder().id(10L).name(p.getName()).active(p.getActive()).build();
        });

        Provider created = providerUseCase.createProvider("TechCorp");

        assertNotNull(created);
        assertEquals(10L, created.getId());
        assertEquals("TechCorp", created.getName());
        assertTrue(created.getActive());
        verify(providerRepositoryPort).save(any(Provider.class));
    }

    @Test
    void returnsExistingActiveProvider() {
        Provider existing = Provider.builder().id(5L).name("Cisco").active(true).build();
        when(providerRepositoryPort.findByName("Cisco")).thenReturn(Optional.of(existing));

        Provider result = providerUseCase.createProvider("Cisco");

        assertEquals(existing, result);
        verify(providerRepositoryPort, never()).save(any(Provider.class));
    }

    @Test
    void reactivatesInactiveProvider() {
        Provider inactive = Provider.builder().id(5L).name("Dell").active(false).build();
        when(providerRepositoryPort.findByName("Dell")).thenReturn(Optional.of(inactive));
        when(providerRepositoryPort.save(inactive)).thenReturn(inactive);

        Provider result = providerUseCase.createProvider("Dell");

        assertTrue(result.getActive());
        verify(providerRepositoryPort).save(inactive);
    }

    @Test
    void rejectsEmptyOrNullName() {
        assertThrows(IllegalArgumentException.class, () -> providerUseCase.createProvider(null));
        assertThrows(IllegalArgumentException.class, () -> providerUseCase.createProvider("   "));
    }
}
