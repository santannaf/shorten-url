package service;

import cache.UrlCache;
import hash.HashIdGenerator;
import repository.CounterRepository;
import repository.UrlRepository;

public class UrlShortenerService {

    public record ShortenResult(String shortCode, boolean created) {}

    private final UrlRepository repository;
    private final CounterRepository counterRepository;
    private final UrlCache cache;
    private final HashIdGenerator hashGenerator;

    public UrlShortenerService(UrlRepository repository,
                               CounterRepository counterRepository,
                               UrlCache cache,
                               HashIdGenerator hashGenerator) {
        this.repository = repository;
        this.counterRepository = counterRepository;
        this.cache = cache;
        this.hashGenerator = hashGenerator;
    }

    public ShortenResult shorten(String longUrl) {
        String existing = repository.findByLongUrl(longUrl);
        if (existing != null) {
            return new ShortenResult(existing, false);
        }

        long id = counterRepository.nextId();
        String shortCode = hashGenerator.encode(id);
        repository.save(id, shortCode, longUrl);
        cache.put(shortCode, longUrl);
        return new ShortenResult(shortCode, true);
    }

    public String getLongUrl(String shortCode) {
        // Cache-first — absorve as 10x leituras sem tocar no banco
        String cached = cache.get(shortCode);
        if (cached != null) return cached;

        // Fallback para Postgres
        String longUrl = repository.findByShortCode(shortCode);
        if (longUrl != null) cache.put(shortCode, longUrl);

        return longUrl;
    }
}
