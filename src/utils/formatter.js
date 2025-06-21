import { pick } from 'lodash'

// Lấy một vài dữ liệu cụ thể trong User
export const pickUser = (user) => {
  if (!user) return {}
  return pick(user, ['_id', 'email', 'username', 'displayName', 'avatar', 'role', 'isActive', 'language', 'currency', 'remindToInput', 'remindTime', 'startDayOfWeek', 'startDayOfMonth', 'createdAt', 'updatedAt'])
}

export const generateNewName = (name) => {
  const regex = /\((\d+)\)$/

  const match = name.match(regex)
  if (match) {
    const number = parseInt(match[1], 10)
    const newNumber = number + 1
    return name.replace(regex, `(${newNumber})`)
  } else {
    return `${name.trim()} (1)`
  }
}
