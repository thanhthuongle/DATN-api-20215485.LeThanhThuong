import { describe, expect, it, vi } from 'vitest'
import userRepository from '~/v2/modules/user/repositories/user.repository'
import userService from '~/v2/modules/user/services/user.service'

describe('UserService', () => {
  it('creates a user with hashed password', async () => {
    vi.spyOn(userRepository, 'create').mockResolvedValueOnce({
      public_id: 'uuid-1',
      email: 'test@test.com',
      username: 'test',
      display_name: 'Test User'
    })

    const user = await userService.createUser({
      email: 'test@test.com',
      password: 'secret123',
      displayName: 'Test User'
    })

    expect(user.email).toBe('test@test.com')
    expect(user.username).toBe('test')
    expect(user.display_name).toBe('Test User')
    vi.restoreAllMocks()
  })

  it('uses email prefix when displayName not provided', async () => {
    vi.spyOn(userRepository, 'create').mockResolvedValueOnce({
      public_id: 'uuid-2',
      email: 'john@test.com',
      username: 'john'
    })

    const user = await userService.createUser({
      email: 'john@test.com',
      password: 'secret123'
    })

    expect(user.username).toBe('john')
    vi.restoreAllMocks()
  })
})
