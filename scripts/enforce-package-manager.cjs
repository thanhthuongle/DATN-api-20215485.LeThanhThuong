const userAgent = process.env.npm_config_user_agent || ''

if (!userAgent.startsWith('yarn/')) {
  console.error('This repository uses Yarn 1.22.22 as its canonical package manager. Run `yarn install`.')
  process.exit(1)
}
