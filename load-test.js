import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
const BASE_URL = "http://localhost:8080";
const HEADERS  = { "Content-Type": "application/json" };

const URLS_TO_SHORTEN = [
    "https://www.google.com",
    "https://www.github.com",
    "https://www.netflix.com",
    "https://www.twitter.com",
    "https://www.linkedin.com",
    "https://www.youtube.com",
    "https://www.amazon.com",
    "https://www.reddit.com",
    "https://www.stackoverflow.com",
    "https://www.medium.com",
];

/**
 * Gera uma URL única usando VU id + iteração + timestamp
 * para garantir que cada POST seja uma escrita real (sem dedup).
 */
function uniqueUrl() {
    const vu   = __VU || 0;
    const iter = __ITER || 0;
    const ts   = Date.now();
    return `https://example.com/page/${vu}-${iter}-${ts}`;
}

// ─────────────────────────────────────────────
// MÉTRICAS CUSTOMIZADAS
// ─────────────────────────────────────────────
const shortenDuration    = new Trend("shorten_duration",   true);
const redirectDuration   = new Trend("redirect_duration",  true);
const shortenSuccessRate = new Rate("shorten_success_rate");
const redirectSuccessRate = new Rate("redirect_success_rate");
const shortenErrors      = new Counter("shorten_errors");
const redirectErrors     = new Counter("redirect_errors");

// Métricas do cenário write-then-read
const writeThenReadShortenDuration  = new Trend("wtr_shorten_duration",  true);
const writeThenReadRedirectDuration = new Trend("wtr_redirect_duration", true);
const writeThenReadSuccessRate      = new Rate("wtr_success_rate");
const writeThenReadConsistencyRate  = new Rate("wtr_consistency_rate");
const writeThenReadErrors           = new Counter("wtr_errors");

// ─────────────────────────────────────────────
// CENÁRIOS
// ─────────────────────────────────────────────
export const options = {
    scenarios: {
        shorten_scenario: {
            executor:        "ramping-vus",
            startVUs:        0,
            stages: [
                { duration: "30s", target: 20  },
                { duration: "1m",  target: 100 },
                { duration: "2m",  target: 200 },
                { duration: "30s", target: 0   },
            ],
            gracefulRampDown: "10s",
            exec:            "shortenUrl",
        },
        redirect_scenario: {
            executor:        "ramping-vus",
            startVUs:        0,
            stages: [
                { duration: "30s", target: 20  },
                { duration: "1m",  target: 100 },
                { duration: "2m",  target: 500 },
                { duration: "30s", target: 0   },
            ],
            gracefulRampDown: "10s",
            exec:            "redirectUrl",
        },
        // Cenário write-then-read: encurta URL única e imediatamente consulta
        write_then_read_scenario: {
            executor:        "ramping-vus",
            startVUs:        0,
            stages: [
                { duration: "30s", target: 10  },
                { duration: "1m",  target: 50  },
                { duration: "2m",  target: 100 },
                { duration: "30s", target: 0   },
            ],
            gracefulRampDown: "10s",
            exec:            "shortenThenRedirect",
        },
    },
    thresholds: {
        shorten_duration:        ["p(95)<2000", "p(99)<5000"],
        redirect_duration:       ["p(95)<500",  "p(99)<1000"],
        shorten_success_rate:    ["rate>0.95"],
        redirect_success_rate:   ["rate>0.95"],
        wtr_shorten_duration:    ["p(95)<2000", "p(99)<5000"],
        wtr_redirect_duration:   ["p(95)<500",  "p(99)<1000"],
        wtr_success_rate:        ["rate>0.95"],
        wtr_consistency_rate:    ["rate>0.99"],
        http_req_failed:         ["rate<0.05"],
    },
};

// ─────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────
function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
}

/**
 * Extrai o shortcode do shortUrl retornado pela API.
 * Exemplo: "http://short.ly/6JrkWg" → "6JrkWg"
 */
function extractCode(shortUrl) {
    if (!shortUrl) return null;
    return shortUrl.split("/").pop();
}

// ─────────────────────────────────────────────
// SETUP — Warm-up
// ─────────────────────────────────────────────
export function setup() {
    console.log("🚀 Iniciando warm-up — pré-populando shortcodes...");

    const codes = [];

    for (const url of URLS_TO_SHORTEN) {
        const res = http.post(
            `${BASE_URL}/shorten`,
            JSON.stringify({ longUrl: url }),
            {
                headers: HEADERS,
                timeout: "20s",
                tags: { name: "SETUP POST /shorten" },
            }
        );

        if (res.status === 200 || res.status === 201) {
            try {
                const body = JSON.parse(res.body);
                const code = extractCode(body.shortUrl); // ✅ parse correto do shortUrl
                if (code) codes.push(code);
            } catch (e) {
                console.error(`[SETUP PARSE ERROR] ${e.message}`);
            }
        } else {
            console.error(
                `[SHORTEN ERROR] Status: ${res.status} | Body: ${res.body}`
            );
        }
    }

    console.log(
        `✅ Warm-up concluído — ${codes.length} shortcodes gerados: ${codes.join(", ")}`
    );

    return { preloadedCodes: codes };
}

// ─────────────────────────────────────────────
// CENÁRIO 1 — Encurtar URL (POST /shorten)
// ─────────────────────────────────────────────
export function shortenUrl(data) {
    const url     = uniqueUrl(); // ✅ URL única para garantir escrita real
    const payload = JSON.stringify({ longUrl: url });

    const start    = Date.now();
    const response = http.post(`${BASE_URL}/shorten`, payload, {
        headers: HEADERS,
        timeout: "20s",
        tags: { name: "POST /shorten" },
    });
    const duration = Date.now() - start;

    shortenDuration.add(duration);

    const success = check(response, {
        "✅ shorten: status 200 ou 201": (r) => r.status === 200 || r.status === 201,
        "✅ shorten: body contém shortUrl": (r) => {
            try {
                const body = JSON.parse(r.body);
                return body.shortUrl !== undefined && body.shortUrl !== null;
            } catch (_) {
                return false;
            }
        },
    });

    shortenSuccessRate.add(success);

    if (!success) {
        shortenErrors.add(1);
        console.error(
            `[SHORTEN ERROR] Status: ${response.status} | Body: ${response.body}`
        );
    } else {
        // Registra o shortcode gerado para debug
        try {
            const body = JSON.parse(response.body);
            const code = extractCode(body.shortUrl);
            if (code && data.preloadedCodes && !data.preloadedCodes.includes(code)) {
                data.preloadedCodes.push(code);
            }
        } catch (_) {}
    }

    sleep(randomBetween(0.1, 0.5));
}

// ─────────────────────────────────────────────
// CENÁRIO 2 — Redirecionar URL (GET /{shortCode})
// ─────────────────────────────────────────────
export function redirectUrl(data) {
    // ✅ Usa apenas códigos gerados no warm-up
    const codes = data.preloadedCodes;

    if (!codes || codes.length === 0) {
        console.warn("[REDIRECT WARN] Nenhum shortcode disponível, pulando...");
        return;
    }

    const shortCode = codes[Math.floor(Math.random() * codes.length)];

    const start    = Date.now();
    const response = http.get(`${BASE_URL}/${shortCode}`, {
        headers:   { Accept: "application/json" },
        redirects: 0,
        timeout:   "10s",
        tags: { name: "GET /{shortCode}" },
    });
    const duration = Date.now() - start;

    redirectDuration.add(duration);

    const success = check(response, {
        "✅ redirect: status 301 ou 302":   (r) => r.status === 301 || r.status === 302,
        "✅ redirect: header Location set": (r) => r.headers["Location"] !== undefined,
    });

    redirectSuccessRate.add(success);

    if (!success) {
        redirectErrors.add(1);
        console.error(
            `[REDIRECT ERROR] Code: ${shortCode} | Status: ${response.status}`
        );
    }

    sleep(randomBetween(0.05, 0.2));
}

// ─────────────────────────────────────────────
// CENÁRIO 3 — Write-then-Read (POST + GET imediato)
// Valida consistência: a URL recém-criada deve ser
// resolvível imediatamente.
// ─────────────────────────────────────────────
export function shortenThenRedirect() {
    const url     = uniqueUrl();
    const payload = JSON.stringify({ longUrl: url });

    // ── STEP 1: Encurtar ──
    const shortenStart = Date.now();
    const shortenRes   = http.post(`${BASE_URL}/shorten`, payload, {
        headers: HEADERS,
        timeout: "20s",
        tags: { name: "WTR POST /shorten" },
    });
    const shortenTime = Date.now() - shortenStart;

    writeThenReadShortenDuration.add(shortenTime);

    const shortenOk = check(shortenRes, {
        "✅ wtr shorten: status 200/201": (r) => r.status === 200 || r.status === 201,
    });

    if (!shortenOk) {
        writeThenReadSuccessRate.add(false);
        writeThenReadConsistencyRate.add(false);
        writeThenReadErrors.add(1);
        console.error(
            `[WTR SHORTEN ERROR] Status: ${shortenRes.status} | Body: ${shortenRes.body}`
        );
        sleep(randomBetween(0.1, 0.3));
        return;
    }

    // Extrai o shortCode do response
    let shortCode;
    try {
        const body = JSON.parse(shortenRes.body);
        shortCode  = extractCode(body.shortUrl);
    } catch (e) {
        writeThenReadSuccessRate.add(false);
        writeThenReadConsistencyRate.add(false);
        writeThenReadErrors.add(1);
        console.error(`[WTR PARSE ERROR] ${e.message}`);
        sleep(randomBetween(0.1, 0.3));
        return;
    }

    if (!shortCode) {
        writeThenReadSuccessRate.add(false);
        writeThenReadConsistencyRate.add(false);
        writeThenReadErrors.add(1);
        console.error(`[WTR ERROR] shortCode nulo`);
        sleep(randomBetween(0.1, 0.3));
        return;
    }

    // ── STEP 2: Consultar imediatamente ──
    const redirectStart = Date.now();
    const redirectRes   = http.get(`${BASE_URL}/${shortCode}`, {
        headers:   { Accept: "application/json" },
        redirects: 0,
        timeout:   "10s",
        tags: { name: "WTR GET /{shortCode}" },
    });
    const redirectTime = Date.now() - redirectStart;

    writeThenReadRedirectDuration.add(redirectTime);

    const redirectOk = check(redirectRes, {
        "✅ wtr redirect: status 301/302": (r) => r.status === 301 || r.status === 302,
        "✅ wtr redirect: Location header": (r) => r.headers["Location"] !== undefined,
    });

    // Valida consistência: o Location deve apontar para a URL original
    const locationMatch = check(redirectRes, {
        "✅ wtr consistency: Location = URL original": (r) =>
            r.headers["Location"] === url,
    });

    writeThenReadSuccessRate.add(shortenOk && redirectOk);
    writeThenReadConsistencyRate.add(locationMatch);

    if (!redirectOk || !locationMatch) {
        writeThenReadErrors.add(1);
        console.error(
            `[WTR REDIRECT ERROR] Code: ${shortCode} | Status: ${redirectRes.status} | Location: ${redirectRes.headers["Location"]} | Expected: ${url}`
        );
    }

    sleep(randomBetween(0.1, 0.3));
}

// ─────────────────────────────────────────────
// TEARDOWN
// ─────────────────────────────────────────────
export function teardown(data) {
    console.log("🏁 Teste finalizado.");
    if (data.preloadedCodes && data.preloadedCodes.length > 0) {
        console.log(`📦 Shortcodes utilizados: ${data.preloadedCodes.join(", ")}`);
    }
}
