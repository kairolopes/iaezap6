#!/bin/bash
cd /var/www/iaezap
git pull origin main
npm run build
pm2 restart iaezap
echo "✅ Deploy completo!"
