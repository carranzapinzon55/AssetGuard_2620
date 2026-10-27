package com.globalnet.assetguard.domain.ports.output;

import com.globalnet.assetguard.domain.model.User;

public interface TokenProviderPort {

    String generateToken(User user);
}