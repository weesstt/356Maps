#!/bin/bash

sudo apt-get update
sudo apt-get -y install npm
npm run build
node server.js secretSession