module.exports = {
  branches: [
    'main',
    {
      name: 'release/*',
      prerelease: 'beta'
    }
  ],
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
        releaseRules: [
          { type: 'feat', release: 'minor' },
          { type: 'fix', release: 'patch' },
          { type: 'perf', release: 'patch' },
          { type: 'docs', release: 'patch' },
          { type: 'refactor', release: 'patch' },
          { type: 'style', release: 'patch' },
          { type: 'test', release: 'patch' },
          { type: 'minor', release: 'minor' },
          { type: 'patch', release: 'patch' },
          { breaking: true, release: 'minor' }, // Map breaking changes to minor for pre-1.0
          { release: 'patch' }
        ],
        parserOpts: {
          noteKeywords: ['BREAKING CHANGE', 'BREAKING']
        }
      }
    ],
    '@semantic-release/release-notes-generator',
    [
      '@semantic-release/npm',
      {
        npmPublish: false,
        tarballDir: 'dist'
      }
    ],
    [
      '@semantic-release/exec',
      {
        prepareCmd: 'npm run package'
      }
    ],
    [
      '@semantic-release/github',
      {
        assets: [
          {
            path: 'openas3d-vscode-*.vsix',
            label: 'VSIX Extension'
          }
        ],
        successComment: false,
        failComment: false
      }
    ]
  ],
  // Safety check to prevent non 0.x.y versions
  verifyConditions: [
    (pluginConfig, context) => {
      const { nextRelease } = context;
      if (nextRelease && !nextRelease.version.startsWith('0.')) {
        throw new Error(`Only pre-launch versions (0.x.y) are allowed for automatic release. Version ${nextRelease.version} is blocked and must be manually released as 1.0.0 when ready.`);
      }
    }
  ],
  tagFormat: 'v${version}'
};
