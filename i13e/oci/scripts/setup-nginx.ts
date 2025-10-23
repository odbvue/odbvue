#!/usr/bin/env node

import { parse as yamlParse } from 'yaml';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

interface WebServerConfig {
  domain: string;
  access: {
    ip: string;
    user: string;
  };
  ssh: {
    public_key_file: string;
    private_key_file: string;
  };
  ssl: {
    cert_file: string;
    key_file: string;
    ca_bundle_file: string;
  };
  sites: Record<string, {
    local_path: string;
    remote_path: string;
    subdomain: string;
    description: string;
  }>;
  webserver: {
    type: string;
    auto_start: boolean;
    config_path: string;
    ssl_path: string;
    log_path: string;
  };
  deployment: {
    backup_existing: boolean;
    restart_service: boolean;
    verify_ssl: boolean;
  };
}

class NginxSetup {
  private config: WebServerConfig;
  private sshKeyPath: string;

  constructor(configFile: string) {
    const configContent = fs.readFileSync(configFile, 'utf8');
    this.config = yamlParse(configContent) as WebServerConfig;
    this.sshKeyPath = path.resolve(path.dirname(configFile), this.config.ssh.private_key_file);
  }

  private executeRemote(command: string): string {
    const sshCommand = `ssh -i "${this.sshKeyPath}" -o StrictHostKeyChecking=no ${this.config.access.user}@${this.config.access.ip} "${command}"`;
    console.log(`Executing: ${command}`);
    const result = execSync(sshCommand, { encoding: 'utf8' });
    if (result.trim()) {
      console.log(result.trim());
    }
    return result;
  }

  private uploadFile(localPath: string, remotePath: string): void {
    const scpCommand = `scp -B -i "${this.sshKeyPath}" -o StrictHostKeyChecking=no "${localPath}" ${this.config.access.user}@${this.config.access.ip}:"${remotePath}"`;
    console.log(`Uploading: ${localPath} -> ${remotePath}`);
    execSync(scpCommand);
  }

  private generateNginxConfig(): string {
    let config = `
# Global nginx configuration
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log;
pid /run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 100M;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # SSL Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
    ssl_session_timeout 1d;
    ssl_session_cache shared:MozTLS:10m;
    ssl_session_tickets off;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

    # Gzip Settings
    gzip on;
    gzip_vary on;
    gzip_min_length 10240;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;

`;

    // Generate server blocks for each site
    for (const [siteName, siteConfig] of Object.entries(this.config.sites)) {
      const serverName = siteConfig.subdomain ? 
        `${siteConfig.subdomain}.${this.config.domain}` : 
        this.config.domain;

      config += `
    # ${siteConfig.description}
    server {
        listen 80;
        server_name ${serverName};
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name ${serverName};

        ssl_certificate /etc/ssl/certs/odbvue.crt;
        ssl_certificate_key /etc/ssl/certs/odbvue.key;

        root ${siteConfig.remote_path};
        index index.html index.htm;

        # HTML files - no cache, always fresh
        location ~* \\.html?$ {
            add_header Cache-Control "public, max-age=0, must-revalidate";
            try_files $uri $uri/ =404;
        }

        # JavaScript modules - must be served with correct MIME type
        location ~* \\.js$ {
            add_header Cache-Control "public, max-age=31536000, immutable";
            add_header X-Content-Type-Options "nosniff";
            types { application/javascript js; }
        }

        # CSS files with cache
        location ~* \\.css$ {
            add_header Cache-Control "public, max-age=31536000, immutable";
            add_header X-Content-Type-Options "nosniff";
            types { text/css css; }
        }

        # Font files with long cache
        location ~* \\.(woff|woff2|ttf|eot|otf)$ {
            add_header Cache-Control "public, max-age=31536000, immutable";
            add_header Access-Control-Allow-Origin "*";
        }

        # Image files with cache
        location ~* \\.(png|jpg|jpeg|gif|ico|svg)$ {
            add_header Cache-Control "public, max-age=31536000, immutable";
        }

        # Handle VitePress SPA routing - serve index.html for all unknown routes
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Security
        location ~ /\\. {
            deny all;
        }
    }
`;
    }

    config += '\n}\n';
    return config;
  }

  async setupNginx(): Promise<void> {
    try {
      console.log('Setting up nginx on remote server...');

      // Update system and install nginx
      console.log('Installing nginx...');
      this.executeRemote('sudo dnf update -y');
      this.executeRemote('sudo dnf install -y nginx');

      // Create web directories
      console.log('Creating web directories...');
      for (const [siteName, siteConfig] of Object.entries(this.config.sites)) {
        this.executeRemote(`sudo mkdir -p ${siteConfig.remote_path}`);
        this.executeRemote(`sudo chown -R nginx:nginx ${siteConfig.remote_path}`);
      }

  // Prepare SSL certificates
  console.log('Preparing SSL certificates...');
      const certPath = path.resolve(path.dirname(process.argv[2]), this.config.ssl.cert_file);
      const keyPath = path.resolve(path.dirname(process.argv[2]), this.config.ssl.key_file);
      const caBundlePath = path.resolve(path.dirname(process.argv[2]), this.config.ssl.ca_bundle_file);

  // Build a full-chain certificate locally to avoid remote quoting/newline issues
  const mainCert = fs.readFileSync(certPath, 'utf8').replace(/\r\n/g, '\n');
  const caBundle = fs.readFileSync(caBundlePath, 'utf8').replace(/\r\n/g, '\n');
  const needsTrailingNewline = mainCert.endsWith('\n') ? '' : '\n';
  const fullChain = `${mainCert}${needsTrailingNewline}${caBundle}`;

  const tmpFullchainLocal = path.join(os.tmpdir(), `odbvue-fullchain-${Date.now()}.crt`);
  fs.writeFileSync(tmpFullchainLocal, fullChain, 'utf8');

  // Upload full-chain cert and private key
  console.log('Uploading SSL full-chain certificate and key...');
  this.uploadFile(tmpFullchainLocal, '/tmp/odbvue-fullchain.crt');
  this.uploadFile(keyPath, '/tmp/ssl.key');

      // Install SSL certificates
      this.executeRemote('sudo mkdir -p /etc/ssl/certs');

  // Move combined cert to final location
  this.executeRemote('sudo mv /tmp/odbvue-fullchain.crt /etc/ssl/certs/odbvue.crt');
      
      // Install private key
      this.executeRemote('sudo mv /tmp/ssl.key /etc/ssl/certs/odbvue.key');
      
      // Set proper permissions for SSL files
      this.executeRemote('sudo chown root:root /etc/ssl/certs/odbvue.crt');
      this.executeRemote('sudo chown root:root /etc/ssl/certs/odbvue.key');
      this.executeRemote('sudo chmod 644 /etc/ssl/certs/odbvue.crt');
      this.executeRemote('sudo chmod 600 /etc/ssl/certs/odbvue.key');
      
      // Verify certificate format
  this.executeRemote('sudo openssl x509 -in /etc/ssl/certs/odbvue.crt -text -noout | head -5');
      
  this.executeRemote('sudo rm -f /tmp/ssl* /tmp/ca-bundle* /tmp/odbvue-*');

  // Clean up local temporary full-chain file
  try { fs.unlinkSync(tmpFullchainLocal); } catch {}

      // Generate and upload nginx configuration
      console.log('Configuring nginx...');
      const nginxConfig = this.generateNginxConfig();
      const tempNginxFile = path.join(__dirname, '..', 'nginx.conf.tmp');
      fs.writeFileSync(tempNginxFile, nginxConfig);
      this.uploadFile(tempNginxFile, '/tmp/nginx.conf');
      this.executeRemote('sudo mv /tmp/nginx.conf /etc/nginx/nginx.conf');
      fs.unlinkSync(tempNginxFile);

      // Test nginx configuration
      console.log('Testing nginx configuration...');
      this.executeRemote('sudo nginx -t');

      // Configure firewall
      console.log('Configuring firewall...');
      this.executeRemote('sudo firewall-cmd --permanent --add-service=http');
      this.executeRemote('sudo firewall-cmd --permanent --add-service=https');
      this.executeRemote('sudo firewall-cmd --reload');

      // Start and enable nginx
      if (this.config.webserver.auto_start) {
        console.log('Starting nginx...');
        this.executeRemote('sudo systemctl start nginx');
        this.executeRemote('sudo systemctl enable nginx');
      }

      console.log('Nginx setup completed successfully!');
      console.log(`Your sites will be available at:`);
      for (const [siteName, siteConfig] of Object.entries(this.config.sites)) {
        const url = siteConfig.subdomain ? 
          `https://${siteConfig.subdomain}.${this.config.domain}` : 
          `https://${this.config.domain}`;
        console.log(`  - ${siteConfig.description}: ${url}`);
      }

    } catch (error) {
      console.error('Error setting up nginx:', error);
      process.exit(1);
    }
  }
}

// Main execution
if (process.argv.length < 3) {
  console.error('Usage: node setup-nginx.js <web-server.yaml>');
  process.exit(1);
}

const setup = new NginxSetup(process.argv[2]);
setup.setupNginx();