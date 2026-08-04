import userRepository from '../repositories/user.repository'
import bcryptjs from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

class UserService {
  async findByEmail(email) {
    return userRepository.findByEmail(email)
  }

  async findByPublicId(publicId) {
    return userRepository.findByPublicId(publicId)
  }

  async createUser({ email, password, displayName }) {
    const username = email.split('@')[0]
    const display = displayName || username
    return userRepository.create({
      email,
      password_hash: bcryptjs.hashSync(password, 8),
      username,
      display_name: display,
      verify_token: uuidv4()
    })
  }

  async verifyPassword(user, password) {
    return bcryptjs.compareSync(password, user.password_hash)
  }
}

const userService = new UserService()
export default userService
export { UserService }
