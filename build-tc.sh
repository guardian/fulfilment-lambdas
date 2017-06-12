#!/bin/bash

#Installing node 6.10
NODE_VERSION="6.10"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"  # This loads nvm
nvm install ${NODE_VERSION}
nvm use ${NODE_VERSION}

# Installing yarn
YARN_VERSION="0.23.4"
YARN_LOCATION="tools/${YARN_VERSION}"

if [ ! -d "$YARN_LOCATION" ]; then
	mkdir -p ${YARN_LOCATION}
	cd ${YARN_LOCATION}/
	wget -qO- https://github.com/yarnpkg/yarn/releases/download/v${YARN_VERSION}/yarn-v${YARN_VERSION}.tar.gz | tar zvx
	cd ../..
fi
PATH="$PATH:${YARN_LOCATION}/dist/bin/"

# Installing packages via yarn

echo "INSTALLING PRODUCTION DEPENDENCIES"
yarn dist > /dev/null
# This is a really noisy command.

echo "INSTALLING BUILD DEPENDENCIES"
yarn install

echo "LINTING"
yarn standard

echo "CHECKING TYPES"
yarn flow

echo "TRANSPILING"
yarn compile

echo "BUNDLING AND UPLOADING TO RIFFRAFF"
yarn riffraff



