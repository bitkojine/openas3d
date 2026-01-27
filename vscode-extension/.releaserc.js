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
          // Default all other types to patch
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
      '@semantic-release/github',
      {
        assets: [
          {
            path: '*.vsix',
            label: 'VSIX Extension'
          }
        ]
      }
    ],
    [
      '@semantic-release/git',
      {
        assets: ['package.json']
      }
    ]
  ],
  // Safety check to prevent non 0.x.y versions
  verifyConditions: [
    (pluginConfig, context) => {
      const { nextRelease } = context;
      if (nextRelease && !nextRelease.version.startsWith('0.')) {
        throw new Error(`Only pre-launch versions (0.x.y) are allowed for automatic release. Version ${nextRelease.version} is blocked.`);
      }
    }
  ],
  tagFormat: 'v${version}'
};
