// Phase 1 compatibility boundary: keep the existing V1 router implementation
// untouched while exposing it at both the legacy root and /api/v1.
export { APIs as v1Routes } from '~/routes'
