#!/bin/bash

#Installing node 10.16.3
NODE_VERSION="10.16.3"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"  # This loads nvm
nvm install ${NODE_VERSION}
nvm use ${NODE_VERSION}

# Installing yarn
YARN_VERSION="0.24.6"
YARN_LOCATION="tools/${YARN_VERSION}"

if [ ! -d "$YARN_LOCATION" ]; then
	mkdir -p ${YARN_LOCATION}
	cd ${YARN_LOCATION}/
	wget -qO- https://github.com/yarnpkg/yarn/releases/download/v${YARN_VERSION}/yarn-v${YARN_VERSION}.tar.gz | tar zvx
	cd ../..
fi
PATH="$PATH:${YARN_LOCATION}/dist/bin/"

# Installing packages via yarn
echo "INSTALLING BUILD DEPENDENCIES"
yarn install || exit 1

echo "CHECKING YARN LOCKFILE UNCHANGED BY BUILD"
yarn check || exit 1

echo "LINTING"
yarn lint  || exit 1

echo "CHECKING TYPES"
yarn flow  || exit 1

echo "TRANSPILING"
yarn compile || exit 1

echo "RUNNING UNIT TESTS"
yarn test || exit 1

echo "INSTALLING PRODUCTION DEPENDENCIES"
yarn dist || exit 1

echo "BUNDLING AND UPLOADING TO RIFFRAFF"
yarn riffraff || exit 1