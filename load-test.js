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

// ─────────────────────────────────────────────
// MÉTRICAS CUSTOMIZADAS
// ─────────────────────────────────────────────
const shortenDuration    = new Trend("shorten_duration",   true);
const redirectDuration   = new Trend("redirect_duration",  true);
const shortenSuccessRate = new Rate("shorten_success_rate");
const redirectSuccessRate = new Rate("redirect_success_rate");
const shortenErrors      = new Counter("shorten_errors");
const redirectErrors     = new Counter("redirect_errors");

// ─────────────────────────────────────────────
// CENÁRIOS
// ─────────────────────────────────────────────
export const options = {
    scenarios: {
        shorten_scenario: {
            executor:        "ramping-vus",
            startVUs:        0,
            stages: [
                { duration: "30s", target: 10  },
                { duration: "1m",  target: 50  },
                { duration: "2m",  target: 100 },
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
    },
    thresholds: {
        shorten_duration:     ["p(95)<2000", "p(99)<5000"],
        redirect_duration:    ["p(95)<500",  "p(99)<1000"],
        shorten_success_rate: ["rate>0.95"],
        redirect_success_rate:["rate>0.95"],
        http_req_failed:      ["rate<0.05"],
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
    const url     = URLS_TO_SHORTEN[Math.floor(Math.random() * URLS_TO_SHORTEN.length)];
    const payload = JSON.stringify({ longUrl: url }); // ✅ campo correto

    const start    = Date.now();
    const response = http.post(`${BASE_URL}/shorten`, payload, {
        headers: HEADERS,
        timeout: "20s", // ✅ timeout aumentado
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
        redirects: 0,      // ✅ não segue o redirect, apenas verifica o status
        timeout:   "10s",
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
// TEARDOWN
// ─────────────────────────────────────────────
export function teardown(data) {
    console.log("🏁 Teste finalizado.");
    if (data.preloadedCodes && data.preloadedCodes.length > 0) {
        console.log(`📦 Shortcodes utilizados: ${data.preloadedCodes.join(", ")}`);
    }
}
