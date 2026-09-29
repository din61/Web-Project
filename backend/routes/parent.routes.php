<?php
/**
 * PARENT route partial — extracted from backend/routes/api.php for review /
 * individual upload only. This file is NOT included by the app directly.
 *
 * To merge: copy these $router->... lines into the real
 * backend/routes/api.php (they're already there on `main`). $auth and
 * $parentOnly are already defined at the top of api.php.
 */

// ---- Parent (strictly read-only for academic data) ----
$router->get('/api/parent/children', [ParentController::class, 'children'], [$auth, $parentOnly]);
$router->get('/api/parent/dashboard', [ParentController::class, 'dashboard'], [$auth, $parentOnly]);
$router->get('/api/parent/results', [ParentController::class, 'results'], [$auth, $parentOnly]);
$router->get('/api/parent/academic-history', [ParentController::class, 'academicHistory'], [$auth, $parentOnly]);
$router->get('/api/parent/attendance', [ParentController::class, 'attendance'], [$auth, $parentOnly]);
$router->get('/api/parent/report-card', [ParentController::class, 'reportCard'], [$auth, $parentOnly]);
$router->get('/api/parent/profile', [ParentController::class, 'getProfile'], [$auth, $parentOnly]);
$router->put('/api/parent/profile', [ParentController::class, 'updateProfile'], [$auth, $parentOnly]);
$router->put('/api/parent/change-password', [ParentController::class, 'changePassword'], [$auth, $parentOnly]);
