FROM ghcr.io/graalvm/native-image-community:25 AS build
WORKDIR /app
COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
RUN ./gradlew  clean build && ./gradlew dependencies --no-daemon || true
COPY src ./src
RUN ./gradlew nativeCompile -x test --no-daemon

FROM debian:bookworm-slim
WORKDIR /app
RUN groupadd --system appgroup && useradd --system --gid appgroup appuser
COPY --from=build /app/build/native/nativeCompile/shorten ./shorten
RUN chown -R appuser:appgroup /app
USER appuser
EXPOSE 8080
ENTRYPOINT ["./shorten", "-Xmx512m"]
