package com.samjhana.ocpp.diag;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** The OCPP diagnostic loggers. Each can be set to its own level on the host without a deploy. */
public final class OcppLoggers {

    public static final String FRAMES_NAME = "com.samjhana.ocpp.frames";
    public static final String LIFECYCLE_NAME = "com.samjhana.ocpp.lifecycle";
    public static final String COMMANDS_NAME = "com.samjhana.ocpp.commands";
    public static final String LOCK_EVIDENCE_NAME = "com.samjhana.ocpp.lockevidence";
    public static final String HANDSHAKE_NAME = "com.samjhana.ocpp.handshake";

    public static final Logger FRAMES = LoggerFactory.getLogger(FRAMES_NAME);
    public static final Logger LIFECYCLE = LoggerFactory.getLogger(LIFECYCLE_NAME);
    public static final Logger COMMANDS = LoggerFactory.getLogger(COMMANDS_NAME);
    public static final Logger LOCK_EVIDENCE = LoggerFactory.getLogger(LOCK_EVIDENCE_NAME);
    public static final Logger HANDSHAKE = LoggerFactory.getLogger(HANDSHAKE_NAME);

    private OcppLoggers() {}
}
