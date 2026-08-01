import { env } from '~/config/environment'
import {
  createFeatureFlagRegistry,
  parseFeatureFlagOverrides
} from './featureFlagRegistry'

export const featureFlags = createFeatureFlagRegistry({
  overrides: parseFeatureFlagOverrides(env.V2_FEATURE_FLAGS_JSON),
  activeFinancialWriteVersion: env.ACTIVE_FINANCIAL_WRITE_VERSION
})

export {
  createFeatureFlagRegistry,
  featureFlagDefinitions,
  parseFeatureFlagOverrides
} from './featureFlagRegistry'
