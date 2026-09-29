<?php

namespace App\Controllers;

use App\Config\Database;
use App\Core\Request;
use App\Core\Response;
use App\Utils\Password;
use App\Utils\Validator;
use MongoDB\BSON\ObjectId;
use MongoDB\BSON\UTCDateTime;

/**
 * Admin Part A — the basic foundation only: dashboard totals, simple
 * Student/Teacher/Course/Semester CRUD, read-only result status, and the
 * generic profile/notifications/settings endpoints already shared with
 * every other role. Approval workflows, analytics, teacher-course
 * assignment, audit browsing, etc. are intentionally out of scope here and
 * land in the Final Admin Update.
 */
class AdminController
{
    private function currentAdmin(Request $request): array
    {
        $db = Database::getInstance();
        $admin = $db->admins->findOne(['userId' => new ObjectId($request->user['sub'])]);

        if (!$admin) {
            Response::error('Admin profile not found.', 404);
        }

        return (array) $admin;
    }

    // ---------------------------------------------------------------
    // Dashboard
    // ---------------------------------------------------------------

    public function dashboard(Request $request): void
    {
        $db = Database::getInstance();

        $totalStudents = $db->students->countDocuments();
        $totalTeachers = $db->teachers->countDocuments();
        $totalCourses = $db->courses->countDocuments();
        $publishedResults = $db->results->countDocuments(['resultStatus' => 'published']);

        $currentSemester = $db->semesters->findOne(['status' => 'active']);

        $recent = [];

        foreach ($db->students->find([], ['sort' => ['createdAt' => -1], 'limit' => 5]) as $s) {
            $user = $db->users->findOne(['_id' => $s['userId']]);
            $recent[] = ['type' => 'student_added', 'label' => 'Student added: ' . ($user['name'] ?? $s['studentId']), 'at' => $s['createdAt']];
        }
        foreach ($db->teachers->find([], ['sort' => ['createdAt' => -1], 'limit' => 5]) as $t) {
            $user = $db->users->findOne(['_id' => $t['userId']]);
            $recent[] = ['type' => 'teacher_added', 'label' => 'Teacher added: ' . ($user['name'] ?? $t['teacherId']), 'at' => $t['createdAt']];
        }
        foreach ($db->courses->find([], ['sort' => ['createdAt' => -1], 'limit' => 5]) as $c) {
            $recent[] = ['type' => 'course_added', 'label' => "Course added: {$c['code']} — {$c['name']}", 'at' => $c['createdAt']];
        }
        foreach ($db->results->find(['resultStatus' => 'published'], ['sort' => ['publishedAt' => -1], 'limit' => 5]) as $r) {
            $recent[] = ['type' => 'result_published', 'label' => "Result published: {$r['courseCode']}", 'at' => $r['publishedAt'] ?? $r['updatedAt']];
        }

        usort($recent, fn($a, $b) => $b['at']->toDateTime() <=> $a['at']->toDateTime());
        $recent = array_slice($recent, 0, 8);

        Response::success([
            'totalStudents' => $totalStudents,
            'totalTeachers' => $totalTeachers,
            'totalCourses' => $totalCourses,
            'currentSemester' => $currentSemester ? $currentSemester['label'] : null,
            'publishedResults' => $publishedResults,
            'recentActivity' => array_map(fn($r) => [
                'type' => $r['type'],
                'label' => $r['label'],
                'at' => $r['at']->toDateTime()->format(DATE_ATOM),
            ], $recent),
        ]);
    }

    // ---------------------------------------------------------------
    // Students
    // ---------------------------------------------------------------

    public function students(Request $request): void
    {
        $db = Database::getInstance();

        $filter = [];
        $students = iterator_to_array($db->students->find($filter, ['sort' => ['createdAt' => -1]]));

        $search = $request->input('search');
        $rows = [];
        foreach ($students as $s) {
            $user = $db->users->findOne(['_id' => $s['userId']]);
            $department = $s['departmentId'] ? $db->departments->findOne(['_id' => $s['departmentId']]) : null;

            if ($search) {
                $needle = strtolower($search);
                $haystack = strtolower(($user['name'] ?? '') . ' ' . $s['studentId'] . ' ' . ($user['email'] ?? ''));
                if (!str_contains($haystack, $needle)) {
                    continue;
                }
            }

            $rows[] = [
                'id' => (string) $s['_id'],
                'studentId' => $s['studentId'],
                'name' => $user['name'] ?? '—',
                'email' => $user['email'] ?? '—',
                'phone' => $s['phone'] ?? '',
                'department' => $department['name'] ?? '—',
                'departmentId' => $s['departmentId'] ? (string) $s['departmentId'] : null,
                'currentSemester' => $s['currentSemester'] ?? null,
                'status' => $user['status'] ?? 'active',
            ];
        }

        Response::success($rows);
    }

    public function createStudent(Request $request): void
    {
        $db = Database::getInstance();
        $body = $request->body;

        $v = new Validator($body);
        $v->required('name', 'Name')
          ->required('email', 'Email')->email('email')
          ->required('password', 'Password')->minLength('password', 8)
          ->required('studentId', 'Student ID')
          ->required('departmentId', 'Department')
          ->required('currentSemester', 'Semester');
        if ($v->fails()) {
            Response::error('Please fix the errors below.', 422, $v->errors());
        }

        $email = strtolower(trim($body['email']));
        if ($db->users->findOne(['email' => $email])) {
            Response::error('Please fix the errors below.', 422, ['email' => ['This email is already in use.']]);
        }
        if ($db->students->findOne(['studentId' => $body['studentId']])) {
            Response::error('Please fix the errors below.', 422, ['studentId' => ['This Student ID is already in use.']]);
        }

        $now = new UTCDateTime();
        $userId = new ObjectId();

        $db->users->insertOne([
            '_id' => $userId,
            'name' => $body['name'],
            'email' => $email,
            'passwordHash' => Password::hash($body['password']),
            'role' => 'student',
            'status' => 'active',
            'avatarUrl' => "https://api.dicebear.com/7.x/initials/svg?seed=" . urlencode($body['name']),
            'createdAt' => $now,
            'updatedAt' => $now,
        ]);

        $db->students->insertOne([
            '_id' => new ObjectId(),
            'userId' => $userId,
            'studentId' => $body['studentId'],
            'departmentId' => new ObjectId($body['departmentId']),
            'currentSemester' => $body['currentSemester'],
            'phone' => $body['phone'] ?? '',
            'address' => $body['address'] ?? '',
            'dateOfBirth' => $body['dateOfBirth'] ?? '',
            'createdAt' => $now,
            'updatedAt' => $now,
        ]);

        Response::success(null, 'Student created successfully.', 201);
    }

    public function updateStudent(Request $request): void
    {
        $db = Database::getInstance();
        $student = $db->students->findOne(['_id' => new ObjectId($request->params['id'])]);
        if (!$student) {
            Response::error('Student not found.', 404);
        }

        $v = new Validator($request->body);
        $v->required('name', 'Name')->required('departmentId', 'Department')->required('currentSemester', 'Semester');
        if ($v->fails()) {
            Response::error('Please fix the errors below.', 422, $v->errors());
        }

        $db->users->updateOne(
            ['_id' => $student['userId']],
            ['$set' => ['name' => $request->body['name'], 'updatedAt' => new UTCDateTime()]]
        );

        $db->students->updateOne(
            ['_id' => $student['_id']],
            ['$set' => [
                'departmentId' => new ObjectId($request->body['departmentId']),
                'currentSemester' => $request->body['currentSemester'],
                'phone' => $request->body['phone'] ?? ($student['phone'] ?? ''),
                'address' => $request->body['address'] ?? ($student['address'] ?? ''),
                'updatedAt' => new UTCDateTime(),
            ]]
        );

        Response::success(null, 'Student updated successfully.');
    }

    public function setStudentStatus(Request $request): void
    {
        $db = Database::getInstance();
        $student = $db->students->findOne(['_id' => new ObjectId($request->params['id'])]);
        if (!$student) {
            Response::error('Student not found.', 404);
        }

        $status = $request->body['status'] ?? null;
        if (!in_array($status, ['active', 'inactive'], true)) {
            Response::error('Invalid status.', 422);
        }

        $db->users->updateOne(['_id' => $student['userId']], ['$set' => ['status' => $status, 'updatedAt' => new UTCDateTime()]]);

        Response::success(null, $status === 'active' ? 'Student activated.' : 'Student deactivated.');
    }

    public function deleteStudent(Request $request): void
    {
        $db = Database::getInstance();
        $student = $db->students->findOne(['_id' => new ObjectId($request->params['id'])]);
        if (!$student) {
            Response::error('Student not found.', 404);
        }

        $hasRecords = $db->results->countDocuments(['studentId' => $student['_id']]) > 0
            || $db->enrollments->countDocuments(['studentId' => $student['_id']]) > 0
            || $db->attendance->countDocuments(['studentId' => $student['_id']]) > 0;

        if ($hasRecords) {
            Response::error('This student has existing academic records and cannot be deleted. Deactivate the account instead.', 409);
        }

        $db->students->deleteOne(['_id' => $student['_id']]);
        $db->users->deleteOne(['_id' => $student['userId']]);

        Response::success(null, 'Student deleted successfully.');
    }

    // ---------------------------------------------------------------
    // Teachers
    // ---------------------------------------------------------------

    public function teachers(Request $request): void
    {
        $db = Database::getInstance();
        $teachers = iterator_to_array($db->teachers->find([], ['sort' => ['createdAt' => -1]]));

        $search = $request->input('search');
        $rows = [];
        foreach ($teachers as $t) {
            $user = $db->users->findOne(['_id' => $t['userId']]);
            $department = $t['departmentId'] ? $db->departments->findOne(['_id' => $t['departmentId']]) : null;

            if ($search) {
                $needle = strtolower($search);
                $haystack = strtolower(($user['name'] ?? '') . ' ' . ($t['teacherId'] ?? '') . ' ' . ($user['email'] ?? ''));
                if (!str_contains($haystack, $needle)) {
                    continue;
                }
            }

            $rows[] = [
                'id' => (string) $t['_id'],
                'teacherId' => $t['teacherId'] ?? '—',
                'name' => $user['name'] ?? '—',
                'email' => $user['email'] ?? '—',
                'phone' => $t['phone'] ?? '',
                'department' => $department['name'] ?? '—',
                'departmentId' => $t['departmentId'] ? (string) $t['departmentId'] : null,
                'status' => $user['status'] ?? 'active',
            ];
        }

        Response::success($rows);
    }

    public function createTeacher(Request $request): void
    {
        $db = Database::getInstance();
        $body = $request->body;

        $v = new Validator($body);
        $v->required('name', 'Name')
          ->required('email', 'Email')->email('email')
          ->required('password', 'Password')->minLength('password', 8)
          ->required('teacherId', 'Teacher ID')
          ->required('departmentId', 'Department');
        if ($v->fails()) {
            Response::error('Please fix the errors below.', 422, $v->errors());
        }

        $email = strtolower(trim($body['email']));
        if ($db->users->findOne(['email' => $email])) {
            Response::error('Please fix the errors below.', 422, ['email' => ['This email is already in use.']]);
        }
        if ($db->teachers->findOne(['teacherId' => $body['teacherId']])) {
            Response::error('Please fix the errors below.', 422, ['teacherId' => ['This Teacher ID is already in use.']]);
        }

        $now = new UTCDateTime();
        $userId = new ObjectId();

        $db->users->insertOne([
            '_id' => $userId,
            'name' => $body['name'],
            'email' => $email,
            'passwordHash' => Password::hash($body['password']),
            'role' => 'teacher',
            'status' => 'active',
            'avatarUrl' => "https://api.dicebear.com/7.x/initials/svg?seed=" . urlencode($body['name']),
            'createdAt' => $now,
            'updatedAt' => $now,
        ]);

        $db->teachers->insertOne([
            '_id' => new ObjectId(),
            'userId' => $userId,
            'teacherId' => $body['teacherId'],
            'departmentId' => new ObjectId($body['departmentId']),
            'designation' => $body['designation'] ?? '',
            'phone' => $body['phone'] ?? '',
            'officeHours' => $body['officeHours'] ?? '',
            'createdAt' => $now,
            'updatedAt' => $now,
        ]);

        Response::success(null, 'Teacher created successfully.', 201);
    }

    public function updateTeacher(Request $request): void
    {
        $db = Database::getInstance();
        $teacher = $db->teachers->findOne(['_id' => new ObjectId($request->params['id'])]);
        if (!$teacher) {
            Response::error('Teacher not found.', 404);
        }

        $v = new Validator($request->body);
        $v->required('name', 'Name')->required('departmentId', 'Department');
        if ($v->fails()) {
            Response::error('Please fix the errors below.', 422, $v->errors());
        }

        $db->users->updateOne(
            ['_id' => $teacher['userId']],
            ['$set' => ['name' => $request->body['name'], 'updatedAt' => new UTCDateTime()]]
        );

        $db->teachers->updateOne(
            ['_id' => $teacher['_id']],
            ['$set' => [
                'departmentId' => new ObjectId($request->body['departmentId']),
                'designation' => $request->body['designation'] ?? ($teacher['designation'] ?? ''),
                'phone' => $request->body['phone'] ?? ($teacher['phone'] ?? ''),
                'officeHours' => $request->body['officeHours'] ?? ($teacher['officeHours'] ?? ''),
                'updatedAt' => new UTCDateTime(),
            ]]
        );

        Response::success(null, 'Teacher updated successfully.');
    }

    public function setTeacherStatus(Request $request): void
    {
        $db = Database::getInstance();
        $teacher = $db->teachers->findOne(['_id' => new ObjectId($request->params['id'])]);
        if (!$teacher) {
            Response::error('Teacher not found.', 404);
        }

        $status = $request->body['status'] ?? null;
        if (!in_array($status, ['active', 'inactive'], true)) {
            Response::error('Invalid status.', 422);
        }

        $db->users->updateOne(['_id' => $teacher['userId']], ['$set' => ['status' => $status, 'updatedAt' => new UTCDateTime()]]);

        Response::success(null, $status === 'active' ? 'Teacher activated.' : 'Teacher deactivated.');
    }

    public function deleteTeacher(Request $request): void
    {
        $db = Database::getInstance();
        $teacher = $db->teachers->findOne(['_id' => new ObjectId($request->params['id'])]);
        if (!$teacher) {
            Response::error('Teacher not found.', 404);
        }

        $hasRecords = $db->courses->countDocuments(['teacherId' => $teacher['_id']]) > 0
            || $db->results->countDocuments(['teacherId' => $teacher['_id']]) > 0;

        if ($hasRecords) {
            Response::error('This teacher has assigned courses or results and cannot be deleted. Deactivate the account instead.', 409);
        }

        $db->teachers->deleteOne(['_id' => $teacher['_id']]);
        $db->users->deleteOne(['_id' => $teacher['userId']]);

        Response::success(null, 'Teacher deleted successfully.');
    }

    // ---------------------------------------------------------------
    // Courses (basic catalog — teacher-course assignment stays manual/nullable until the Final Update)
    // ---------------------------------------------------------------

    public function courses(Request $request): void
    {
        $db = Database::getInstance();
        $courses = iterator_to_array($db->courses->find([], ['sort' => ['createdAt' => -1]]));

        Response::success(array_map(function ($c) use ($db) {
            $department = $c['departmentId'] ? $db->departments->findOne(['_id' => $c['departmentId']]) : null;
            $teacher = null;
            if (!empty($c['teacherId'])) {
                $t = $db->teachers->findOne(['_id' => $c['teacherId']]);
                if ($t) {
                    $tUser = $db->users->findOne(['_id' => $t['userId']]);
                    $teacher = $tUser['name'] ?? null;
                }
            }

            return [
                'id' => (string) $c['_id'],
                'code' => $c['code'],
                'name' => $c['name'],
                'credit' => $c['credit'],
                'department' => $department['name'] ?? '—',
                'departmentId' => $c['departmentId'] ? (string) $c['departmentId'] : null,
                'semester' => $c['semester'] ?? null,
                'year' => $c['year'] ?? null,
                'status' => $c['status'] ?? 'active',
                'teacher' => $teacher,
            ];
        }, $courses));
    }

    public function createCourse(Request $request): void
    {
        $db = Database::getInstance();
        $body = $request->body;

        $v = new Validator($body);
        $v->required('code', 'Course Code')
          ->required('name', 'Course Title')
          ->required('credit', 'Credit')
          ->required('departmentId', 'Department')
          ->required('semester', 'Semester')
          ->required('year', 'Academic Year');
        if ($v->fails()) {
            Response::error('Please fix the errors below.', 422, $v->errors());
        }

        $credit = (float) $body['credit'];
        if ($credit <= 0 || $credit > 6) {
            Response::error('Please fix the errors below.', 422, ['credit' => ['Credit must be between 0 and 6.']]);
        }
        if (!in_array($body['semester'], ['Spring', 'Summer', 'Fall'], true)) {
            Response::error('Please fix the errors below.', 422, ['semester' => ['Invalid semester.']]);
        }

        $code = strtoupper(trim($body['code']));
        if ($db->courses->findOne(['code' => $code])) {
            Response::error('Please fix the errors below.', 422, ['code' => ['This course code is already in use.']]);
        }

        $now = new UTCDateTime();
        $db->courses->insertOne([
            '_id' => new ObjectId(),
            'code' => $code,
            'name' => $body['name'],
            'credit' => $credit,
            'departmentId' => new ObjectId($body['departmentId']),
            'teacherId' => null, // teacher-course assignment lands in the Final Admin Update
            'semester' => $body['semester'],
            'year' => (int) $body['year'],
            'status' => 'active',
            'createdAt' => $now,
            'updatedAt' => $now,
        ]);

        Response::success(null, 'Course created successfully.', 201);
    }

    public function updateCourse(Request $request): void
    {
        $db = Database::getInstance();
        $course = $db->courses->findOne(['_id' => new ObjectId($request->params['id'])]);
        if (!$course) {
            Response::error('Course not found.', 404);
        }

        $v = new Validator($request->body);
        $v->required('name', 'Course Title')->required('credit', 'Credit')->required('departmentId', 'Department');
        if ($v->fails()) {
            Response::error('Please fix the errors below.', 422, $v->errors());
        }

        $credit = (float) $request->body['credit'];
        if ($credit <= 0 || $credit > 6) {
            Response::error('Please fix the errors below.', 422, ['credit' => ['Credit must be between 0 and 6.']]);
        }

        $db->courses->updateOne(
            ['_id' => $course['_id']],
            ['$set' => [
                'name' => $request->body['name'],
                'credit' => $credit,
                'departmentId' => new ObjectId($request->body['departmentId']),
                'semester' => $request->body['semester'] ?? ($course['semester'] ?? null),
                'year' => isset($request->body['year']) ? (int) $request->body['year'] : ($course['year'] ?? null),
                'updatedAt' => new UTCDateTime(),
            ]]
        );

        Response::success(null, 'Course updated successfully.');
    }

    public function setCourseStatus(Request $request): void
    {
        $db = Database::getInstance();
        $course = $db->courses->findOne(['_id' => new ObjectId($request->params['id'])]);
        if (!$course) {
            Response::error('Course not found.', 404);
        }

        $status = $request->body['status'] ?? null;
        if (!in_array($status, ['active', 'inactive'], true)) {
            Response::error('Invalid status.', 422);
        }

        $db->courses->updateOne(['_id' => $course['_id']], ['$set' => ['status' => $status, 'updatedAt' => new UTCDateTime()]]);

        Response::success(null, $status === 'active' ? 'Course activated.' : 'Course deactivated.');
    }

    public function deleteCourse(Request $request): void
    {
        $db = Database::getInstance();
        $course = $db->courses->findOne(['_id' => new ObjectId($request->params['id'])]);
        if (!$course) {
            Response::error('Course not found.', 404);
        }

        $hasRecords = $db->results->countDocuments(['courseId' => $course['_id']]) > 0
            || $db->enrollments->countDocuments(['courseId' => $course['_id']]) > 0;

        if ($hasRecords) {
            Response::error('This course has existing enrollments or results and cannot be deleted. Deactivate it instead.', 409);
        }

        $db->courses->deleteOne(['_id' => $course['_id']]);

        Response::success(null, 'Course deleted successfully.');
    }

    // ---------------------------------------------------------------
    // Semesters
    // ---------------------------------------------------------------

    public function semesters(Request $request): void
    {
        $db = Database::getInstance();
        $semesters = $db->semesters->find([], ['sort' => ['year' => -1]]);

        Response::success(array_map(function ($s) {
            return [
                'id' => (string) $s['_id'],
                'name' => $s['name'],
                'year' => $s['year'],
                'label' => $s['label'],
                'status' => $s['status'],
                'startDate' => $s['startDate'] ?? null,
                'endDate' => $s['endDate'] ?? null,
            ];
        }, iterator_to_array($semesters)));
    }

    public function createSemester(Request $request): void
    {
        $db = Database::getInstance();
        $body = $request->body;

        $v = new Validator($body);
        $v->required('name', 'Semester Name')->required('year', 'Academic Year');
        if ($v->fails()) {
            Response::error('Please fix the errors below.', 422, $v->errors());
        }
        if (!in_array($body['name'], ['Spring', 'Summer', 'Fall'], true)) {
            Response::error('Please fix the errors below.', 422, ['name' => ['Invalid semester name.']]);
        }

        $year = (int) $body['year'];
        if ($db->semesters->findOne(['name' => $body['name'], 'year' => $year])) {
            Response::error('Please fix the errors below.', 422, ['name' => ['This semester already exists.']]);
        }

        $now = new UTCDateTime();
        $db->semesters->insertOne([
            '_id' => new ObjectId(),
            'name' => $body['name'],
            'year' => $year,
            'label' => $body['name'] . ' ' . $year,
            'status' => 'inactive',
            'startDate' => $body['startDate'] ?? null,
            'endDate' => $body['endDate'] ?? null,
            'createdAt' => $now,
            'updatedAt' => $now,
        ]);

        Response::success(null, 'Semester created successfully.', 201);
    }

    public function updateSemester(Request $request): void
    {
        $db = Database::getInstance();
        $semester = $db->semesters->findOne(['_id' => new ObjectId($request->params['id'])]);
        if (!$semester) {
            Response::error('Semester not found.', 404);
        }

        $db->semesters->updateOne(
            ['_id' => $semester['_id']],
            ['$set' => [
                'startDate' => $request->body['startDate'] ?? ($semester['startDate'] ?? null),
                'endDate' => $request->body['endDate'] ?? ($semester['endDate'] ?? null),
                'updatedAt' => new UTCDateTime(),
            ]]
        );

        Response::success(null, 'Semester updated successfully.');
    }

    public function activateSemester(Request $request): void
    {
        $db = Database::getInstance();
        $semester = $db->semesters->findOne(['_id' => new ObjectId($request->params['id'])]);
        if (!$semester) {
            Response::error('Semester not found.', 404);
        }

        // Only one semester is "current" at a time.
        $db->semesters->updateMany(['status' => 'active'], ['$set' => ['status' => 'inactive', 'updatedAt' => new UTCDateTime()]]);
        $db->semesters->updateOne(['_id' => $semester['_id']], ['$set' => ['status' => 'active', 'updatedAt' => new UTCDateTime()]]);

        Response::success(null, "{$semester['label']} is now the active semester.");
    }

    public function deactivateSemester(Request $request): void
    {
        $db = Database::getInstance();
        $semester = $db->semesters->findOne(['_id' => new ObjectId($request->params['id'])]);
        if (!$semester) {
            Response::error('Semester not found.', 404);
        }

        $db->semesters->updateOne(['_id' => $semester['_id']], ['$set' => ['status' => 'inactive', 'updatedAt' => new UTCDateTime()]]);

        Response::success(null, 'Semester deactivated.');
    }

    public function deleteSemester(Request $request): void
    {
        $db = Database::getInstance();
        $semester = $db->semesters->findOne(['_id' => new ObjectId($request->params['id'])]);
        if (!$semester) {
            Response::error('Semester not found.', 404);
        }

        $hasRecords = $db->results->countDocuments(['semester' => $semester['name'], 'year' => $semester['year']]) > 0
            || $db->enrollments->countDocuments(['semester' => $semester['name'], 'year' => $semester['year']]) > 0;

        if ($hasRecords) {
            Response::error('This semester already has academic records and cannot be deleted. Deactivate it instead.', 409);
        }

        $db->semesters->deleteOne(['_id' => $semester['_id']]);

        Response::success(null, 'Semester deleted successfully.');
    }

    // ---------------------------------------------------------------
    // Results — read-only in Part A; the full approval/publish/audit
    // workflow for Admin is reserved for the Final Update.
    // ---------------------------------------------------------------

    public function results(Request $request): void
    {
        $db = Database::getInstance();

        $filter = [];
        if ($status = $request->input('status')) {
            $filter['resultStatus'] = $status;
        }
        if ($semester = $request->input('semester')) {
            $filter['semester'] = $semester;
        }
        if ($year = $request->input('year')) {
            $filter['year'] = (int) $year;
        }
        if ($search = $request->input('search')) {
            $filter['$or'] = [
                ['courseCode' => ['$regex' => $search, '$options' => 'i']],
                ['courseName' => ['$regex' => $search, '$options' => 'i']],
            ];
        }

        $results = $db->results->find($filter, ['sort' => ['updatedAt' => -1], 'limit' => 300]);

        Response::success(array_map(function ($r) use ($db) {
            $student = $db->students->findOne(['_id' => $r['studentId']]);
            return [
                'id' => (string) $r['_id'],
                'studentId' => $student['studentId'] ?? '—',
                'courseCode' => $r['courseCode'],
                'courseName' => $r['courseName'],
                'teacherName' => $r['teacherName'],
                'semester' => $r['semester'],
                'year' => $r['year'],
                'totalMarks' => $r['totalMarks'] ?? $r['marks'] ?? null,
                'grade' => $r['grade'],
                'resultStatus' => $r['resultStatus'],
                'updatedAt' => $r['updatedAt']->toDateTime()->format(DATE_ATOM),
            ];
        }, iterator_to_array($results)));
    }

    // ---------------------------------------------------------------
    // Departments (read-only list — Department Management is a Final Update feature)
    // ---------------------------------------------------------------

    public function departments(Request $request): void
    {
        $db = Database::getInstance();
        $departments = $db->departments->find();

        Response::success(array_map(function ($d) {
            return ['id' => (string) $d['_id'], 'name' => $d['name'], 'code' => $d['code']];
        }, iterator_to_array($departments)));
    }

    // ---------------------------------------------------------------
    // Profile
    // ---------------------------------------------------------------

    public function getProfile(Request $request): void
    {
        $db = Database::getInstance();
        $admin = $this->currentAdmin($request);
        $user = $db->users->findOne(['_id' => $admin['userId']]);

        Response::success([
            'id' => (string) $admin['_id'],
            'adminId' => $admin['adminId'] ?? '—',
            'name' => $user['name'],
            'email' => $user['email'],
            'avatarUrl' => $user['avatarUrl'] ?? null,
            'phone' => $admin['phone'] ?? '',
        ]);
    }

    public function updateProfile(Request $request): void
    {
        $db = Database::getInstance();
        $admin = $this->currentAdmin($request);

        $v = new Validator($request->body);
        $v->required('name', 'Name');
        if ($v->fails()) {
            Response::error('Please fix the errors below.', 422, $v->errors());
        }

        $db->users->updateOne(
            ['_id' => $admin['userId']],
            ['$set' => ['name' => $request->body['name'], 'updatedAt' => new UTCDateTime()]]
        );

        $db->admins->updateOne(
            ['_id' => $admin['_id']],
            ['$set' => ['phone' => $request->body['phone'] ?? ($admin['phone'] ?? ''), 'updatedAt' => new UTCDateTime()]]
        );

        Response::success(null, 'Profile updated successfully.');
    }

    public function changePassword(Request $request): void
    {
        $db = Database::getInstance();
        $admin = $this->currentAdmin($request);

        $v = new Validator($request->body);
        $v->required('currentPassword', 'Current Password')
          ->required('newPassword', 'New Password')->minLength('newPassword', 8)
          ->required('confirmPassword', 'Confirm Password')
          ->matches('confirmPassword', 'newPassword', 'Passwords do not match.');

        if ($v->fails()) {
            Response::error('Please fix the errors below.', 422, $v->errors());
        }

        $user = $db->users->findOne(['_id' => $admin['userId']]);

        if (!Password::verify($request->body['currentPassword'], $user['passwordHash'])) {
            Response::error('Current password is incorrect.', 401);
        }

        $db->users->updateOne(
            ['_id' => $user['_id']],
            ['$set' => ['passwordHash' => Password::hash($request->body['newPassword']), 'updatedAt' => new UTCDateTime()]]
        );

        Response::success(null, 'Password changed successfully.');
    }
}
