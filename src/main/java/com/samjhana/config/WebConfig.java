package com.samjhana.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .resourceChain(true)
                .addResolver(new PathResourceResolver() {
                    @Override
                    protected Resource getResource(String resourcePath, Resource location) throws IOException {
                        Resource requested = location.createRelative(resourcePath);
                        // Serve the requested file if it exists, otherwise fall back to index.html for SPA routing
                        if (requested.exists() && requested.isReadable()) return requested;
                        if (!isAppPage(resourcePath)) return null;
                        Resource index = new ClassPathResource("/static/index.html");
                        return index.exists() ? index : null;
                    }
                });
    }

    /**
     * Whether an unknown path should get the admin app (which routes it in the browser). API paths
     * never should: a mistyped endpoint, or the API docs where they are switched off, is a plain
     * 404 rather than a 200 page of HTML.
     */
    static boolean isAppPage(String resourcePath) {
        String path = resourcePath.startsWith("/") ? resourcePath.substring(1) : resourcePath;
        return !(path.equals("api") || path.startsWith("api/")
                || path.equals("api-docs") || path.startsWith("api-docs/")
                || path.equals("swagger-ui") || path.startsWith("swagger-ui/"));
    }
}
