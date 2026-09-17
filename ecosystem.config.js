module.exports = {
  apps: [
    {
      name: 'metinous-ai-backend',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 2134,
      },
    },
  ],
};
