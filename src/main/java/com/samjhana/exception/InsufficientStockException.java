package com.samjhana.exception;

/** A sale asked for more units than the shop has. Nothing was changed. */
public class InsufficientStockException extends RuntimeException {
    public InsufficientStockException(String productName) {
        super("Not enough stock for " + productName);
    }
}
