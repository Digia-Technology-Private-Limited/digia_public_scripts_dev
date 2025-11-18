#!/bin/bash

# Verify Node.js installation
node -v
npm -v

# Initialize Node.js project and install dependencies
echo "Initializing Node.js project and installing dependencies..."
npm init -y
npm install axios js-yaml

echo "Node.js and dependencies installed successfully."

# Ensure the scripts directory exists
[ -d scripts ] || mkdir scripts

# Fetch the correct version file from S3
VERSION=$4
curl -o scripts/json_yaml.js "https://raw.githubusercontent.com/Digia-Technology-Private-Limited/digia_public_scripts_dev/refs/heads/main/github/version/$VERSION/json_yaml.js"
chmod +x scripts/json_yaml.js

# Run the script with provided arguments
projectId=$1
branchId=$2
branch=$3

node scripts/json_yaml.js "$projectId" "$branchId" "$branch"
exit_code=$?

# Cleanup
chmod -R 777 node_modules package.json package-lock.json scripts/json_yaml.js commit_changes.sh
rm -rf node_modules package.json package-lock.json scripts/json_yaml.js commit_changes.sh

exit $exit_code
