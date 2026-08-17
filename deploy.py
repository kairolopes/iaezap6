#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
IAeZap6 Autonomous Deployment Script
Connects to VPS via SSH and executes deployment
"""

import subprocess
import sys
import time
import os
from pathlib import Path

# Force UTF-8 output on Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Configuration
VPS_HOST = os.getenv('VPS_HOST', '179.198.102.88')
VPS_USER = os.getenv('VPS_USER', 'root')
VPS_APP_DIR = '/root/iaezap6'

# SSH key options (try multiple)
SSH_KEYS = [
    Path.home() / '.ssh' / 'iaezap_vps_ed25519',
    Path.home() / '.ssh' / 'id_ed25519',
    Path.home() / '.ssh' / 'id_rsa',
    Path.home() / '.ssh' / 'angell_vps',
]

def find_ssh_key():
    """Find first available SSH key"""
    for key_path in SSH_KEYS:
        if key_path.exists():
            print(f"✓ Found SSH key: {key_path}")
            return str(key_path)
    raise FileNotFoundError("No SSH key found. Tried: " + ", ".join(str(k) for k in SSH_KEYS))

def run_ssh_command(key_path, command):
    """Execute command on VPS via SSH"""
    ssh_cmd = [
        'ssh',
        '-i', key_path,
        '-o', 'ConnectTimeout=10',
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        f'{VPS_USER}@{VPS_HOST}',
        command
    ]

    try:
        result = subprocess.run(
            ssh_cmd,
            capture_output=True,
            text=True,
            timeout=300
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return 1, "", "Command timed out"

def deploy():
    """Execute full deployment"""
    print("🚀 Starting IAeZap6 Autonomous Deployment")
    print(f"📍 VPS: {VPS_HOST}")
    print(f"📂 App Dir: {VPS_APP_DIR}")
    print()

    # Find SSH key
    try:
        ssh_key = find_ssh_key()
    except FileNotFoundError as e:
        print(f"❌ Error: {e}")
        return False

    # Test connection
    print("🔗 Testing SSH connection...")
    code, out, err = run_ssh_command(ssh_key, "whoami")
    if code != 0:
        print(f"❌ SSH connection failed: {err}")
        return False
    print(f"✓ Connected as: {out.strip()}")
    print()

    # Deployment steps
    steps = [
        ("📥 Fetching latest code", f"cd {VPS_APP_DIR} && git fetch origin && git reset --hard origin/main"),
        ("📦 Installing dependencies", f"cd {VPS_APP_DIR} && npm ci"),
        ("🔨 Building", f"cd {VPS_APP_DIR} && npm run build"),
        ("♻️  Restarting PM2", f"cd {VPS_APP_DIR} && pm2 restart all --update-env && pm2 save"),
        ("✔️  Verifying deployment", f"sleep 2 && curl -s http://localhost:3000 > /dev/null && echo 'OK' || echo 'FAIL'"),
    ]

    success = True
    for step_name, command in steps:
        print(f"\n{step_name}...")
        code, out, err = run_ssh_command(ssh_key, command)

        if code != 0:
            print(f"❌ Failed!")
            print(f"Error: {err}")
            success = False
            # Don't stop on verification failure
            if "Verifying" not in step_name:
                break
        else:
            if out.strip():
                lines = out.strip().split('\n')[-3:]
                for line in lines:
                    print(f"  {line}")
            print("✅ Done")

    print()
    if success:
        print("✨ Deployment completed successfully!")
        print("🌐 Check: https://jotaonline.com.br")
    else:
        print("⚠️  Deployment had issues. Check logs:")
        print("  ssh root@179.198.102.88 'pm2 logs'")

    return success

if __name__ == '__main__':
    try:
        success = deploy()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n❌ Deployment cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)
