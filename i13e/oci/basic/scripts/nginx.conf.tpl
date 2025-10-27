# =========================
# /etc/nginx/nginx.conf
# AUTO-GENERATED - do not edit manually
# Generated from sites.yaml
# =========================
user  nginx;
worker_processes  auto;

error_log  /var/log/nginx/error.log;
pid        /run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    # --- Logging ---
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    access_log /var/log/nginx/access.log main;

    # --- Core ---
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 100M;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # --- TLS (global) ---
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on; # affects TLS1.2 only
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_session_timeout 1d;
    ssl_session_cache   shared:MozTLS:10m;
    ssl_session_tickets off;

    # Optional OCSP stapling (uncomment and set chain path if you want this)
    # resolver 1.1.1.1 1.0.0.1 valid=300s;
    # resolver_timeout 5s;

    # --- Gzip (fixed types) ---
    gzip on;
    gzip_vary on;
    gzip_min_length 10240;
    gzip_proxied expired no-cache no-store private auth;
    gzip_disable "msie6";
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/json
        application/rss+xml
        image/svg+xml;

    # =========================
    # SITES (generated from sites.yaml)
    # =========================

%%SITES_CONFIG%%

}
