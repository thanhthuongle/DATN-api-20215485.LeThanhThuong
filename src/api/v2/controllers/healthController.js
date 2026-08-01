import { StatusCodes } from 'http-status-codes'
import {
  mapHealthResponse,
  mapPostgresHealthResponse
} from '~/api/v2/mappers/healthMapper'
import { getPostgresHealthStatus } from '~/v2/modules/system/services/getPostgresHealth.service'

export const getHealth = (req, res) => {
  res.status(StatusCodes.OK).json(mapHealthResponse({
    timestamp: new Date().toISOString()
  }))
}

export const getPostgresHealth = async (req, res, next) => {
  try {
    const health = await getPostgresHealthStatus()
    res.status(StatusCodes.OK).json(mapPostgresHealthResponse(health))
  } catch (error) {
    next(error)
  }
}
