#!/usr/bin/env bash
#
# deploy.sh — 把 main 分支部署到 vls-a / vls-b
#
# 前置：先在本地推 gitee（生产 origin），然后跑这个脚本
#   git push gitee main && ./scripts/deploy.sh
#
# 流程（每台机器）：
#   server: git fetch + reset --hard origin/main → pnpm install → prisma generate
#           → prisma migrate deploy → nest build → pm2 restart main → curl /doc
#   client: git fetch + reset --hard origin/main → pnpm install → pnpm build
#           （nginx 直接 serve dist，不需重启服务）
#
# 退出码：任一机器失败 → set -e 立即终止；后续机器不会被部署
#
# 用法：
#   ./scripts/deploy.sh                  # 部署 main（server + client）
#   BRANCH=develop ./scripts/deploy.sh
#   HOSTS_ONLY=vls-a ./scripts/deploy.sh # 只部 vls-a
#   SKIP_CLIENT=1 ./scripts/deploy.sh    # 跳过 client（只部 server）
#   SKIP_SERVER=1 ./scripts/deploy.sh    # 跳过 server（只部 client）
#
set -euo pipefail

# ── 配置 ─────────────────────────────────────
DEPLOY_DIR=/var/www/vls/server
CLIENT_DIR="${CLIENT_DIR:-/var/www/vls/client}"
SSH_KEY="${SSH_KEY:-${HOME}/.ssh/id_ed2519_github}"
SSH_OPTS=(-o IdentitiesOnly=yes -o ConnectTimeout=10 -i "$SSH_KEY")
BRANCH="${BRANCH:-main}"
PM2_APP="${PM2_APP:-main}"
HEALTH_PATH="${HEALTH_PATH:-/doc}"  # Swagger 页，nest 启动后即可达，没 / 路由
HEALTH_PORT="${HEALTH_PORT:-3000}"
SKIP_SERVER="${SKIP_SERVER:-}"
SKIP_CLIENT="${SKIP_CLIENT:-}"

# 每台机器：别名 IP node路径（nvm 装在不同版本下）
HOSTS=(
  "vls-a 100.64.0.6 /root/.nvm/versions/node/v20.15.1/bin"
  "vls-b 100.64.0.7 /root/.nvm/versions/node/v20.16.0/bin"
)

# ── 工具 ─────────────────────────────────────
log()  { printf '\033[1;36m[%s]\033[0m %s\n' "$(date +%H:%M:%S)" "$*"; }
err()  { printf '\033[1;31m[%s] ERROR:\033[0m %s\n' "$(date +%H:%M:%S)" "$*" >&2; }
step() { printf '\033[1;33m  ▸ %s\033[0m\n' "$*"; }

# ── 单机部署 ──────────────────────────────────
deploy_host() {
  local alias="$1" ip="$2" node_path="$3"

  if [[ -n "${HOSTS_ONLY:-}" && ",${HOSTS_ONLY}," != *",${alias},"* ]]; then
    log "skip ${alias} (HOSTS_ONLY=${HOSTS_ONLY})"
    return
  fi

  log "═══ ${alias} (${ip}) ═══"

  ssh "${SSH_OPTS[@]}" "root@${ip}" "BRANCH=${BRANCH} PM2_APP=${PM2_APP} DEPLOY_DIR=${DEPLOY_DIR} CLIENT_DIR=${CLIENT_DIR} NODE_PATH=${node_path} HEALTH_PORT=${HEALTH_PORT} HEALTH_PATH=${HEALTH_PATH} SKIP_SERVER=${SKIP_SERVER} SKIP_CLIENT=${SKIP_CLIENT} bash -s" <<'REMOTE'
set -euo pipefail
export PATH="${NODE_PATH}:${PATH}"

# ── server 部分 ─────────────────────────────
if [ -z "${SKIP_SERVER:-}" ]; then
  cd "$DEPLOY_DIR"

  PREV=$(git rev-parse HEAD)
  echo "  ▸ [server] previous HEAD: $PREV"

  echo "  ▸ [server] git fetch origin $BRANCH"
  git fetch --quiet origin "$BRANCH"
  NEW=$(git rev-parse "origin/$BRANCH")

  if [ "$PREV" = "$NEW" ]; then
    echo "  ✓ [server] already at $NEW — skip build & restart"
  else
    echo "  ▸ [server] git reset --hard origin/$BRANCH → $NEW"
    git reset --hard "origin/$BRANCH"

    echo "  ▸ [server] pnpm install --frozen-lockfile"
    pnpm install --frozen-lockfile

    echo "  ▸ [server] pnpm prisma generate"
    pnpm prisma generate

    echo "  ▸ [server] pnpm prisma migrate deploy"
    pnpm prisma migrate deploy

    echo "  ▸ [server] pnpm run build"
    pnpm run build

    echo "  ▸ [server] pm2 restart $PM2_APP"
    pm2 restart "$PM2_APP" --update-env

    # 简单健康检查：等 5s 后探活，失败回滚
    sleep 5
    if ! curl -fsS --max-time 5 "http://127.0.0.1:${HEALTH_PORT}${HEALTH_PATH}" >/dev/null 2>&1; then
      echo "  ✗ [server] health check failed, rolling back to $PREV"
      git reset --hard "$PREV"
      pnpm run build
      pm2 restart "$PM2_APP" --update-env
      echo "  ↩  rolled back; exit 1"
      exit 1
    fi

    echo "  ✓ [server] deployed $PREV → $NEW (health OK)"
    pm2 describe "$PM2_APP" 2>/dev/null | grep -E 'status|uptime|restarts' | head -3 || true
  fi
fi

# ── client 部分 ─────────────────────────────
# nginx 直接 serve $CLIENT_DIR/dist, 不需重启服务; build 失败自动回滚到上个 HEAD 重 build
if [ -z "${SKIP_CLIENT:-}" ] && [ -d "$CLIENT_DIR" ]; then
  cd "$CLIENT_DIR"

  PREV_C=$(git rev-parse HEAD)
  echo "  ▸ [client] previous HEAD: $PREV_C"

  echo "  ▸ [client] git fetch origin $BRANCH"
  git fetch --quiet origin "$BRANCH"
  NEW_C=$(git rev-parse "origin/$BRANCH")

  if [ "$PREV_C" = "$NEW_C" ]; then
    echo "  ✓ [client] already at $NEW_C — skip build"
  else
    echo "  ▸ [client] git reset --hard origin/$BRANCH → $NEW_C"
    git reset --hard "origin/$BRANCH"

    echo "  ▸ [client] pnpm install --frozen-lockfile"
    pnpm install --frozen-lockfile

    echo "  ▸ [client] pnpm run build"
    if ! pnpm run build; then
      echo "  ✗ [client] build failed, rolling back to $PREV_C"
      git reset --hard "$PREV_C"
      pnpm run build
      echo "  ↩  client rolled back; exit 1"
      exit 1
    fi

    echo "  ✓ [client] built $PREV_C → $NEW_C"
  fi
fi
REMOTE
}

# ── 主流程 ─────────────────────────────────────
log "branch=$BRANCH  pm2_app=$PM2_APP  hosts_only=${HOSTS_ONLY:-all}"
for entry in "${HOSTS[@]}"; do
  read -r alias ip node_path <<<"$entry"
  deploy_host "$alias" "$ip" "$node_path"
done

log "✓ all hosts deployed"
