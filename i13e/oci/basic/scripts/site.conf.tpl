    # =========================
    # %%SERVER_NAME%%
    # =========================

    # HTTP -> HTTPS (apex + IPv6)
    server {
        listen 80;
        listen [::]:80;
        server_name %%SERVER_NAME%%;
        return 301 https://$server_name$request_uri;
    }

    # Redirect www -> apex (HTTP)
    server {
        listen 80;
        listen [::]:80;
        server_name www.%%SERVER_NAME%%;
        return 301 https://%%SERVER_NAME%%$request_uri;
    }

    # Redirect www -> apex (HTTPS)
    server {
        listen 443 ssl http2;
        listen [::]:443 ssl http2;
        server_name www.%%SERVER_NAME%%;

        ssl_certificate     /etc/ssl/certs/odbvue.crt;
        ssl_certificate_key /etc/ssl/private/odbvue.key;

        return 301 https://%%SERVER_NAME%%$request_uri;
    }

    # Main server block (Blue/Green ready)
    server {
        listen 443 ssl http2;
        listen [::]:443 ssl http2;
        server_name %%SERVER_NAME%%;

        ssl_certificate     /etc/ssl/certs/odbvue.crt;
        ssl_certificate_key /etc/ssl/private/odbvue.key;

        # Blue/Green deployment: symlink points to active version (blue or green)
        root  /var/www/%%SITE_NAME%%/current;
        index index.html index.htm;

        # ---- Security headers (HTTPS only) ----
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
        add_header Cross-Origin-Opener-Policy "same-origin" always;
        add_header Cross-Origin-Resource-Policy "same-site" always;

        server_tokens off;

        # Allow ACME challenges if needed
        location ^~ /.well-known/acme-challenge/ { allow all; }

        # Fonts (long cache + CORS)
        location ~* \.(woff2?|ttf|eot|otf)$ {
            add_header Cache-Control "public, max-age=31536000, immutable" always;
            add_header Access-Control-Allow-Origin "*" always;
            try_files $uri =404;
        }

        # JS & CSS (long cache)
        location ~* \.(?:js|css)$ {
            add_header Cache-Control "public, max-age=31536000, immutable" always;
            add_header X-Content-Type-Options "nosniff" always;
            try_files $uri =404;
        }

        # Images (long cache)
        location ~* \.(?:png|jpe?g|gif|ico|svg)$ {
            add_header Cache-Control "public, max-age=31536000, immutable" always;
            try_files $uri =404;
        }

        # HTML – never cache (explicit index + any .html)
        location = /index.html {
            add_header Cache-Control "no-store, must-revalidate" always;
            try_files $uri =404;
        }
        location ~* \.html?$ {
            add_header Cache-Control "no-store, must-revalidate" always;
            try_files $uri =404;
        }

        # SPA fallback
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Deny dotfiles & VCS, except .well-known
        location ~ /\.(?!well-known/) { deny all; }
        location ~* /\.(git|hg|svn|env|htaccess) { deny all; }
    }

