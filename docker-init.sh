#!/bin/sh

echo "Preparing..."
cd /home/node/app
chown -R node:node .

echo "Building..."
npm install

echo "Starting server..."
npm run start -- --client-web-socket-url $HOSTNAME

#sleep infinity # uncomment to help debug
