package com.samjhana.config;

import com.fasterxml.jackson.core.StreamReadConstraints;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Finding F-01: the server's JSON reader accepted one text of up to 20 million characters and a document of any
 * length. The biggest thing this app ever reads as one text is the EV start's camera photo (7 million characters),
 * and the biggest document is that same request, so anything longer is refused while it is being read.
 */
@Configuration
public class JacksonLimitsConfig {

    /** The photo text is at most 7,000,000 characters; this leaves a little room. */
    static final int MAX_STRING_CHARS = 7_500_000;
    /** The EV start with a photo is the biggest request, at most 7.5 MB. */
    static final int MAX_DOCUMENT_CHARS = 8_000_000;

    @Bean
    Jackson2ObjectMapperBuilderCustomizer jsonSizeLimits() {
        return builder -> builder.postConfigurer(mapper -> mapper.getFactory().setStreamReadConstraints(
                StreamReadConstraints.builder()
                        .maxStringLength(MAX_STRING_CHARS)
                        .maxDocumentLength(MAX_DOCUMENT_CHARS)
                        .build()));
    }
}
