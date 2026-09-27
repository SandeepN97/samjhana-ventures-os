FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -q
COPY src ./src
COPY samjhana-admin ./samjhana-admin
RUN mvn clean package -DskipTests -q

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
# Default to prod, but let each Render service override it (staging sets
# SPRING_PROFILES_ACTIVE=staging). A -Dspring.profiles.active flag here would win
# over the env var and force every deploy onto the prod datasource.
ENV SPRING_PROFILES_ACTIVE=prod
ENTRYPOINT ["java", "-jar", "app.jar"]