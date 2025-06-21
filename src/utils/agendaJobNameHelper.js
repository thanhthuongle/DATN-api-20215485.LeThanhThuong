/**
 * Sinh tên job Agenda để quản lý thêm sửa xóa
 * @param {string} agendaJobDefine - Tên job định nghĩa trong agenda.define()
 * @param {string} jobType - Loại công việc logic của hệ thống v.v.
 * @param {string|ObjectId} userId - ID người dùng
 * @returns {string} - Tên job chuẩn hóa
 */
export const generateAgendaJobName = (agendaJobDefine, jobType, userId) => {
  const safeUserId = userId.toString()
  return `${agendaJobDefine}-${jobType}-${safeUserId}`
}
