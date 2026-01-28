/**
 * extract-tech-debt.js
 * 
 * Extracts issues from SonarQube API and formats them according to the 
 * canonical technical debt JSON schema.
 * 
 * Usage: node extract-tech-debt.js <SONAR_HOST_URL> <SONAR_TOKEN> <PROJECT_KEY>
 */

const http = require('http');
const https = require('https');

const host = process.argv[2] || 'http://localhost:9000';
const token = process.argv[3];
const projectKey = process.argv[4] || 'openas3d';

if (!token) {
  console.error('Usage: node extract-tech-debt.js <SONAR_HOST_URL> <SONAR_TOKEN> <PROJECT_KEY>');
  process.exit(1);
}

function fetchIssues() {
  const url = `${host}/api/issues/search?componentKeys=${projectKey}&ps=500`;
  const protocol = url.startsWith('https') ? https : http;
  
  const auth = Buffer.from(`${token}:`).toString('base64');
  
  protocol.get(url, {
    headers: { 'Authorization': `Basic ${auth}` }
  }, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      try {
        const result = JSON.parse(data);
        const transformed = transformIssues(result.issues);
        console.log(JSON.stringify(transformed, null, 2));
      } catch (e) {
        console.error('Failed to parse response:', e);
        process.exit(1);
      }
    });
  }).on('error', (err) => {
    console.error('Error fetching issues:', err.message);
    process.exit(1);
  });
}

function transformIssues(issues) {
  return issues.map(issue => ({
    id: issue.key,
    path: issue.component,
    type: mapType(issue.type),
    severity: issue.severity,
    remediationEffortMinutes: parseEffort(issue.effort),
    firstDetected: issue.creationDate,
    lastObserved: issue.updateDate,
    trend: 'STABLE', // SonarQube API doesn't provide per-issue trend directly in search
    description: issue.message
  }));
}

function mapType(sonarType) {
  const map = {
    'CODE_SMELL': 'CODE_SMELL',
    'BUG': 'BUG',
    'VULNERABILITY': 'VULNERABILITY'
  };
  return map[sonarType] || 'DESIGN';
}

function parseEffort(effortStr) {
  if (!effortStr) return 0;
  // Sonar effort is like "10min", "1h", "2d"
  const matchMin = effortStr.match(/(\d+)min/);
  const matchHour = effortStr.match(/(\d+)h/);
  const matchDay = effortStr.match(/(\d+)d/);
  
  let totalMinutes = 0;
  if (matchMin) totalMinutes += parseInt(matchMin[1]);
  if (matchHour) totalMinutes += parseInt(matchHour[1]) * 60;
  if (matchDay) totalMinutes += parseInt(matchDay[1]) * 8 * 60; // Assuming 8h work day
  
  return totalMinutes;
}

fetchIssues();
