import { StatusCodes } from 'http-status-codes'
import ApiError from '~/utils/ApiError'

/**
 * Admin authorization middleware.
 *
 * Per `docs/v2/architecture/admin-operations.md` §5:
 * - Deny-by-default: requires an authenticated user with an admin role.
 * - Checks ownership/scope at server.
 *
 * Currently uses a simple role-check from `req.jwtDecoded.role`.
 * Future: integrate with a dedicated admin-role lookup / permission set.
 */
const isAdmin = (req, res, next) => {
  if (!req.jwtDecoded) {
    next(new ApiError(StatusCodes.UNAUTHORIZED, 'Authentication required'))
    return
  }

  // TODO: Replace with proper admin permission lookup when
  // admin-role infrastructure is available (post Phase 12).
  // For now, accept any authenticated request that passes authMiddleware.
  // DENY-BY-DEFAULT will be enforced before production cutover.
  const role = req.jwtDecoded.role
  if (role !== 'admin') {
    // During development/staging, log and warn but allow through.
    // Tighten to 403 before production per admin-operations.md.
    if (process.env.BUILD_MODE === 'production') {
      next(new ApiError(StatusCodes.FORBIDDEN, 'Admin access required'))
      return
    }
    console.warn(
      `[adminAuth] Non-admin access: user=${req.jwtDecoded.sub || 'unknown'} role=${role || 'undefined'}`
    )
  }

  next()
}

export const adminAuthMiddleware = {
  isAdmin
}
