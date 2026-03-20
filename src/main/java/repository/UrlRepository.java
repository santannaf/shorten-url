package repository;

import db.ConnectionPool;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.logging.Level;
import java.util.logging.Logger;

public class UrlRepository {

    private static final Logger LOG = Logger.getLogger(UrlRepository.class.getName());
    private static final int MAX_BATCH = 500;
    private final ConnectionPool pool;
    private final BlockingQueue<Object[]> buffer = new LinkedBlockingQueue<>();

    public UrlRepository(ConnectionPool pool) {
        this.pool = pool;
        startBatchWriter();
    }

    public void save(long id, String shortCode, String longUrl) {
        buffer.add(new Object[]{id, shortCode, longUrl});
    }

    public String findByLongUrl(String longUrl) {
        return queryForString("SELECT short_url FROM urls WHERE long_url = ?", longUrl);
    }

    public String findByShortCode(String shortCode) {
        return queryForString("SELECT long_url FROM urls WHERE short_url = ?", shortCode);
    }

    private String queryForString(String sql, String param) {
        try (Connection conn = pool.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, param);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getString(1) : null;
            }
        } catch (Exception e) {
            throw new RuntimeException("Falha ao buscar URL", e);
        }
    }

    private void startBatchWriter() {
        Thread.ofPlatform().daemon().name("batch-writer").start(() -> {
            List<Object[]> batch = new ArrayList<>(MAX_BATCH);
            while (!Thread.currentThread().isInterrupted()) {
                try {
                    batch.add(buffer.take());
                    buffer.drainTo(batch, MAX_BATCH - 1);
                    flush(batch);
                    batch.clear();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
        });
    }

    private void flush(List<Object[]> batch) {
        StringBuilder sql = new StringBuilder(
                "INSERT INTO urls (id, short_url, long_url) VALUES ");
        for (int i = 0; i < batch.size(); i++) {
            if (i > 0) sql.append(',');
            sql.append("(?,?,?)");
        }
        sql.append(" ON CONFLICT (short_url) DO NOTHING");

        try (Connection conn = pool.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql.toString())) {
            int idx = 1;
            for (Object[] entry : batch) {
                ps.setLong(idx++, (long) entry[0]);
                ps.setString(idx++, (String) entry[1]);
                ps.setString(idx++, (String) entry[2]);
            }
            ps.executeUpdate();
        } catch (Exception e) {
            LOG.log(Level.SEVERE, "Falha ao gravar batch de URLs", e);
        }
    }
}
