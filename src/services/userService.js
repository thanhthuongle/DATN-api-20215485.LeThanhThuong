/* eslint-disable no-useless-catch */
import { userModel } from '~/models/userModel'
import ApiError from '~/utils/ApiError'
import { StatusCodes } from 'http-status-codes'
import bcryptjs from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { pickUser } from '~/utils/formatter'
import { OWNER_TYPE, WEBSITE_DOMAIN } from '~/utils/constants'
import { BrevoProvider } from '~/providers/BrevoProvider'
import { JwtProvider } from '~/providers/JwtProvider'
import { env } from '~/config/environment'
import { CloudinaryProvider } from '~/providers/CloudinaryProvider'
import { cloneCategories } from '~/utils/cloneCategory'
import { categoryModel } from '~/models/categoryModel'
import { moneySourceModel } from '~/models/moneySourceModel'

const createNew = async (reqBody) => {
  try {
    // Kiểm tra xem email đã tồn tại trong hệ thống hay chưa
    const existUser = await userModel.findOneByEmail(reqBody.email)
    if (existUser) {
      throw new ApiError(StatusCodes.CONFLICT, 'Email already exists!')
    }

    // Tạo data để lưu vào database
    const nameFromEmail = reqBody.email.split('@')[0]
    const newUser = {
      email: reqBody.email,
      password: bcryptjs.hashSync(reqBody.password, 8),

      username: nameFromEmail,
      displayName: nameFromEmail,

      verifyToken: uuidv4()
    }

    // Thực hiện lưu thông tin user vào database
    // Gọi đến modal để xử lý lưu bản ghi newBoard
    const createdUser = await userModel.createNew(newUser)
    const getNewUser = await userModel.findOneById(createdUser.insertedId)

    // clone category, init moneySource cho ng dùng
    const dataCategory = cloneCategories(createdUser.insertedId, OWNER_TYPE.INDIVIDUAL)
    await categoryModel.insertMany(dataCategory)
    const newMoneySource = {
      ownerType: OWNER_TYPE.INDIVIDUAL,
      ownerId:createdUser.insertedId.toString()
    }
    await moneySourceModel.createNew(newMoneySource)


    // Gửi email cho người dùng xác thực tài khoản
    const verificationLink = `${WEBSITE_DOMAIN}/account/verification?email=${getNewUser.email}&token=${getNewUser.verifyToken}`
    const customSubject = 'QLTC Lê Thanh Thương: hãy xác nhận email của bạn trước khi sử dụng dịch vụ của chúng tôi'
    const htmlContent = `
      <h3>Here is your verification link:</h3>
      <h3>${verificationLink}</h3>
      <h3>Sincerely,<br/> --- Le Thanh Thuong ---</h3>
    `

    // Gọi tới Provider gửi mail
    await BrevoProvider.sendEmail(getNewUser.email, customSubject, htmlContent)

    // trả về dữ liệu cho phía controller
    return pickUser(getNewUser)
  } catch (error) { throw error }
}

const verifyAccount = async (reqBody) => {
  try {
    // Kiểm tra account trong database đã có chưa
    const existUser = await userModel.findOneByEmail(reqBody.email)

    if (!existUser) { throw new ApiError(StatusCodes.NOT_FOUND, 'Account not Found!') }
    if (existUser.isActive) { throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Your Account is already active!') }
    if (reqBody.token !== existUser.verifyToken) { throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Token is invalid!') }

    // Nếu mọi thứ oke thì cập nhật lại thông tin user để verify tài khoản
    const updateData = {
      isActive: true,
      verifyToken: null
    }
    const updateUser = await userModel.update(existUser._id, updateData)

    return pickUser(updateUser)
  } catch (error) { throw error }
}

const login = async (reqBody) => {
  try {
    // Kiểm tra account trong database đã có chưa
    const existUser = await userModel.findOneByEmail(reqBody.email)

    if (!existUser) { throw new ApiError(StatusCodes.NOT_FOUND, 'Account not Found!') }
    if (!existUser.isActive) { throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Your Account is not active!') }
    if (!bcryptjs.compareSync(reqBody.password, existUser.password)) {
      { throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Your Email or Password is incorrect!') }
    }

    const userInfo = { _id: existUser._id, email: existUser.email }

    // Tạo ra 2 loại token, accessToken-và-refreshToken- để trả về cho phía - FE
    const accessToken = await JwtProvider.generateToken(userInfo, env.ACCESS_TOKEN_SECRET_SIGNATURE, env.ACCESS_TOKEN_LIFE)
    const refreshToken = await JwtProvider.generateToken(userInfo, env.REFRESH_TOKEN_SECRET_SIGNATURE, env.REFRESH_TOKEN_LIFE)

    return { accessToken, refreshToken, ...pickUser(existUser) }
  } catch (error) { throw error }
}

const refreshToken = async (clientRefreshToken) => {
  try {
    const refreshTokenDecoded = await JwtProvider.verifyToken(clientRefreshToken, env.REFRESH_TOKEN_SECRET_SIGNATURE)

    const userInfo = {
      _id: refreshTokenDecoded._id,
      email: refreshTokenDecoded.email
    }

    // Tạo accessToken mới
    const accessToken = await JwtProvider.generateToken (
      userInfo,
      env.ACCESS_TOKEN_SECRET_SIGNATURE,
      env.ACCESS_TOKEN_LIFE
    )

    return { accessToken }
  } catch (error) { throw error }
}

const update = async (userId, reqBody, userAvatarFile) => {
  try {
    const existUser = await userModel.findOneById(userId)
    if (!existUser) throw new ApiError(StatusCodes.NOT_FOUND, 'Account not found')
    if (!existUser.isActive) throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Your account is not active')

    // Khởi tạo kết quả updated User ban đầu là empty
    let updatedUser = {}

    // TH1: Change password
    if (reqBody.current_password && reqBody.new_password) {
      // Kiểm tra mật khẩu hiện tại
      if (!bcryptjs.compareSync(reqBody.current_password, existUser.password)) {
        throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Your current password is incorrect!')
      }

      // Nếu current_password là đúng thì hash new_password và update lại vào DB
      updatedUser = await userModel.update(existUser._id, {
        password: bcryptjs.hashSync(reqBody.new_password, 8)
      })
    } else if (userAvatarFile) { // TH2: Update File lên Cloud Storage
      const uploadResult = await CloudinaryProvider.streamUpload(userAvatarFile.buffer, 'users')
      console.log('🚀 ~ update ~ uploadResult:', uploadResult)

      // Lưu lại url của file ảnh trên Clouldinary vào DB
      updatedUser = await userModel.update(existUser._id, {
        avatar: uploadResult.secure_url
      })
    } else {
      // TH3: Update thông tin chung, ví dụ như displayName
      updatedUser = await userModel.update(existUser._id, reqBody)
    }

    return pickUser(updatedUser)
  } catch (error) { throw error }
}


export const userService = {
  createNew,
  verifyAccount,
  login,
  refreshToken,
  update
}
