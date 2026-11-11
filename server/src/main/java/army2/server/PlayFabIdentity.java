package army2.server;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;

/**
 * Server-side PlayFab identity adapter.
 *
 * PlayFab is deliberately used for account identity only. The original Army 2
 * server still needs its relational MySQL schema for gameplay data.
 */
public final class PlayFabIdentity {
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(12);

    private final String titleId;
    private final String secretKey;
    private final HttpClient http;

    private PlayFabIdentity(String titleId, String secretKey) {
        this.titleId = titleId;
        this.secretKey = secretKey;
        this.http = HttpClient.newBuilder()
                .connectTimeout(REQUEST_TIMEOUT)
                .build();
    }

    public static PlayFabIdentity fromEnvironment() {
        String titleId = environment("PLAYFAB_TITLE_ID");
        String secretKey = environment("PLAYFAB_SECRET_KEY");
        if (titleId.isEmpty() != secretKey.isEmpty()) {
            throw new IllegalStateException(
                    "PLAYFAB_TITLE_ID and PLAYFAB_SECRET_KEY must either both be set or both be absent");
        }
        if (!titleId.isEmpty() && !titleId.matches("[A-Za-z0-9]+")) {
            throw new IllegalStateException("PLAYFAB_TITLE_ID contains invalid characters");
        }
        return new PlayFabIdentity(titleId, secretKey);
    }

    public boolean enabled() {
        return !titleId.isEmpty();
    }

    public String titleId() {
        return titleId;
    }

    /**
     * Creates or resumes a PlayFab player using a server-only API. The browser
     * guest credentials are hashed before becoming the PlayFab ServerCustomId.
     */
    public String loginOrCreate(String identity, String token) throws IOException {
        if (!enabled()) {
            throw new IllegalStateException("PlayFab identity is not configured");
        }

        JsonObject requestBody = new JsonObject();
        requestBody.addProperty("ServerCustomId", sha256(identity + ":" + token));
        requestBody.addProperty("CreateAccount", true);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://" + titleId + ".playfabapi.com/Server/LoginWithServerCustomId"))
                .timeout(REQUEST_TIMEOUT)
                .header("Content-Type", "application/json")
                .header("X-SecretKey", secretKey)
                .POST(HttpRequest.BodyPublishers.ofString(requestBody.toString(), StandardCharsets.UTF_8))
                .build();

        final HttpResponse<String> response;
        try {
            response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new IOException("Interrupted while contacting PlayFab", error);
        }

        JsonObject payload;
        try {
            payload = JsonParser.parseString(response.body()).getAsJsonObject();
        } catch (RuntimeException error) {
            throw new IOException("PlayFab returned an invalid response (HTTP " + response.statusCode() + ")", error);
        }

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            String message = stringValue(payload, "errorMessage", stringValue(payload, "error", "unknown error"));
            throw new IOException("PlayFab login failed (HTTP " + response.statusCode() + "): " + message);
        }

        JsonObject data = payload.has("data") && payload.get("data").isJsonObject()
                ? payload.getAsJsonObject("data") : null;
        String playFabId = data == null ? "" : stringValue(data, "PlayFabId", "");
        if (!playFabId.matches("[A-Za-z0-9]+")) {
            throw new IOException("PlayFab response did not contain a valid PlayFabId");
        }
        return playFabId;
    }

    public String databaseUsername(String playFabId) {
        String username = "playfab_" + playFabId;
        if (username.length() > 50) {
            throw new IllegalArgumentException("PlayFabId is too long for the Army 2 user table");
        }
        return username;
    }

    private static String environment(String name) {
        String value = System.getenv(name);
        return value == null ? "" : value.trim();
    }

    private static String stringValue(JsonObject object, String key, String fallback) {
        return object.has(key) && object.get(key).isJsonPrimitive()
                ? object.get(key).getAsString() : fallback;
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder(digest.length * 2);
            for (byte part : digest) result.append(String.format("%02x", part & 0xff));
            return result.toString();
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is unavailable", impossible);
        }
    }
}
