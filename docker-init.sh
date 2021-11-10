#!/bin/sh

echo "Preparing..."
cd /home/node/app
chown -R node:node .

echo "Building..."
npm install

echo "Starting server..."
npm run start -- --public $HOSTNAME

