package handler;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import service.UrlShortenerService;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class RedirectHandler implements HttpHandler {

    private final UrlShortenerService service;

    public RedirectHandler(UrlShortenerService service) {
        this.service = service;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendResponse(exchange, 405, "{\"error\": \"Method Not Allowed\"}");
            return;
        }

        String path = exchange.getRequestURI().getPath();
        String shortCode = path.substring(1);

        if (shortCode.isBlank()) {
            sendResponse(exchange, 400, "{\"error\": \"Short code is required\"}");
            return;
        }

        String longUrl = service.getLongUrl(shortCode);

        if (longUrl == null) {
            sendResponse(exchange, 404, "{\"error\": \"URL not found\"}");
            return;
        }

        // 302 Found → redireciona para URL original
        exchange.getResponseHeaders().set("Location", longUrl);
        exchange.sendResponseHeaders(302, -1);
        exchange.getResponseBody().close();
    }

    private void sendResponse(HttpExchange exchange, int statusCode, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(statusCode, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }
}
