package com.samjhana.exception;

/** A public form was used too often in a short time. */
public class TooManyRequestsException extends RuntimeException {
    public TooManyRequestsException(String message) {
        super(message);
    }
}
