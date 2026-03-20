package cache;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

public class UrlCache {

    private final Cache<String, String> cache;

    public UrlCache() {
        this.cache = Caffeine.newBuilder()
                .maximumSize(100_000)
                .build();
    }

    public void put(String shortCode, String longUrl) {
        cache.put(shortCode, longUrl);
    }

    public String get(String shortCode) {
        return cache.getIfPresent(shortCode);
    }
}
