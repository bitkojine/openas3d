module.exports = {
  branches: [
    'main',
    {
      name: 'release/*',
      prerelease: 'beta'
    }
  ],
  plugins: [
    '@semantic-release/commit-analyzer',
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
    ]
  ],
  tagFormat: 'v${version}'
};
