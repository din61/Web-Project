// TEACHER endpoint slice — extracted from frontend/src/api/endpoints.js for
// review / individual upload only. Not imported by the app directly.
//
// To merge: these exports already exist in the real
// frontend/src/api/endpoints.js on `main`. `client` is the shared axios
// instance from './client'.

import client from './client';

export const TeacherApi = {
  dashboard: () => client.get('/teacher/dashboard'),
  courses: () => client.get('/teacher/courses'),
  students: (params) => client.get('/teacher/students', { params }),
  marksSheet: (params) => client.get('/teacher/marks-sheet', { params }),
  saveMarks: (payload) => client.post('/teacher/marks', payload),
  publishPreview: (params) => client.get('/teacher/publish-preview', { params }),
  publish: (payload) => client.post('/teacher/publish', payload),
  auditLog: (params) => client.get('/teacher/audit-log', { params }),
  resolveGradeChangeRequest: (id, payload) => client.put(`/teacher/grade-change-requests/${id}/resolve`, payload),
  reportCard: (params) => client.get('/teacher/report-card', { params }),
  getProfile: () => client.get('/teacher/profile'),
  updateProfile: (payload) => client.put('/teacher/profile', payload),
  changePassword: (payload) => client.put('/teacher/change-password', payload),
};

// Chat is shared with Student — only include this block once when merging.
export const ChatApi = {
  contacts: () => client.get('/chat/contacts'),
  conversations: () => client.get('/chat/conversations'),
  startConversation: (contactId) => client.post('/chat/conversations', { contactId }),
  messages: (conversationId, params) => client.get(`/chat/conversations/${conversationId}/messages`, { params }),
  sendMessage: (conversationId, text) => client.post(`/chat/conversations/${conversationId}/messages`, { text }),
};
