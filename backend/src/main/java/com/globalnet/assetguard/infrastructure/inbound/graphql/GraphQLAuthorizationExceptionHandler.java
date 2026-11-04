package com.globalnet.assetguard.infrastructure.inbound.graphql;

import graphql.GraphQLError;
import graphql.GraphqlErrorBuilder;
import org.springframework.graphql.data.method.annotation.GraphQlExceptionHandler;
import org.springframework.graphql.execution.ErrorType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.ControllerAdvice;

@ControllerAdvice
public class GraphQLAuthorizationExceptionHandler {

    @GraphQlExceptionHandler
    public GraphQLError handleAccessDenied(AccessDeniedException exception) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        boolean unauthenticated = authentication == null
                || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getPrincipal());
        return GraphqlErrorBuilder.newError()
                .errorType(unauthenticated ? ErrorType.UNAUTHORIZED : ErrorType.FORBIDDEN)
                .message(unauthenticated ? "Authentication is required." : "You do not have permission to access this resource.")
                .build();
    }

    @GraphQlExceptionHandler
    public GraphQLError handleAuthenticationRequired(AuthenticationCredentialsNotFoundException exception) {
        return GraphqlErrorBuilder.newError()
                .errorType(ErrorType.UNAUTHORIZED)
                .message("Authentication is required.")
                .build();
    }

    @GraphQlExceptionHandler
    public GraphQLError handleInvalidArgument(IllegalArgumentException exception) {
        return GraphqlErrorBuilder.newError()
                .errorType(ErrorType.BAD_REQUEST)
                .message("Invalid request arguments.")
                .build();
    }
}
