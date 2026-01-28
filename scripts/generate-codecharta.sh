#!/bin/bash

# generate-codecharta.sh
#
# This script guides the generation of CodeCharta visualizations from SonarQube metrics.
# It requires the CodeCharta shell (ccsh) to be installed:
# npm install -g codecharta-analysis

# Configuration
SONAR_URL=${1:-"http://localhost:9000"}
SONAR_PROJECT_KEY=${2:-"openas3d"}
OUTPUT_FILE="openas3d.cc.json"

echo "Step 1: Importing SonarQube metrics into CodeCharta format..."
# Note: Use the sonarimport command from ccsh
# You may need to provide a login/token if SonarQube is protected.
# ccsh sonarimport $SONAR_URL $SONAR_PROJECT_KEY -o $OUTPUT_FILE

echo "Mapping used in CodeCharta:"
echo "- Area: ncloc (Non-comment lines of code)"
echo "- Height: cognitive_complexity"
echo "- Color: code_smells (Red = High debt, Green = Low debt)"

echo ""
echo "To view the visualization, upload $OUTPUT_FILE to https://codecharta.com/"
echo ""
echo "Command template for local execution:"
echo "ccsh sonarimport $SONAR_URL $SONAR_PROJECT_KEY --output-file $OUTPUT_FILE"
