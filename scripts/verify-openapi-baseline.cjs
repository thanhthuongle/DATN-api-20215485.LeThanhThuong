const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')

const root = resolve(__dirname, '..')
const openApi = readFileSync(resolve(root, 'docs/v2/api/openapi-v1-baseline.yaml'), 'utf8')
const differences = readFileSync(resolve(root, 'docs/v2/api/approved-differences.md'), 'utf8')

const operationMatches = openApi.match(/^    (get|post|put|patch|delete):$/gm) || []
const operationIds = [...openApi.matchAll(/^      operationId: (.+)$/gm)].map((match) => match[1])

assert.match(openApi, /^openapi: 3\.1\.0$/m)
assert.equal(operationMatches.length, 55, 'OpenAPI operation count must match the Wave 0 inventory')
assert.equal(operationIds.length, 55, 'Every operation must have an operationId')
assert.equal(new Set(operationIds).size, 55, 'operationIds must be unique')
assert.match(openApi, /url: \/api\/v1/)
assert.match(differences, /Hiện có \*\*0 approved differences\*\*/)
assert.doesNotMatch(differences, /\| API-DIFF-\d+ [^\n]*\| APPROVED \|/)

process.stdout.write('OpenAPI baseline verification PASS: OpenAPI 3.1 skeleton, 55 unique V1 operations, 0 approved differences.\n')
