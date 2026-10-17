package com.samjhana.config;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.PatternLayout;
import ch.qos.logback.classic.spi.LoggingEvent;
import ch.qos.logback.classic.util.LogbackMDCAdapter;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;

import java.util.List;
import java.util.Objects;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Finding E-01: text that a person chose (a product code, a name) can reach the log through a message. If it holds
 * a line break the log shows a second, made-up line - for example a fake "SECURITY:" entry. The log pattern in
 * application.yml (the one actually used, console and file) now turns every line break in a message into " | ".
 */
class LogPatternTest {

    private static String patternFor(String appender) throws Exception {
        List<PropertySource<?>> documents = new YamlPropertySourceLoader().load("application", new ClassPathResource("application.yml"));
        return documents.stream()
                .map(document -> document.getProperty("logging.pattern." + appender))
                .filter(Objects::nonNull)
                .map(Object::toString)
                .findFirst().orElseThrow();
    }

    private static String render(String pattern, String message) {
        LoggerContext context = new LoggerContext();
        context.setMDCAdapter(new LogbackMDCAdapter());
        PatternLayout layout = new PatternLayout();
        layout.setContext(context);
        layout.setPattern(pattern);
        layout.start();
        return layout.doLayout(new LoggingEvent("test", context.getLogger("com.samjhana.test"), Level.WARN, message, null, null));
    }

    @ParameterizedTest
    @ValueSource(strings = {"console", "file"})
    void shouldKeepAForgedLineOutOfTheLog_whenAMessageHoldsLineBreaks(String appender) throws Exception {
        String forged = "Duplicate key sku=A1\r\n2026-10-16T00:00:00.000+05:45 [main] ERROR c.s.Fake [cp= ws= msg= act= cs=] - SECURITY: admin password reset";

        String rendered = render(patternFor(appender), forged);

        assertThat(rendered.lines().count()).as("lines written").isEqualTo(1);
        assertThat(rendered).doesNotContain("\r").contains("sku=A1 | 2026-10-16T00:00:00.000+05:45");
    }

    @ParameterizedTest
    @ValueSource(strings = {"console", "file"})
    void shouldLeaveAnOrdinaryMessageAlone(String appender) throws Exception {
        String rendered = render(patternFor(appender), "Charge point registry synchronized (3 created, 3 total configured).");

        assertThat(rendered).contains(" - Charge point registry synchronized (3 created, 3 total configured).");
        assertThat(rendered.lines().count()).isEqualTo(1);
    }

    @ParameterizedTest
    @ValueSource(strings = {"console", "file"})
    void shouldStillShowWhenAndWhereTheMessageWasLogged(String appender) throws Exception {
        String rendered = render(patternFor(appender), "hello");

        assertThat(rendered).contains("WARN").contains("com.samjhana.test").contains("[cp= ws= msg= act= cs=]");
    }
}
