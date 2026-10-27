package com.globalnet.assetguard.infrastructure.inbound.graphql;

import com.globalnet.assetguard.application.usecase.RegisterUserUseCase;
import java.util.List;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.stereotype.Controller;

@Controller
public class UserGraphQLController {

    private final RegisterUserUseCase registerUserUseCase;

    public UserGraphQLController(RegisterUserUseCase registerUserUseCase) {
        this.registerUserUseCase = registerUserUseCase;
    }

    @QueryMapping
    public List<GraphQLViews.UserView> users() {
        return registerUserUseCase.findAll().stream()
                .map(GraphQLViews.UserView::from)
                .toList();
    }
}
