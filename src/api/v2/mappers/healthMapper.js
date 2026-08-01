export const mapHealthResponse = ({ timestamp }) => ({
  status: 'ok',
  version: 'v2',
  timestamp
})

export const mapPostgresHealthResponse = ({ status, latencyMs }) => ({
  status,
  dependency: 'postgresql',
  latencyMs
})
