#/bin/bash
#   build script for customized client-cloud-services
#
# setup node version
NODE_VERSION=14.19.0
# make sure node version exist
nvm use $NODE_VERSION # same is used in client and server
# install the required dependencies and dev dependencies for build
npm install
# building the client
npm run build:prod
