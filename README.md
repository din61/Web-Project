# Web-Project
Student Management System

## Teacher — role slice

Pushed on the `teacher` branch. See `../README.md` (on `main`) for how this
fits into the full app.

## Contents

- `backend/src/Controllers/TeacherController.php` — dashboard, courses, students, marks sheet (enter/edit), publish workflow, audit log, grade-change-request resolution, report card, profile, change-password.
- `backend/src/Controllers/ChatController.php` — shared with `student/`; real-time student↔teacher messaging.
- `backend/routes/teacher.routes.php` — reference-only route list (see file header).
- `frontend/src/pages/teacher/*.jsx` — Dashboard, Courses, Students, EnterMarks, PublishResults, ReportCard, Profile, Notifications, Settings.
- `frontend/src/pages/shared/Chat.jsx` — shared with `student/`; the messaging UI.
- `frontend/src/api/teacher.endpoints.js` — `TeacherApi` + `ChatApi`, reference-only.

## Depends on (already on `main`, not duplicated here)

`GradeService`, `GradeAuditService`, `NotificationService`,
`AuthMiddleware`, `RoleMiddleware`, `Database`, and the shared frontend UI
kit (`components/ui/*`), layout (`DashboardLayout`, `Sidebar`, `Navbar`),
and `AuthContext`.

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
