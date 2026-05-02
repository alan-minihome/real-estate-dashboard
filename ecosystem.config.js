module.exports = {
  apps: [{
    name: 'dividend-dashboard-next',
    script: 'node_modules/.bin/next',
    args: 'start -p 3001',
    cwd: '/home/alan/dividend-dashboard-next',
    env: { NODE_ENV: 'production', PORT: 3001 }
  }]
}
