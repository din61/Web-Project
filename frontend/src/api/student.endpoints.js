// STUDENT endpoint slice — extracted from frontend/src/api/endpoints.js for
// review / individual upload only. Not imported by the app directly.
//
// To merge: these exports already exist in the real
// frontend/src/api/endpoints.js on `main`. `client` is the shared axios
// instance from './client'.

import client from './client';

export const StudentApi = {
  dashboard: () => client.get('/student/dashboard'),
  results: (params) => client.get('/student/results', { params }),
  academicHistory: () => client.get('/student/academic-history'),
  attendance: (params) => client.get('/student/attendance', { params }),
  getProfile: () => client.get('/student/profile'),
  updateProfile: (payload) => client.put('/student/profile', payload),
  changePassword: (payload) => client.put('/student/change-password', payload),
  gradeChangeRequests: () => client.get('/student/grade-change-requests'),
  requestGradeChange: (payload) => client.post('/student/grade-change-requests', payload),
};

// Chat is shared with Teacher — only include this block once when merging.
export const ChatApi = {
  contacts: () => client.get('/chat/contacts'),
  conversations: () => client.get('/chat/conversations'),
  startConversation: (contactId) => client.post('/chat/conversations', { contactId }),
  messages: (conversationId, params) => client.get(`/chat/conversations/${conversationId}/messages`, { params }),
  sendMessage: (conversationId, text) => client.post(`/chat/conversations/${conversationId}/messages`, { text }),
};
