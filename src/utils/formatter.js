import { pick } from 'lodash'

// Lấy một vài dữ liệu cụ thể trong User
export const pickUser = (user) => {
  if (!user) return {}
  return pick(user, ['_id', 'email', 'username', 'displayName', 'avatar', 'role', 'isActive', 'language', 'currency', 'remindToInput', 'remindTime', 'startDayOfWeek', 'startDayOfMonth', 'createdAt', 'updatedAt'])
}
