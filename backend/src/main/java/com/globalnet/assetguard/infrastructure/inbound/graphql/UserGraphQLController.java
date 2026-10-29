package com.globalnet.assetguard.infrastructure.inbound.graphql;

import com.globalnet.assetguard.application.usecase.RegisterUserUseCase;
import java.util.List;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.stereotype.Controller;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.security.access.prepost.PreAuthorize;
import com.globalnet.assetguard.domain.model.User;

@Controller
public class UserGraphQLController {

    private final RegisterUserUseCase registerUserUseCase;

    public UserGraphQLController(RegisterUserUseCase registerUserUseCase) {
        this.registerUserUseCase = registerUserUseCase;
    }

    @QueryMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<GraphQLViews.UserView> users() {
        return registerUserUseCase.findAll().stream()
                .map(GraphQLViews.UserView::from)
                .toList();
    }

    @MutationMapping
    @PreAuthorize("hasRole('ADMIN')")
    public GraphQLViews.UserView createUser(@Argument("input") UserInput input) {
        User user = User.builder()
                .fullName(input.fullName())
                .email(input.email())
                .password(input.password())
                .role(input.role())
                .status(input.status())
                .build();
        return GraphQLViews.UserView.from(registerUserUseCase.createManagedUser(user));
    }

    @MutationMapping
    @PreAuthorize("hasRole('ADMIN')")
    public GraphQLViews.UserView updateUser(@Argument("input") UpdateUserInput input) {
        User changes = User.builder()
                .id(input.id())
                .fullName(input.fullName())
                .email(input.email())
                .password(input.password())
                .role(input.role())
                .status(input.status())
                .build();
        return GraphQLViews.UserView.from(registerUserUseCase.updateManagedUser(changes));
    }

    public record UserInput(String fullName, String email, String password, String role, Boolean status) {
    }

    public record UpdateUserInput(
            Long id, String fullName, String email, String password, String role, Boolean status) {
    }
}
