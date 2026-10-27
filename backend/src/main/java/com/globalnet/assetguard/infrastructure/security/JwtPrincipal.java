package com.globalnet.assetguard.infrastructure.security;

public record JwtPrincipal(Long userId, String email) {
}