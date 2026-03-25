package server;

import cache.UrlCache;
import com.sun.net.httpserver.HttpServer;
import db.ConnectionPool;
import db.RedisClientConfig;
import handler.RedirectHandler;
import handler.ShortenHandler;
import hash.HashIdGenerator;
import repository.CounterRepository;
import repository.UrlRepository;
import service.UrlShortenerService;

import java.net.InetSocketAddress;
import java.util.concurrent.Executors;

public class AppServer {

    private final int port;

    public AppServer(int port) {
        this.port = port;
    }

    public void start() throws Exception {
        // Infraestrutura
        UrlShortenerService service = getUrlShortenerService();

        // Servidor HTTP
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 1024);
        server.createContext("/shorten", new ShortenHandler(service));
        server.createContext("/", new RedirectHandler(service));
        server.setExecutor(Executors.newVirtualThreadPerTaskExecutor());
        server.start();

        System.out.println("✅ Server running on port " + port);
    }

    private static UrlShortenerService getUrlShortenerService() {
        ConnectionPool connectionPool = new ConnectionPool();
        RedisClientConfig redisClientConfig = new RedisClientConfig();
        UrlRepository repository = new UrlRepository(connectionPool);
        CounterRepository counterRepository = new CounterRepository(redisClientConfig);
        UrlCache cache = new UrlCache(redisClientConfig);
        HashIdGenerator hashGenerator = new HashIdGenerator();

        return new UrlShortenerService(
                repository,
                counterRepository,
                cache,
                hashGenerator
        );
    }
}
