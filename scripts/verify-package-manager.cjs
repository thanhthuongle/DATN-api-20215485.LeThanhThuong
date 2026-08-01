const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const packageJson = require('../package.json')

const root = path.resolve(__dirname, '..')

assert.equal(packageJson.packageManager, 'yarn@1.22.22')
assert.equal(fs.existsSync(path.join(root, 'yarn.lock')), true, 'yarn.lock must exist')
assert.equal(fs.existsSync(path.join(root, 'package-lock.json')), false, 'package-lock.json is not allowed')

process.stdout.write('Package-manager policy PASS (Yarn 1.22.22, one canonical lockfile).\n')
