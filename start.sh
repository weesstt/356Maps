#!/bin/bash

sudo apt-get update
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
npm install node-fetch@2
npm i -y
node server.js secretSession