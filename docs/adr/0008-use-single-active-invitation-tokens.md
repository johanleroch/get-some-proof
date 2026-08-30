# Use single active invitation tokens

Each pending invitation has one random, single-use token that expires after seven days and is stored only as a hash. Resending or changing the intended role rotates the token and expiry, invalidating every earlier link; acceptance additionally requires a verified authenticated email matching the normalized recipient address, without provider-specific alias rewriting.
