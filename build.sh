#/bin/bash
#   build script for customized client-cloud-services
#
# setup node version
NODE_VERSION=14.19.0
# make sure node version exist
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
nvm use $NODE_VERSION # same is used in client and server
# install the required dependencies and dev dependencies for build
npm install
# building the client
npm run build:prod
# create dummy metadata file
echo {\"ArtifactName\" : \"client-cloud-services\"} > metadata.json
# copy the bundle.js for later use
cp dist/bundle.js /var/lib/jenkins/custombuild/client-cloud-services
