module.exports = {
  apps: [{
    name: 'beng',
    script: 'npm',
    args: 'run start',
    cwd: '/var/www/beng',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 4000,
      DATABASE_URL: 'postgresql://beng_user:NvtF9EHv5jBdmBfoZAlucIqj@localhost:5432/beng_db',
      DOMAIN: 'https://buybit.cloud'
    }
  }]
};
