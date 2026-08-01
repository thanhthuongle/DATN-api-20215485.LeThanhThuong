const assert = require('node:assert/strict')
const { readdirSync, readFileSync, statSync } = require('node:fs')
const { resolve, relative } = require('node:path')
const { spawnSync } = require('node:child_process')

const root = resolve(__dirname, '..')

const listJavaScriptFiles = (directory) => readdirSync(directory).flatMap((entry) => {
  const fullPath = resolve(directory, entry)
  return statSync(fullPath).isDirectory()
    ? listJavaScriptFiles(fullPath)
    : fullPath.endsWith('.js') ? [fullPath] : []
})

const v2Root = resolve(root, 'src/v2')
const v2Files = listJavaScriptFiles(v2Root)
const expressBoundaryViolations = v2Files.filter((file) => {
  const source = readFileSync(file, 'utf8')
  return /(?:from\s+['"]express['"]|require\(['"]express['"]\)|\breq\b|\bres\b|\bnext\b)/.test(source)
})
assert.deepEqual(expressBoundaryViolations.map((file) => relative(root, file)), [])

const controllerDirectory = resolve(root, 'src/api/v2/controllers')
const controllerViolations = listJavaScriptFiles(controllerDirectory).filter((file) => {
  const source = readFileSync(file, 'utf8')
  return /(?:prisma|mongodb|redis|agenda|src\/v2\/infrastructure|~\/v2\/infrastructure)/i.test(source)
})
assert.deepEqual(controllerViolations.map((file) => relative(root, file)), [])

for (const directory of ['routes', 'controllers', 'validations', 'mappers']) {
  assert.ok(statSync(resolve(root, `src/api/v2/${directory}`)).isDirectory())
}

const legacyDiff = spawnSync('git', [
  'diff', '--name-only', '--',
  'src/routes', 'src/controllers', 'src/services', 'src/models', 'src/validations', 'src/middlewares'
], { cwd: root, encoding: 'utf8' })
assert.equal(legacyDiff.status, 0, legacyDiff.stderr)
assert.equal(legacyDiff.stdout.trim(), '', 'Phase 1 must not modify legacy V1 implementation files')

const productionFlagCheck = spawnSync(process.execPath, [
  '-e',
  "const { env } = require('./build/src/config/environment'); process.stdout.write(String(env.ENABLE_API_V2))"
], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    BUILD_MODE: 'production',
    DEPLOYMENT_ENV: 'production',
    ENABLE_API_V2: 'true'
  }
})
assert.equal(productionFlagCheck.status, 0, productionFlagCheck.stderr)
assert.equal(productionFlagCheck.stdout, 'false', 'Production must fail closed even when ENABLE_API_V2=true')

const nonProductionFlagCheck = spawnSync(process.execPath, [
  '-e',
  "const { env } = require('./build/src/config/environment'); process.stdout.write(String(env.ENABLE_API_V2))"
], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    BUILD_MODE: 'production',
    DEPLOYMENT_ENV: 'owner-defined-non-production',
    ENABLE_API_V2: 'true'
  }
})
assert.equal(nonProductionFlagCheck.status, 0, nonProductionFlagCheck.stderr)
assert.equal(nonProductionFlagCheck.stdout, 'true', 'Any non-production deployment label may enable V2 by DEC-064')

process.stdout.write(`API boundary verification PASS: ${v2Files.length} src/v2 files free of Express objects; controllers infrastructure-free; V1 implementation diff empty; production V2 mount fail-closed; DEC-064 non-production enablement preserved.\n`)
