#!/bin/sh

echo "Preparing..."
cd /home/node/app
chown -R node:node .

echo "Building..."
npm install

echo "Starting server..."
#npx webpack-cli serve --mode=development --progress --public $HOSTNAME
npm start

