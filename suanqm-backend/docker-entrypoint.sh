#!/bin/sh

set -e

ENV_FILE="/app/.env"

generate_random_password() {
  openssl rand -hex 24
}

ensure_passwords() {
  AUTH_PASSWORD_SET=false
  
  if [ ! -f "$ENV_FILE" ]; then
    touch "$ENV_FILE"
  fi
  
  if ! grep -q "^AUTH_PASSWORD=" "$ENV_FILE"; then
    AUTH_PASSWORD=$(generate_random_password)
    echo "AUTH_PASSWORD=$AUTH_PASSWORD" >> "$ENV_FILE"
    AUTH_PASSWORD_SET=true
  fi
  
  export AUTH_PASSWORD
  
  if [ "$AUTH_PASSWORD_SET" = true ]; then
    echo "========================================"
    echo "首次启动：已生成随机密码"
    echo "========================================"
    echo "管理后台认证密码: $AUTH_PASSWORD"
    echo "========================================"
    echo "密码已保存到 .env 文件"
    echo "请妥善保存这些密码"
    echo "========================================"
  fi
}

ensure_passwords

exec "$@"