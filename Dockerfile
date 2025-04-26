# Use official Go image for building
FROM golang:1.24.2 AS builder
# Set working directory
WORKDIR /app

# Copy go files and modules
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the source code
COPY . .

# Build the Go app
RUN go build -o pomonotes cmd/server/main.go
# Final image
FROM debian:bookworm-slim

# Install CA certificates (needed for HTTPS requests, etc.)
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy binary and necessary files
COPY --from=builder /app/pomonotes /app/
COPY --from=builder /app/templates /app/templates
COPY --from=builder /app/static /app/static

# Set environment variables (can override at runtime)
ENV ADMIN_PASSWORD=changeme
ENV JWT_SECRET=supersecret

# Expose the port
EXPOSE 8080

# Run the app
CMD ["./pomonotes"]
