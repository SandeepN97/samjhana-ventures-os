package com.samjhana.exception;

import java.io.IOException;

/** A request body turned out to be bigger than the server accepts. Thrown while the body is being read. */
public class RequestBodyTooLargeException extends IOException {
    public RequestBodyTooLargeException(String message) {
        super(message);
    }
}
