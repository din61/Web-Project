// PARENT endpoint slice — extracted from frontend/src/api/endpoints.js for
// review / individual upload only. Not imported by the app directly.
//
// To merge: these exports already exist in the real
// frontend/src/api/endpoints.js on `main`. `client` is the shared axios
// instance from './client'.

import client from './client';

export const ParentApi = {
  children: () => client.get('/parent/children'),
  dashboard: (params) => client.get('/parent/dashboard', { params }),
  results: (params) => client.get('/parent/results', { params }),
  academicHistory: (params) => client.get('/parent/academic-history', { params }),
  attendance: (params) => client.get('/parent/attendance', { params }),
  reportCard: (params) => client.get('/parent/report-card', { params }),
  getProfile: () => client.get('/parent/profile'),
  updateProfile: (payload) => client.put('/parent/profile', payload),
  changePassword: (payload) => client.put('/parent/change-password', payload),
};
