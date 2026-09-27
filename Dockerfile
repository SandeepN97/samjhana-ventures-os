# Base images are pinned by digest so a rebuild can't silently pull a different image;
# Dependabot (docker ecosystem) proposes digest updates as PRs.
FROM maven:3.9.6-eclipse-temurin-21@sha256:8d63d4c1902cb12d9e79a70671b18ebe26358cb592561af33ca1808f00d935cb AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B dependency:go-offline -q
COPY src ./src
COPY samjhana-admin ./samjhana-admin
RUN mvn -B clean package -DskipTests -q

FROM eclipse-temurin:22-jre-jammy@sha256:dbcae8b5dd4d63f81739a538ec2c09797735f04a21d814f9071b62f018326043
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
