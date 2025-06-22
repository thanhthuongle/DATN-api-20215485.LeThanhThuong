/* eslint-disable no-console */
import { Server } from 'socket.io'
import { JwtProvider } from '~/providers/JwtProvider'
import { env } from '~/config/environment'

// Lưu userId -> Set<socketId>
const userSockets = new Map()

let ioInstance = null

export const initSocketServer = (server, corsOptions) => {
  const io = new Server(server, { cors: corsOptions })

  io.use(async (socket, next) => {
    try {
      const rawCookie = socket.handshake.headers.cookie
      const token = rawCookie?.split('; ')
        ?.find(c => c.startsWith('accessToken='))?.split('=')[1]

      if (!token) return next(new Error('No token'))

      const jwtDecoded = await JwtProvider.verifyToken(token, env.ACCESS_TOKEN_SECRET_SIGNATURE)
      socket.userId = jwtDecoded._id
      next()
    } catch (error) {
      console.error('Socket auth error:', error)
      next(new Error('Socket auth failed'))
    }
  })

  io.on('connection', (socket) => {
    const userId = socket.userId
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set())
    }
    userSockets.get(userId).add(socket.id)

    // console.log(`✅ [Socket] User ${userId} connected with socket ${socket.id}`)

    socket.on('disconnect', () => {
      const userSet = userSockets.get(userId)
      if (userSet) {
        userSet.delete(socket.id)
        if (userSet.size === 0) {
          userSockets.delete(userId)
        }
      }
      // console.log(`❌ [Socket] User ${userId} disconnected from ${socket.id}`)
    })
  })

  ioInstance = io
  return io
}

export const getIO = () => {
  if (!ioInstance) throw new Error('Socket.IO chưa được khởi tạo')
  return ioInstance
}
export const getUserSockets = () => userSockets
