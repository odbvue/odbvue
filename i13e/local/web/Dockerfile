# Multi-stage build for Nginx with static website
# Works on Windows WSL and Oracle Linux 8

FROM nginx:alpine as builder

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy static website files
COPY ./html/index.html /usr/share/nginx/html/

# Final stage
FROM nginx:alpine

# Install basic utilities
RUN apk add --no-cache \
    curl \
    ca-certificates

# Copy configuration
COPY --from=builder /etc/nginx/nginx.conf /etc/nginx/nginx.conf

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
