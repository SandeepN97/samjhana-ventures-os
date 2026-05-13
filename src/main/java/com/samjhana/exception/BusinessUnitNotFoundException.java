package com.samjhana.exception;

public class BusinessUnitNotFoundException extends RuntimeException {
    public BusinessUnitNotFoundException(String code) {
        super("Business unit not found: " + code);
    }
}