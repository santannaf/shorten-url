package handler;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import service.UrlShortenerService;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class ShortenHandler implements HttpHandler {

    private final UrlShortenerService service;

    public ShortenHandler(UrlShortenerService service) {
        this.service = service;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendResponse(exchange, 405, "{\"error\": \"Method Not Allowed\"}");
            return;
        }

        try {
            String body = readBody(exchange.getRequestBody());
            String longUrl = parseJsonField(body);

            if (longUrl == null || longUrl.isBlank()) {
                sendResponse(exchange, 400, "{\"error\": \"Field 'longUrl' is required\"}");
                return;
            }

            var result = service.shorten(longUrl);
            String response = "{\"shortUrl\": \"http://short.ly/" + result.shortCode() + "\"}";
            sendResponse(exchange, result.created() ? 201 : 200, response);
        } catch (Exception e) {
//            e.printStackTrace();
            sendResponse(exchange, 500, "{\"error\": \"Internal Server Error\"}");
        }
    }

    private String readBody(InputStream is) throws IOException {
        return new String(is.readAllBytes(), StandardCharsets.UTF_8);
    }

    private String parseJsonField(String json) {
        String key = "\"" + "longUrl" + "\"";
        int idx = json.indexOf(key);
        if (idx == -1) return null;

        int colon = json.indexOf(":", idx + key.length());
        int start = json.indexOf("\"", colon + 1);
        int end = json.indexOf("\"", start + 1);

        if (start == -1 || end == -1) return null;
        return json.substring(start + 1, end);
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
