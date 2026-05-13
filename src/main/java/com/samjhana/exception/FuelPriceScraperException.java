package com.samjhana.exception;

public class FuelPriceScraperException extends RuntimeException {
    public FuelPriceScraperException(String message) {
        super(message);
    }

    public FuelPriceScraperException(String message, Throwable cause) {
        super(message, cause);
    }
}