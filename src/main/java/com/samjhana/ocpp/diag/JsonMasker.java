package com.samjhana.ocpp.diag;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import java.util.Iterator;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * JSON-aware masker for everything that reaches a log line or the database.
 *
 * <ul>
 *   <li>idToken values (OCPP 2.0.1 {@code idToken.idToken}, 1.6 {@code idTag}) keep their first and last two
 *       characters: {@code BA 1 PA 4521} becomes {@code BA***21}.</li>
 *   <li>Secrets that could appear in a frame (a {@code password}/{@code secret}/{@code authorizationKey} field, or
 *       a SetVariables value for a variable whose name says it is a password or key) are replaced entirely.</li>
 *   <li>Payloads that are not valid JSON fall back to a pattern-based pass, so a malformed frame is still masked.</li>
 * </ul>
 */
@Component
public class JsonMasker {

    private static final Pattern TOKEN_FIELDS = Pattern.compile(
            "(\"(?:idToken|idTag|parentIdTag)\"\\s*:\\s*\")([^\"]*)(\")", Pattern.CASE_INSENSITIVE);
    private static final Pattern SECRET_FIELDS = Pattern.compile(
            "(\"(?:password|passwd|secret|authorizationKey|basicAuthPassword|attributeValue)\"\\s*:\\s*\")([^\"]*)(\")",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern SECRET_NAME = Pattern.compile("password|secret|authorizationkey|privatekey|token",
            Pattern.CASE_INSENSITIVE);

    private final ObjectMapper mapper;

    public JsonMasker(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    /** The masked text plus the parsed (masked) tree, or null when the input was not JSON. */
    public record Masked(String text, JsonNode tree, boolean changed) {}

    public Masked mask(String raw) {
        if (raw == null) return new Masked("", null, false);
        JsonNode tree;
        try {
            tree = mapper.readTree(raw);
        } catch (Exception ex) {
            String fallback = maskText(raw);
            return new Masked(fallback, null, !fallback.equals(raw));
        }
        if (tree == null || tree.isMissingNode()) return new Masked(raw, null, false);
        boolean changed = maskNode(tree);
        // Untouched frames are logged exactly as the charger sent them.
        return new Masked(changed ? tree.toString() : raw, tree, changed);
    }

    /** Masks a tree in place; returns whether anything changed. */
    public boolean maskNode(JsonNode node) {
        boolean changed = false;
        if (node instanceof ArrayNode array) {
            for (JsonNode child : array) changed |= maskNode(child);
        } else if (node instanceof ObjectNode object) {
            if (isSecretVariable(object) && object.get("attributeValue") != null
                    && object.get("attributeValue").isTextual()) {
                object.put("attributeValue", "***");
                changed = true;
            }
            for (Iterator<Map.Entry<String, JsonNode>> it = object.fields(); it.hasNext(); ) {
                Map.Entry<String, JsonNode> entry = it.next();
                String key = entry.getKey();
                JsonNode value = entry.getValue();
                if (isTokenKey(key) && value.isTextual()) {
                    entry.setValue(mapper.getNodeFactory().textNode(maskToken(value.asText())));
                    changed = true;
                } else if (isSecretKey(key) && value.isTextual()) {
                    entry.setValue(mapper.getNodeFactory().textNode("***"));
                    changed = true;
                } else {
                    changed |= maskNode(value);
                }
            }
        }
        return changed;
    }

    private boolean isTokenKey(String key) {
        String lower = key.toLowerCase(Locale.ROOT);
        return lower.equals("idtoken") || lower.equals("idtag") || lower.equals("parentidtag");
    }

    private boolean isSecretKey(String key) {
        String lower = key.toLowerCase(Locale.ROOT);
        return lower.equals("password") || lower.equals("passwd") || lower.equals("secret")
                || lower.equals("authorizationkey") || lower.equals("basicauthpassword");
    }

    /** SetVariables entry: the variable name tells whether attributeValue is a secret. */
    private boolean isSecretVariable(ObjectNode object) {
        JsonNode variable = object.get("variable");
        return variable != null && variable.isObject()
                && SECRET_NAME.matcher(variable.path("name").asText("")).find();
    }

    public String maskText(String raw) {
        Matcher tokens = TOKEN_FIELDS.matcher(raw);
        String out = tokens.replaceAll(match -> Matcher.quoteReplacement(
                match.group(1) + maskToken(match.group(2)) + match.group(3)));
        Matcher secrets = SECRET_FIELDS.matcher(out);
        return secrets.replaceAll(match -> Matcher.quoteReplacement(match.group(1) + "***" + match.group(3)));
    }

    /** First two and last two characters; very short values are hidden entirely. */
    public static String maskToken(String value) {
        if (value == null || value.isEmpty()) return value;
        if (value.length() <= 4) return "****";
        return value.substring(0, 2) + "***" + value.substring(value.length() - 2);
    }
}
