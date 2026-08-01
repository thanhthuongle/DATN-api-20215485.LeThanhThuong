import { describe, expect, it, vi } from 'vitest'
import { createFeatureFlagAuditEvent } from '~/v2/infrastructure/feature-flags/featureFlagAudit'
import { createStructuredLogger } from '~/v2/infrastructure/observability/structuredLogger'

describe('V2 observability foundation', () => {
  it('emits structured logs and redacts secret fields', () => {
    const sink = { info: vi.fn(), error: vi.fn() }
    const logger = createStructuredLogger({ sink })
    const record = logger.info('v2.health.checked', {
      correlationId: 'corr-12345678',
      accessToken: 'secret-token',
      status: 'ok'
    })

    expect(record).toMatchObject({
      level: 'info',
      event: 'v2.health.checked',
      correlationId: 'corr-12345678',
      accessToken: '[REDACTED]',
      status: 'ok'
    })
    expect(() => JSON.parse(sink.info.mock.calls[0][0])).not.toThrow()
  })

  it('redacts nested secrets in objects and arrays without leaking their values', () => {
    const sink = { info: vi.fn(), error: vi.fn() }
    const logger = createStructuredLogger({ sink })
    const record = logger.info('v2.request.checked', {
      request: {
        headers: {
          authorization: 'Bearer nested-access-secret',
          cookie: 'refreshToken=nested-refresh-secret'
        },
        body: {
          password: 'nested-password-secret',
          profile: { displayName: 'safe-name' }
        }
      },
      attempts: [{ refreshToken: 'array-refresh-secret', status: 'rejected' }]
    })

    expect(record).toMatchObject({
      request: {
        headers: {
          authorization: '[REDACTED]',
          cookie: '[REDACTED]'
        },
        body: {
          password: '[REDACTED]',
          profile: { displayName: 'safe-name' }
        }
      },
      attempts: [{ refreshToken: '[REDACTED]', status: 'rejected' }]
    })

    const serialized = sink.info.mock.calls[0][0]
    for (const secret of [
      'nested-access-secret',
      'nested-refresh-secret',
      'nested-password-secret',
      'array-refresh-secret'
    ]) {
      expect(serialized).not.toContain(secret)
    }
  })

  it('serializes circular log fields safely', () => {
    const sink = { info: vi.fn(), error: vi.fn() }
    const logger = createStructuredLogger({ sink })
    const context = { status: 'ok' }
    context.self = context

    const record = logger.info('v2.circular.checked', { context })

    expect(record.context).toEqual({ status: 'ok', self: '[CIRCULAR]' })
    expect(() => JSON.parse(sink.info.mock.calls[0][0])).not.toThrow()
  })

  it('creates immutable feature-flag audit records', () => {
    const audit = createFeatureFlagAuditEvent({
      flagName: 'v2.accounts.read',
      before: false,
      after: true,
      actor: 'platform-owner',
      reason: 'staging-read-rollout',
      sourceVersion: 'flags-v1'
    })
    expect(audit.event).toBe('v2.feature_flag.changed')
    expect(Object.isFrozen(audit)).toBe(true)
  })
})
