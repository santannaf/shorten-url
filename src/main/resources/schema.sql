CREATE TABLE IF NOT EXISTS public.urls
(
    id         BIGINT      NOT NULL PRIMARY KEY,
    short_url  VARCHAR(10) NOT NULL UNIQUE,
    long_url   TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
