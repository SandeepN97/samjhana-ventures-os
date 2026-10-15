package com.samjhana.ocpp.diag;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.spi.ThrowableProxyUtil;
import ch.qos.logback.core.read.ListAppender;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Captures log output from every logger in the JVM (all threads) for the length of a test, optionally
 * with the root level forced down to TRACE so that statements at EVERY level are seen. Text includes the
 * formatted message, any stack trace and the MDC, so a secret hiding in any of them is found.
 */
public final class LogCapture implements AutoCloseable {

    private final Logger root = (Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME);
    private final ListAppender<ILoggingEvent> appender = new ListAppender<>();
    private final Level previousLevel;
    private final List<Logger> raised = new ArrayList<>();
    private final List<Level> raisedPrevious = new ArrayList<>();

    private LogCapture(Level rootLevel) {
        previousLevel = root.getLevel();
        if (rootLevel != null) root.setLevel(rootLevel);
        appender.start();
        root.addAppender(appender);
    }

    /** Whatever levels the test configuration already has. */
    public static LogCapture atConfiguredLevels() {
        return new LogCapture(null);
    }

    /** Root at TRACE: every statement of every library that is not pinned to a higher level elsewhere. */
    public static LogCapture atEveryLevel() {
        return new LogCapture(Level.TRACE);
    }

    /** Sets one logger's level for the duration of the capture. */
    public LogCapture with(String loggerName, Level level) {
        Logger logger = (Logger) LoggerFactory.getLogger(loggerName);
        raised.add(logger);
        raisedPrevious.add(logger.getLevel());
        logger.setLevel(level);
        return this;
    }

    public List<ILoggingEvent> events() {
        return new ArrayList<>(appender.list);
    }

    /** One string per event: level, logger, message, MDC and stack trace. */
    public List<String> texts() {
        List<String> out = new ArrayList<>();
        for (ILoggingEvent event : events()) {
            StringBuilder text = new StringBuilder();
            text.append(event.getLevel()).append(' ').append(event.getLoggerName()).append(" - ")
                    .append(event.getFormattedMessage());
            Map<String, String> mdc = event.getMDCPropertyMap();
            if (mdc != null && !mdc.isEmpty()) text.append(" MDC").append(mdc);
            if (event.getThrowableProxy() != null) text.append('\n').append(ThrowableProxyUtil.asString(event.getThrowableProxy()));
            out.add(text.toString());
        }
        return out;
    }

    public List<String> textsFrom(String loggerName) {
        List<String> out = new ArrayList<>();
        for (ILoggingEvent event : events()) {
            if (event.getLoggerName().equals(loggerName)) out.add(event.getFormattedMessage());
        }
        return out;
    }

    public List<String> matching(String fragment) {
        return texts().stream().filter(t -> t.contains(fragment)).toList();
    }

    public boolean anyContains(String fragment) {
        return texts().stream().anyMatch(t -> t.contains(fragment));
    }

    public List<ILoggingEvent> events(String loggerName, Level level) {
        return events().stream()
                .filter(e -> e.getLoggerName().equals(loggerName) && e.getLevel().equals(level)).toList();
    }

    @Override
    public void close() {
        root.detachAppender(appender);
        appender.stop();
        root.setLevel(previousLevel);
        for (int i = 0; i < raised.size(); i++) raised.get(i).setLevel(raisedPrevious.get(i));
    }
}
