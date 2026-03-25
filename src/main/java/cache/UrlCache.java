package cache;

import db.RedisClientConfig;

public class UrlCache {

    private static final String PREFIX = "cache:";

    private final RedisClientConfig redis;

    public UrlCache(RedisClientConfig redis) {
        this.redis = redis;
    }

    public void put(String shortCode, String longUrl) {
        redis.get().set(PREFIX + shortCode, longUrl);
    }

    public String get(String shortCode) {
        return redis.get().get(PREFIX + shortCode);
    }
}
