package com.globalnet.assetguard.infrastructure.inbound.graphql;

import static org.junit.jupiter.api.Assertions.assertEquals;

import graphql.GraphQLError;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.graphql.execution.ErrorType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

class GraphQLAuthorizationExceptionHandlerTest {

    private final GraphQLAuthorizationExceptionHandler handler = new GraphQLAuthorizationExceptionHandler();

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void mapsAnonymousAccessDenialToUnauthorized() {
        SecurityContextHolder.clearContext();

        GraphQLError error = handler.handleAccessDenied(new AccessDeniedException("Denied"));

        assertEquals(ErrorType.UNAUTHORIZED, error.getErrorType());
    }

    @Test
    void mapsAuthenticatedAccessDenialToForbidden() {
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated(
                        "inspector", null, List.of(new SimpleGrantedAuthority("ROLE_INSPECTOR"))));

        GraphQLError error = handler.handleAccessDenied(new AccessDeniedException("Denied"));

        assertEquals(ErrorType.FORBIDDEN, error.getErrorType());
    }

    @Test
    void mapsInvalidArgumentsToBadRequest() {
        GraphQLError error = handler.handleInvalidArgument(new IllegalArgumentException("Invalid date"));

        assertEquals(ErrorType.BAD_REQUEST, error.getErrorType());
    }
}
