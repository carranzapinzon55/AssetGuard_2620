package com.globalnet.assetguard.infrastructure.inbound.graphql;

import com.globalnet.assetguard.application.usecase.AuthenticationUseCase;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;

@Controller
public class AuthenticationGraphQLController {

    private final AuthenticationUseCase authenticationUseCase;

    public AuthenticationGraphQLController(AuthenticationUseCase authenticationUseCase) {
        this.authenticationUseCase = authenticationUseCase;
    }

    @MutationMapping
    @PreAuthorize("permitAll()")
    public LoginPayload login(@Argument("input") LoginInput input) {
        AuthenticationUseCase.LoginResult result =
                authenticationUseCase.login(input.email(), input.password());
        return new LoginPayload(result.token(), GraphQLViews.UserView.from(result.user()));
    }

    public record LoginInput(String email, String password) {
    }

    public record LoginPayload(String token, GraphQLViews.UserView user) {
    }
}