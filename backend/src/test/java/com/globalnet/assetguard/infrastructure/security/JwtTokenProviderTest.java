package com.globalnet.assetguard.infrastructure.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.globalnet.assetguard.domain.model.User;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class JwtTokenProviderTest {

    private JwtTokenProvider jwtTokenProvider;

    @BeforeEach
    void setUp() {
        jwtTokenProvider = new JwtTokenProvider(
                "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=", 60_000);
    }

    @Test
    void generatedTokenIncludesIdentityAndRoleClaims() {
        User user = User.builder()
                .id(42L)
                .email("tech@example.com")
                .role("technician")
                .build();

        String token = jwtTokenProvider.generateToken(user);

        assertEquals(42L, jwtTokenProvider.validateAndGetClaims(token).get("id", Long.class));
        assertEquals("tech@example.com", jwtTokenProvider.validateAndGetClaims(token).get("email"));
        assertEquals("TECHNICIAN", jwtTokenProvider.validateAndGetClaims(token).get("role"));
    }

    @Test
    void invalidTokenIsRejected() {
        assertThrows(JwtException.class,
                () -> jwtTokenProvider.validateAndGetClaims("not-a-valid-jwt"));
    }
}