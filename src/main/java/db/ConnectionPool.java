package db;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

import java.sql.Connection;
import java.sql.SQLException;

public class ConnectionPool {

    private final HikariDataSource dataSource;

    public ConnectionPool() {
        String host = System.getenv().getOrDefault("DB_HOST", "localhost");
        String port = System.getenv().getOrDefault("DB_PORT", "5432");
        String name = System.getenv().getOrDefault("DB_NAME", "urlshortener");
        String user = System.getenv().getOrDefault("DB_USER", "postgres");
        String pass = System.getenv().getOrDefault("DB_PASS", "postgres");

        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:postgresql://" + host + ":" + port + "/" + name);
        config.setUsername(user);
        config.setPassword(pass);

        config.setMaximumPoolSize(5);
        config.setMinimumIdle(2);
        config.setConnectionTimeout(5000);
        config.setIdleTimeout(300_000);
        config.setMaxLifetime(600_000);

        config.addDataSourceProperty("cachePrepStmts", "true");
        config.addDataSourceProperty("prepStmtCacheSize", "250");
        config.addDataSourceProperty("prepStmtCacheSqlLimit", "2048");
        config.addDataSourceProperty("useServerPrepStmts", "true");

        this.dataSource = new HikariDataSource(config);
        System.out.println("✅ HikariCP pool initialized (max=" + config.getMaximumPoolSize() + ")");
    }

    public Connection getConnection() throws SQLException {
        return dataSource.getConnection();
    }

    public void close() {
        dataSource.close();
    }
}
