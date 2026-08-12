module.exports = {
  apps: [
    {
      name: 'iaezap',
      script: './node_modules/.bin/next',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      env_file: '.env.production',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
      },
      error_file: '/root/.pm2/logs/iaezap-error.log',
      out_file: '/root/.pm2/logs/iaezap-out.log',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
    },
  ],
};
