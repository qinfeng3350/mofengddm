module.exports = {
  apps: [{
    name: 'mofengddm',
    script: './services/core/dist/main.js',
    cwd: process.cwd(),
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 4000,
      // 给 DingTalk 待办生成的 detailUrl 使用公网域名（不要用 localhost）
      PORTAL_BASE_URL: 'https://ddm.mofeng33506.xyz',
      PORTAL_PUBLIC_BASE_URL: 'https://ddm.mofeng33506.xyz',
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    // 如果进程崩溃，等待 3 秒后重启
    min_uptime: '3s',
    max_restarts: 10
  }]
};

