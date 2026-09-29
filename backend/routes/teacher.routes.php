<?php
/**
 * TEACHER route partial — extracted from backend/routes/api.php for review /
 * individual upload only. This file is NOT included by the app directly.
 *
 * To merge: copy these $router->... lines into the real
 * backend/routes/api.php (they're already there on `main`). $auth and
 * $teacherOnly are already defined at the top of api.php.
 */

// ---- Teacher ----
$router->get('/api/teacher/dashboard', [TeacherController::class, 'dashboard'], [$auth, $teacherOnly]);
$router->get('/api/teacher/courses', [TeacherController::class, 'courses'], [$auth, $teacherOnly]);
$router->get('/api/teacher/students', [TeacherController::class, 'students'], [$auth, $teacherOnly]);
$router->get('/api/teacher/marks-sheet', [TeacherController::class, 'marksSheet'], [$auth, $teacherOnly]);
$router->post('/api/teacher/marks', [TeacherController::class, 'saveMarks'], [$auth, $teacherOnly]);
$router->get('/api/teacher/publish-preview', [TeacherController::class, 'publishPreview'], [$auth, $teacherOnly]);
$router->post('/api/teacher/publish', [TeacherController::class, 'publish'], [$auth, $teacherOnly]);
$router->get('/api/teacher/audit-log', [TeacherController::class, 'auditLog'], [$auth, $teacherOnly]);
$router->put('/api/teacher/grade-change-requests/:id/resolve', [TeacherController::class, 'resolveGradeChangeRequest'], [$auth, $teacherOnly]);
$router->get('/api/teacher/report-card', [TeacherController::class, 'reportCard'], [$auth, $teacherOnly]);
$router->get('/api/teacher/profile', [TeacherController::class, 'getProfile'], [$auth, $teacherOnly]);
$router->put('/api/teacher/profile', [TeacherController::class, 'updateProfile'], [$auth, $teacherOnly]);
$router->put('/api/teacher/change-password', [TeacherController::class, 'changePassword'], [$auth, $teacherOnly]);

// ---- Chat (shared with Student — only include once when merging) ----
$chatRoles = RoleMiddleware::only('student', 'teacher');
$router->get('/api/chat/contacts', [ChatController::class, 'contacts'], [$auth, $chatRoles]);
$router->get('/api/chat/conversations', [ChatController::class, 'conversations'], [$auth, $chatRoles]);
$router->post('/api/chat/conversations', [ChatController::class, 'startConversation'], [$auth, $chatRoles]);
$router->get('/api/chat/conversations/:id/messages', [ChatController::class, 'messages'], [$auth, $chatRoles]);
$router->post('/api/chat/conversations/:id/messages', [ChatController::class, 'sendMessage'], [$auth, $chatRoles]);
