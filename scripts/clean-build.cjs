const { mkdirSync, rmSync } = require('node:fs')
const { resolve } = require('node:path')

const buildDirectory = resolve(__dirname, '..', 'build')

rmSync(buildDirectory, { recursive: true, force: true })
mkdirSync(buildDirectory, { recursive: true })
