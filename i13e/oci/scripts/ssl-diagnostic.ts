#!/usr/bin/env node

import { parse as yamlParse } from 'yaml';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class SSLDiagnostic {
  private config: any;
  private sshKeyPath: string;

  constructor(configFile: string) {
    const configContent = fs.readFileSync(configFile, 'utf8');
    this.config = yamlParse(configContent);
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

  async diagnoseSSL(): Promise<void> {
    try {
      console.log('🔍 SSL Diagnostic Report\n');

      // Check nginx status
      console.log('1. Nginx Service Status:');
      this.executeRemote('sudo systemctl status nginx --no-pager');

      console.log('\n2. SSL Certificate Files:');
      this.executeRemote('sudo ls -la /etc/ssl/certs/odbvue.*');

      console.log('\n3. SSL Certificate Content Check:');
      this.executeRemote('sudo openssl x509 -in /etc/ssl/certs/odbvue.crt -text -noout | head -10');

      console.log('\n4. SSL Key File Check:');
      this.executeRemote('sudo openssl rsa -in /etc/ssl/certs/odbvue.key -check -noout');

      console.log('\n5. Nginx Error Log (last 20 lines):');
      this.executeRemote('sudo tail -20 /var/log/nginx/error.log');

      console.log('\n6. Test SSL Connection Locally:');
      this.executeRemote('sudo netstat -tlnp | grep :443');

      console.log('\n7. Test SSL Handshake:');
      this.executeRemote(`echo | openssl s_client -connect localhost:443 -servername ${this.config.domain} 2>&1 | head -20`);

      console.log('\n8. Fix SSL File Permissions:');
      this.executeRemote('sudo chown root:root /etc/ssl/certs/odbvue.*');
      this.executeRemote('sudo chmod 644 /etc/ssl/certs/odbvue.crt');
      this.executeRemote('sudo chmod 600 /etc/ssl/certs/odbvue.key');

      console.log('\n9. Restart Nginx:');
      this.executeRemote('sudo systemctl restart nginx');
      this.executeRemote('sudo systemctl status nginx --no-pager');

      console.log('\n10. Final SSL Test:');
      this.executeRemote(`curl -I -k https://localhost --header "Host: ${this.config.domain}"`);

    } catch (error) {
      console.error('❌ Diagnostic failed:', error);
    }
  }
}

// Main execution
if (process.argv.length < 3) {
  console.error('Usage: node ssl-diagnostic.js <web-server.yaml>');
  process.exit(1);
}

const diagnostic = new SSLDiagnostic(process.argv[2]);
diagnostic.diagnoseSSL();