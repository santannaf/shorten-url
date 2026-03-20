package db;

import redis.clients.jedis.ConnectionPoolConfig;
import redis.clients.jedis.DefaultJedisClientConfig;
import redis.clients.jedis.HostAndPort;
import redis.clients.jedis.RedisClient;

import java.time.Duration;

public class RedisClientConfig {

    private static final String HOST = System.getenv().getOrDefault("REDIS_HOST", "localhost");
    private static final int PORT = Integer.parseInt(
            System.getenv().getOrDefault("REDIS_PORT", "6379"));
    private static final String PASSWORD = System.getenv().getOrDefault("REDIS_PASS", null);

    private final RedisClient redisClient;

    public RedisClientConfig() {
        HostAndPort hostAndPort = new HostAndPort(HOST, PORT);
        ConnectionPoolConfig poolConfig = buildPoolConfig();

        DefaultJedisClientConfig clientConfig = buildClientConfig();

        this.redisClient = RedisClient.builder()
                .hostAndPort(hostAndPort)
                .clientConfig(clientConfig)
                .poolConfig(poolConfig)
                .build();

        System.out.println("✅ Redis pool initialized → " + HOST + ":" + PORT);
    }

    public RedisClient get() {
        return redisClient;
    }

    public void close() {
        redisClient.close();
    }

    private ConnectionPoolConfig buildPoolConfig() {
        ConnectionPoolConfig config = new ConnectionPoolConfig();

        config.setMaxTotal(10);
        config.setMaxIdle(10);
        config.setMinIdle(5);
        config.setTestOnBorrow(false);
        config.setTestOnReturn(false);
        config.setTestWhileIdle(true);
        config.setMinEvictableIdleDuration(Duration.ofSeconds(60));
        config.setTimeBetweenEvictionRuns(Duration.ofSeconds(30));
        config.setBlockWhenExhausted(true);
        config.setMaxWait(Duration.ofSeconds(5));

        return config;
    }

    private DefaultJedisClientConfig buildClientConfig() {
        DefaultJedisClientConfig.Builder builder = DefaultJedisClientConfig.builder()
                .socketTimeoutMillis(2000)
                .connectionTimeoutMillis(2000);

        if (PASSWORD != null && !PASSWORD.isBlank()) {
            builder.password(PASSWORD);
        }

        return builder.build();
    }
}
