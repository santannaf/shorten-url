package repository;

import db.RedisClientConfig;
import redis.clients.jedis.params.SetParams;

public class CounterRepository {

    private static final String COUNTER_KEY = "url:counter";
    private static final long INITIAL_VALUE = 14_000_000L;

    private final RedisClientConfig redisClient;

    public CounterRepository(RedisClientConfig redisClient) {
        this.redisClient = redisClient;
        initializeCounter();
    }

    public long nextId() {
        return redisClient.get().incr(COUNTER_KEY);
    }

    private void initializeCounter() {
        String result = redisClient.get().set(
                COUNTER_KEY,
                String.valueOf(INITIAL_VALUE),
                SetParams.setParams().nx()
        );

        if ("OK".equals(result)) {
            System.out.println("✅ Redis counter inicializado em " + INITIAL_VALUE);
        } else {
            long current = Long.parseLong(redisClient.get().get(COUNTER_KEY));
            System.out.println("ℹ️  Redis counter já existia → valor atual: " + current);
        }
    }
}
