<?php
/**
 * STUDENT route partial — extracted from backend/routes/api.php for review /
 * individual upload only. This file is NOT included by the app directly.
 *
 * To merge: copy these $router->... lines into the real
 * backend/routes/api.php (they're already there on `main`). $auth and
 * $studentOnly are already defined at the top of api.php.
 */

// ---- Student ----
$router->get('/api/student/dashboard', [StudentController::class, 'dashboard'], [$auth, $studentOnly]);
$router->get('/api/student/results', [StudentController::class, 'results'], [$auth, $studentOnly]);
$router->get('/api/student/academic-history', [StudentController::class, 'academicHistory'], [$auth, $studentOnly]);
$router->get('/api/student/attendance', [StudentController::class, 'attendance'], [$auth, $studentOnly]);
$router->get('/api/student/profile', [StudentController::class, 'getProfile'], [$auth, $studentOnly]);
$router->put('/api/student/profile', [StudentController::class, 'updateProfile'], [$auth, $studentOnly]);
$router->put('/api/student/change-password', [StudentController::class, 'changePassword'], [$auth, $studentOnly]);
$router->get('/api/student/grade-change-requests', [StudentController::class, 'gradeChangeRequests'], [$auth, $studentOnly]);
$router->post('/api/student/grade-change-requests', [StudentController::class, 'requestGradeChange'], [$auth, $studentOnly]);

// ---- Chat (shared with Teacher — only include once when merging) ----
$chatRoles = RoleMiddleware::only('student', 'teacher');
$router->get('/api/chat/contacts', [ChatController::class, 'contacts'], [$auth, $chatRoles]);
$router->get('/api/chat/conversations', [ChatController::class, 'conversations'], [$auth, $chatRoles]);
$router->post('/api/chat/conversations', [ChatController::class, 'startConversation'], [$auth, $chatRoles]);
$router->get('/api/chat/conversations/:id/messages', [ChatController::class, 'messages'], [$auth, $chatRoles]);
$router->post('/api/chat/conversations/:id/messages', [ChatController::class, 'sendMessage'], [$auth, $chatRoles]);
