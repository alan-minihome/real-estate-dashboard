module.exports = {
  apps: [{
    name: 'real-estate-dashboard',
    script: 'node_modules/.bin/next',
    args: 'start -p 3002',
    cwd: '/home/alan/real-estate-dashboard',
    env: { NODE_ENV: 'production', PORT: 3002 }
  }]
}
