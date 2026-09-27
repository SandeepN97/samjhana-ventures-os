# Base images are pinned by digest so a rebuild can't silently pull a different image;
# Dependabot (docker ecosystem) proposes digest updates as PRs.
FROM maven:3.9.15-eclipse-temurin-26@sha256:029a8e2838ae68238ffb8be407cddbb3f07d4d839c60c6f26c619a69fd184531 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B dependency:go-offline -q
COPY src ./src
COPY samjhana-admin ./samjhana-admin
RUN mvn -B clean package -DskipTests -q

FROM eclipse-temurin:21-jre-jammy@sha256:e9aaf73145bbd1f9f6ec7f6867dd75a44f34b1a6c32a813504bf4129be2d09d7
# The app runs as this unprivileged user (see docker/entrypoint.sh), not as root.
RUN groupadd --system app && useradd --system --gid app --home-dir /app --shell /usr/sbin/nologin app
WORKDIR /app
COPY --from=build --chown=app:app /app/target/*.jar app.jar
COPY --chmod=0755 docker/entrypoint.sh /usr/local/bin/entrypoint.sh
# data/ holds uploaded plate photos, logs/ the log file: both written by the app user.
RUN mkdir -p /app/data /app/logs && chown -R app:app /app/data /app/logs
EXPOSE 8080
# Default to prod, but let each Render service override it (staging sets
# SPRING_PROFILES_ACTIVE=staging). A -Dspring.profiles.active flag here would win
# over the env var and force every deploy onto the prod datasource.
ENV SPRING_PROFILES_ACTIVE=prod
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
