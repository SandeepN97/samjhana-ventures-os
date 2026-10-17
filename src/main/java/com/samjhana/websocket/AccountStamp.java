package com.samjhana.websocket;

import com.samjhana.entity.User;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * What the live EV feed knew about a person when their socket was opened: the role and a fingerprint of the password.
 * If either is different later - the role was changed, the password was changed or reset - the socket belongs to a
 * sign-in that no longer exists and is closed (finding P1b-06). Only a SHA-256 of the stored password hash is kept,
 * never the hash itself.
 */
record AccountStamp(User.UserRole role, String passwordDigest) {

    /** The WebSocket session attribute the handshake stores the stamp under. */
    static final String ATTRIBUTE = "accountStamp";

    static AccountStamp of(User user) {
        return new AccountStamp(user.getRole(), digest(user.getPassword()));
    }

    private static String digest(String passwordHash) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest(String.valueOf(passwordHash).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is missing from this JVM", e);   // every Java runtime has it
        }
    }
}
