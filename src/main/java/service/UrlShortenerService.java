package service;

import cache.UrlCache;
import hash.HashIdGenerator;
import repository.CounterRepository;
import repository.UrlRepository;

public class UrlShortenerService {
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

    public String shorten(String longUrl) {
        long id = counterRepository.nextId();
        String shortCode = hashGenerator.encode(id);
        repository.save(id, shortCode, longUrl);
        cache.put(shortCode, longUrl);
        return shortCode;
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
