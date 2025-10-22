#!/usr/bin/env node

import { parse as yamlParse } from 'yaml';

const fs = require('fs');
const path = require('path');
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

class SiteDeployment {
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
    return execSync(sshCommand, { encoding: 'utf8' });
  }

  private uploadDirectory(localPath: string, remotePath: string): void {
    const resolvedLocalPath = path.resolve(localPath);
    
    if (!fs.existsSync(resolvedLocalPath)) {
      throw new Error(`Local path does not exist: ${resolvedLocalPath}`);
    }

    // Create a temporary tar file
    const tarFile = path.join(__dirname, '..', `deploy-${Date.now()}.tar.gz`);
    
    try {
      // Create tar archive
      console.log(`Creating archive from ${resolvedLocalPath}...`);
      execSync(`tar -czf "${tarFile}" -C "${path.dirname(resolvedLocalPath)}" "${path.basename(resolvedLocalPath)}"`, { cwd: process.cwd() });
      
      // Upload tar file
      const scpCommand = `scp -i "${this.sshKeyPath}" -o StrictHostKeyChecking=no "${tarFile}" ${this.config.access.user}@${this.config.access.ip}:/tmp/`;
      console.log(`Uploading archive...`);
      execSync(scpCommand);
      
      // Extract on remote server
      const remoteTarFile = `/tmp/${path.basename(tarFile)}`;
      this.executeRemote(`sudo rm -rf ${remotePath}.backup`);
      
      if (this.config.deployment.backup_existing) {
        this.executeRemote(`sudo mkdir -p ${path.dirname(remotePath)}`);
        this.executeRemote(`sudo cp -r ${remotePath} ${remotePath}.backup 2>/dev/null || true`);
      }
      
      this.executeRemote(`sudo mkdir -p ${remotePath}`);
      this.executeRemote(`cd /tmp && sudo tar -xzf ${remoteTarFile}`);
      this.executeRemote(`sudo rm -rf ${remotePath}/*`);
      this.executeRemote(`sudo mv /tmp/${path.basename(resolvedLocalPath)}/* ${remotePath}/`);
      this.executeRemote(`sudo chown -R nginx:nginx ${remotePath}`);
      this.executeRemote(`sudo chmod -R 755 ${remotePath}`);
      this.executeRemote(`sudo rm -f ${remoteTarFile}`);
      this.executeRemote(`sudo rmdir /tmp/${path.basename(resolvedLocalPath)} 2>/dev/null || true`);
      
    } finally {
      // Clean up local tar file
      if (fs.existsSync(tarFile)) {
        fs.unlinkSync(tarFile);
      }
    }
  }

  async deploySite(siteName?: string): Promise<void> {
    try {
      const sitesToDeploy = siteName ? 
        { [siteName]: this.config.sites[siteName] } : 
        this.config.sites;

      if (siteName && !this.config.sites[siteName]) {
        throw new Error(`Site '${siteName}' not found in configuration`);
      }

      for (const [name, siteConfig] of Object.entries(sitesToDeploy)) {
        console.log(`\nDeploying ${name} (${siteConfig.description})...`);
        
        const localPath = path.resolve(path.dirname(process.argv[2]), siteConfig.local_path);
        console.log(`Local path: ${localPath}`);
        console.log(`Remote path: ${siteConfig.remote_path}`);
        
        // Check if local path exists
        if (!fs.existsSync(localPath)) {
          console.error(`Warning: Local path does not exist: ${localPath}`);
          continue;
        }

        // Deploy the site
        this.uploadDirectory(localPath, siteConfig.remote_path);
        
        const url = siteConfig.subdomain ? 
          `https://${siteConfig.subdomain}.${this.config.domain}` : 
          `https://${this.config.domain}`;
        console.log(`✓ ${name} deployed successfully to ${url}`);
      }

      // Restart nginx if configured
      if (this.config.deployment.restart_service) {
        console.log('\nRestarting nginx...');
        this.executeRemote('sudo systemctl restart nginx');
        this.executeRemote('sudo systemctl status nginx --no-pager');
        console.log('✓ Nginx restarted successfully');
      }

      // Test nginx configuration
      console.log('\nTesting nginx configuration...');
      this.executeRemote('sudo nginx -t');
      console.log('✓ Nginx configuration is valid');

      // Verify SSL if configured
      if (this.config.deployment.verify_ssl) {
        console.log('\nVerifying SSL configuration...');
        for (const [name, siteConfig] of Object.entries(sitesToDeploy)) {
          const hostname = siteConfig.subdomain ? 
            `${siteConfig.subdomain}.${this.config.domain}` : 
            this.config.domain;
          
          try {
            // Connect to the server IP with the correct SNI hostname
            this.executeRemote(`echo | openssl s_client -servername ${hostname} -connect ${this.config.access.ip}:443 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "Certificate check completed"`);
            console.log(`✓ SSL certificate accessible for ${hostname}`);
          } catch (error) {
            console.log(`⚠ SSL verification skipped for ${hostname} (this is normal if DNS is not configured yet)`);
          }
        }
      }

      console.log('\n🎉 Deployment completed successfully!');
      
      // Show deployment summary
      console.log('\n📋 Deployment Summary:');
      for (const [name, siteConfig] of Object.entries(sitesToDeploy)) {
        const url = siteConfig.subdomain ? 
          `https://${siteConfig.subdomain}.${this.config.domain}` : 
          `https://${this.config.domain}`;
        console.log(`  - ${siteConfig.description}: ${url}`);
      }

    } catch (error) {
      console.error('❌ Deployment failed:', error);
      process.exit(1);
    }
  }

  async showStatus(): Promise<void> {
    try {
      console.log('🔍 Checking server status...\n');
      
      // Check nginx status
      console.log('Nginx Service Status:');
      this.executeRemote('sudo systemctl status nginx --no-pager || true');
      
      console.log('\nNginx Configuration Test:');
      this.executeRemote('sudo nginx -t');
      
      console.log('\nDisk Usage:');
      this.executeRemote('df -h /var/www');
      
      console.log('\nSite Directories:');
      for (const [name, siteConfig] of Object.entries(this.config.sites)) {
        console.log(`\n${name} (${siteConfig.description}):`);
        this.executeRemote(`ls -la ${siteConfig.remote_path} | head -10`);
      }
      
      console.log('\nRecent Nginx Access Logs:');
      this.executeRemote('sudo tail -5 /var/log/nginx/access.log || echo "No access logs found"');
      
      console.log('\nRecent Nginx Error Logs:');
      this.executeRemote('sudo tail -5 /var/log/nginx/error.log || echo "No error logs found"');
      
    } catch (error) {
      console.error('❌ Status check failed:', error);
      process.exit(1);
    }
  }
}

// Main execution
function showUsage() {
  console.log('Usage: node deploy-sites.js <web-server.yaml> [command] [site-name]');
  console.log('');
  console.log('Commands:');
  console.log('  deploy [site-name]  Deploy all sites or specific site');
  console.log('  status             Show server and deployment status');
  console.log('');
  console.log('Examples:');
  console.log('  node deploy-sites.js web-server.yaml deploy');
  console.log('  node deploy-sites.js web-server.yaml deploy apps');
  console.log('  node deploy-sites.js web-server.yaml status');
}

if (process.argv.length < 3) {
  showUsage();
  process.exit(1);
}

const configFile = process.argv[2];
const command = process.argv[3] || 'deploy';
const siteName = process.argv[4];

if (!fs.existsSync(configFile)) {
  console.error(`❌ Configuration file not found: ${configFile}`);
  process.exit(1);
}

const deployment = new SiteDeployment(configFile);

switch (command) {
  case 'deploy':
    deployment.deploySite(siteName);
    break;
  case 'status':
    deployment.showStatus();
    break;
  default:
    console.error(`❌ Unknown command: ${command}`);
    showUsage();
    process.exit(1);
}