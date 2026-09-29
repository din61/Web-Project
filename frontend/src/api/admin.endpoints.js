// ADMIN endpoint slice — extracted from frontend/src/api/endpoints.js for
// review / individual upload only. Not imported by the app directly.
//
// To merge: these exports already exist in the real
// frontend/src/api/endpoints.js on `main`. `client` is the shared axios
// instance from './client'.

import client from './client';

export const AdminApi = {
  dashboard: () => client.get('/admin/dashboard'),

  students: (params) => client.get('/admin/students', { params }),
  createStudent: (payload) => client.post('/admin/students', payload),
  updateStudent: (id, payload) => client.put(`/admin/students/${id}`, payload),
  setStudentStatus: (id, status) => client.put(`/admin/students/${id}/status`, { status }),
  deleteStudent: (id) => client.delete(`/admin/students/${id}`),

  teachers: (params) => client.get('/admin/teachers', { params }),
  createTeacher: (payload) => client.post('/admin/teachers', payload),
  updateTeacher: (id, payload) => client.put(`/admin/teachers/${id}`, payload),
  setTeacherStatus: (id, status) => client.put(`/admin/teachers/${id}/status`, { status }),
  deleteTeacher: (id) => client.delete(`/admin/teachers/${id}`),

  courses: () => client.get('/admin/courses'),
  createCourse: (payload) => client.post('/admin/courses', payload),
  updateCourse: (id, payload) => client.put(`/admin/courses/${id}`, payload),
  setCourseStatus: (id, status) => client.put(`/admin/courses/${id}/status`, { status }),
  deleteCourse: (id) => client.delete(`/admin/courses/${id}`),

  semesters: () => client.get('/admin/semesters'),
  createSemester: (payload) => client.post('/admin/semesters', payload),
  updateSemester: (id, payload) => client.put(`/admin/semesters/${id}`, payload),
  activateSemester: (id) => client.put(`/admin/semesters/${id}/activate`),
  deactivateSemester: (id) => client.put(`/admin/semesters/${id}/deactivate`),
  deleteSemester: (id) => client.delete(`/admin/semesters/${id}`),

  results: (params) => client.get('/admin/results', { params }),
  departments: () => client.get('/admin/departments'),

  getProfile: () => client.get('/admin/profile'),
  updateProfile: (payload) => client.put('/admin/profile', payload),
  changePassword: (payload) => client.put('/admin/change-password', payload),
};
