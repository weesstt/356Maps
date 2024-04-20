#!/bin/bash

sudo apt-get update
sudo apt -y install npm
npm run build
node server.js secretSession