<?php
/**
 * ADMIN route partial — extracted from backend/routes/api.php for review /
 * individual upload only. This file is NOT included by the app directly.
 *
 * To merge: copy these $router->... lines into the real
 * backend/routes/api.php (they're already there on `main`). $auth and
 * $adminOnly are already defined at the top of api.php.
 */

// ---- Admin (Part A: basic foundation) ----
$router->get('/api/admin/dashboard', [AdminController::class, 'dashboard'], [$auth, $adminOnly]);

$router->get('/api/admin/students', [AdminController::class, 'students'], [$auth, $adminOnly]);
$router->post('/api/admin/students', [AdminController::class, 'createStudent'], [$auth, $adminOnly]);
$router->put('/api/admin/students/:id', [AdminController::class, 'updateStudent'], [$auth, $adminOnly]);
$router->put('/api/admin/students/:id/status', [AdminController::class, 'setStudentStatus'], [$auth, $adminOnly]);
$router->delete('/api/admin/students/:id', [AdminController::class, 'deleteStudent'], [$auth, $adminOnly]);

$router->get('/api/admin/teachers', [AdminController::class, 'teachers'], [$auth, $adminOnly]);
$router->post('/api/admin/teachers', [AdminController::class, 'createTeacher'], [$auth, $adminOnly]);
$router->put('/api/admin/teachers/:id', [AdminController::class, 'updateTeacher'], [$auth, $adminOnly]);
$router->put('/api/admin/teachers/:id/status', [AdminController::class, 'setTeacherStatus'], [$auth, $adminOnly]);
$router->delete('/api/admin/teachers/:id', [AdminController::class, 'deleteTeacher'], [$auth, $adminOnly]);

$router->get('/api/admin/courses', [AdminController::class, 'courses'], [$auth, $adminOnly]);
$router->post('/api/admin/courses', [AdminController::class, 'createCourse'], [$auth, $adminOnly]);
$router->put('/api/admin/courses/:id', [AdminController::class, 'updateCourse'], [$auth, $adminOnly]);
$router->put('/api/admin/courses/:id/status', [AdminController::class, 'setCourseStatus'], [$auth, $adminOnly]);
$router->delete('/api/admin/courses/:id', [AdminController::class, 'deleteCourse'], [$auth, $adminOnly]);

$router->get('/api/admin/semesters', [AdminController::class, 'semesters'], [$auth, $adminOnly]);
$router->post('/api/admin/semesters', [AdminController::class, 'createSemester'], [$auth, $adminOnly]);
$router->put('/api/admin/semesters/:id', [AdminController::class, 'updateSemester'], [$auth, $adminOnly]);
$router->put('/api/admin/semesters/:id/activate', [AdminController::class, 'activateSemester'], [$auth, $adminOnly]);
$router->put('/api/admin/semesters/:id/deactivate', [AdminController::class, 'deactivateSemester'], [$auth, $adminOnly]);
$router->delete('/api/admin/semesters/:id', [AdminController::class, 'deleteSemester'], [$auth, $adminOnly]);

$router->get('/api/admin/results', [AdminController::class, 'results'], [$auth, $adminOnly]);
$router->get('/api/admin/departments', [AdminController::class, 'departments'], [$auth, $adminOnly]);

$router->get('/api/admin/profile', [AdminController::class, 'getProfile'], [$auth, $adminOnly]);
$router->put('/api/admin/profile', [AdminController::class, 'updateProfile'], [$auth, $adminOnly]);
$router->put('/api/admin/change-password', [AdminController::class, 'changePassword'], [$auth, $adminOnly]);
