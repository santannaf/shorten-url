package hash;

import org.hashids.Hashids;

public class HashIdGenerator {

    private static final String ALPHABET  =
            "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    private static final int    MIN_LENGTH = 4;
    private static final String SALT       = "url-shortener-salt-2025";

    private final Hashids hashids;

    public HashIdGenerator() {
        this.hashids = new Hashids(SALT, MIN_LENGTH, ALPHABET);
    }

    public String encode(long id) {
        return hashids.encode(id);
    }

    public long decode(String hash) {
        long[] numbers = hashids.decode(hash);
        return numbers.length > 0 ? numbers[0] : -1L;
    }
}
