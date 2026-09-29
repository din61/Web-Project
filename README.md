# Web-Project
Student Management System

## Student — role slice

Pushed on the `student` branch. See `../README.md` (on `main`) for how this
fits into the full app.

## Contents

- `backend/src/Controllers/StudentController.php` — dashboard, results, academic history, attendance, profile, change-password, and grade-change-request endpoints.
- `backend/src/Controllers/ChatController.php` — shared with `teacher/`; real-time student↔teacher messaging.
- `backend/routes/student.routes.php` — reference-only route list (see file header).
- `frontend/src/pages/student/*.jsx` — Dashboard, Results, AcademicHistory, Attendance, Profile, Notifications, Settings.
- `frontend/src/pages/shared/Chat.jsx` — shared with `teacher/`; the messaging UI.
- `frontend/src/api/student.endpoints.js` — `StudentApi` + `ChatApi`, reference-only.

## Depends on (already on `main`, not duplicated here)

`GradeService`, `NotificationService`, `AuthMiddleware`, `RoleMiddleware`,
`Database`, and the shared frontend UI kit (`components/ui/*`), layout
(`DashboardLayout`, `Sidebar`, `Navbar`), and `AuthContext`.
