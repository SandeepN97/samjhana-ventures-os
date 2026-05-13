package com.samjhana.exception;

public class DayAlreadyClosedException extends RuntimeException {
    public DayAlreadyClosedException(String date) {
        super("Day already closed: " + date);
    }
}