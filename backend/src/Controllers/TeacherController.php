<?php

namespace App\Controllers;

use App\Config\Database;
use App\Core\Request;
use App\Core\Response;
use App\Services\GradeAuditService;
use App\Services\GradeService;
use App\Services\NotificationService;
use App\Utils\Password;
use App\Utils\Validator;
use MongoDB\BSON\ObjectId;
use MongoDB\BSON\UTCDateTime;

class TeacherController
{
    private function currentTeacher(Request $request): array
    {
        $db = Database::getInstance();
        $teacher = $db->teachers->findOne(['userId' => new ObjectId($request->user['sub'])]);

        if (!$teacher) {
            Response::error('Teacher profile not found.', 404);
        }

        return (array) $teacher;
    }

    /** Loads a course and verifies it's actually assigned to this teacher — prevents cross-teacher access via direct API calls. */
    private function ownedCourse(Request $request, array $teacher, string $courseId): array
    {
        $db = Database::getInstance();

        try {
            $course = $db->courses->findOne(['_id' => new ObjectId($courseId)]);
        } catch (\Throwable $e) {
            Response::error('Invalid course.', 400);
        }

        if (!$course) {
            Response::error('Course not found.', 404);
        }

        if ((string) $course['teacherId'] !== (string) $teacher['_id']) {
            Response::error('You do not have permission to access this course.', 403);
        }

        return (array) $course;
    }

    // ---------------------------------------------------------------
    // Dashboard
    // ---------------------------------------------------------------

    public function dashboard(Request $request): void
    {
        $db = Database::getInstance();
        $teacher = $this->currentTeacher($request);

        $courses = iterator_to_array($db->courses->find(['teacherId' => $teacher['_id']]));

        $totalStudents = count($db->enrollments->distinct('studentId', ['teacherId' => $teacher['_id']]));

        $allResults = iterator_to_array($db->results->find(['teacherId' => $teacher['_id']]));
        $pending = array_filter($allResults, fn($r) => in_array($r['resultStatus'], ['draft', 'submitted'], true));
        $published = array_filter($allResults, fn($r) => $r['resultStatus'] === 'published');
        $finalized = array_filter($allResults, fn($r) => in_array($r['resultStatus'], ['submitted', 'published'], true));

        $classAverage = count($finalized) > 0
            ? round(array_sum(array_map(fn($r) => $r['totalMarks'], $finalized)) / count($finalized), 1)
            : 0.0;

        $avgGradePoint = count($finalized) > 0
            ? round(array_sum(array_map(fn($r) => $r['gradePoint'], $finalized)) / count($finalized), 2)
            : 0.0;

        $gradeDistribution = array_fill_keys(GradeService::gradeLabels(), 0);
        foreach ($finalized as $r) {
            if (isset($gradeDistribution[$r['grade']])) {
                $gradeDistribution[$r['grade']]++;
            }
        }

        $recentActivity = $db->results->find(
            ['teacherId' => $teacher['_id']],
            ['sort' => ['updatedAt' => -1], 'limit' => 8]
        );

        $activityLabels = [
            'entered' => 'Marks entered for',
            'updated' => 'Result updated for',
            'submitted' => 'Result submitted for',
            'published' => 'Result published for',
        ];

        Response::success([
            'assignedCourses' => count($courses),
            'totalStudents' => $totalStudents,
            'pendingResults' => count($pending),
            'publishedResults' => count($published),
            'classAverage' => $classAverage,
            'avgGradePoint' => $avgGradePoint,
            'gradeDistribution' => array_map(fn($grade, $count) => ['grade' => $grade, 'count' => $count], array_keys($gradeDistribution), $gradeDistribution),
            'recentActivities' => array_map(function ($r) use ($activityLabels, $db) {
                $student = $db->students->findOne(['_id' => $r['studentId']]);
                $studentName = null;
                if ($student) {
                    $studentUser = $db->users->findOne(['_id' => $student['userId']]);
                    $studentName = $studentUser['name'] ?? null;
                }
                return [
                    'id' => (string) $r['_id'],
                    'action' => $r['lastAction'] ?? 'entered',
                    'label' => ($activityLabels[$r['lastAction'] ?? 'entered'] ?? 'Result changed for') . " {$r['courseCode']}",
                    'studentName' => $studentName,
                    'courseCode' => $r['courseCode'],
                    'resultStatus' => $r['resultStatus'],
                    'at' => $r['updatedAt']->toDateTime()->format(DATE_ATOM),
                ];
            }, iterator_to_array($recentActivity)),
        ]);
    }

    // ---------------------------------------------------------------
    // Courses
    // ---------------------------------------------------------------

    public function courses(Request $request): void
    {
        $db = Database::getInstance();
        $teacher = $this->currentTeacher($request);

        $courses = iterator_to_array($db->courses->find(['teacherId' => $teacher['_id']]));

        $offerings = [];
        foreach ($courses as $course) {
            $groups = $db->enrollments->aggregate([
                ['$match' => ['courseId' => $course['_id']]],
                ['$group' => ['_id' => ['semester' => '$semester', 'year' => '$year'], 'studentCount' => ['$sum' => 1]]],
            ]);

            foreach ($groups as $g) {
                $offerings[] = [
                    'courseId' => (string) $course['_id'],
                    'courseCode' => $course['code'],
                    'courseName' => $course['name'],
                    'credit' => $course['credit'],
                    'semester' => $g['_id']['semester'],
                    'year' => $g['_id']['year'],
                    'studentsCount' => $g['studentCount'],
                    'sortKey' => $g['_id']['year'] * 10 + (['Spring' => 1, 'Summer' => 2, 'Fall' => 3][$g['_id']['semester']] ?? 0),
                ];
            }
        }

        usort($offerings, fn($a, $b) => $b['sortKey'] <=> $a['sortKey']);
        $latestKey = $offerings[0]['sortKey'] ?? null;

        Response::success(array_map(function ($o) use ($latestKey) {
            $o['status'] = $o['sortKey'] === $latestKey ? 'active' : 'completed';
            unset($o['sortKey']);
            return $o;
        }, $offerings));
    }

    // ---------------------------------------------------------------
    // Students
    // ---------------------------------------------------------------

    public function students(Request $request): void
    {
        $db = Database::getInstance();
        $teacher = $this->currentTeacher($request);

        $enrollFilter = ['teacherId' => $teacher['_id']];
        if ($courseId = $request->input('course')) {
            $enrollFilter['courseId'] = new ObjectId($courseId);
        }
        if ($semester = $request->input('semester')) {
            $enrollFilter['semester'] = $semester;
        }

        $enrollments = iterator_to_array($db->enrollments->find($enrollFilter));
        $studentIds = array_values(array_unique(array_map(fn($e) => (string) $e['studentId'], $enrollments)));
        $studentObjectIds = array_map(fn($id) => new ObjectId($id), $studentIds);

        $studentFilter = ['_id' => ['$in' => $studentObjectIds]];
        if ($department = $request->input('department')) {
            $studentFilter['departmentId'] = new ObjectId($department);
        }

        $students = iterator_to_array($db->students->find($studentFilter));

        if ($search = $request->input('search')) {
            $needle = strtolower($search);
            $students = array_filter($students, function ($s) use ($needle, $db) {
                $user = $db->users->findOne(['_id' => $s['userId']]);
                return str_contains(strtolower($s['studentId']), $needle) || str_contains(strtolower($user['name'] ?? ''), $needle);
            });
        }

        $rows = [];
        foreach ($students as $s) {
            $user = $db->users->findOne(['_id' => $s['userId']]);
            $department = $s['departmentId'] ? $db->departments->findOne(['_id' => $s['departmentId']]) : null;

            $attendanceRecords = iterator_to_array($db->attendance->find(['studentId' => $s['_id']]));
            $present = count(array_filter($attendanceRecords, fn($a) => $a['status'] === 'present'));
            $attendancePercent = count($attendanceRecords) > 0 ? round(($present / count($attendanceRecords)) * 100, 1) : null;

            $latestResult = $db->results->findOne(
                array_merge(['studentId' => $s['_id'], 'teacherId' => $teacher['_id']], $courseId ? ['courseId' => new ObjectId($courseId)] : []),
                ['sort' => ['updatedAt' => -1]]
            );

            $rows[] = [
                'studentId' => $s['studentId'],
                'id' => (string) $s['_id'],
                'name' => $user['name'] ?? '—',
                'department' => $department['name'] ?? '—',
                'attendancePercent' => $attendancePercent,
                'resultStatus' => $latestResult['resultStatus'] ?? 'not_entered',
            ];
        }

        Response::success($rows);
    }

    // ---------------------------------------------------------------
    // Marks sheet (enter / edit marks)
    // ---------------------------------------------------------------

    public function marksSheet(Request $request): void
    {
        $db = Database::getInstance();
        $teacher = $this->currentTeacher($request);

        $courseId = $request->input('courseId');
        $semester = $request->input('semester');
        $year = (int) $request->input('year');

        if (!$courseId || !$semester || !$year) {
            Response::error('courseId, semester and year are required.', 422);
        }

        $course = $this->ownedCourse($request, $teacher, $courseId);

        $enrollments = iterator_to_array($db->enrollments->find([
            'courseId' => $course['_id'], 'semester' => $semester, 'year' => $year,
        ]));

        $results = iterator_to_array($db->results->find([
            'courseId' => $course['_id'], 'semester' => $semester, 'year' => $year,
        ]));
        $resultsByStudent = [];
        foreach ($results as $r) {
            $resultsByStudent[(string) $r['studentId']] = $r;
        }

        $pendingRequests = iterator_to_array($db->grade_change_requests->find([
            'resultId' => ['$in' => array_map(fn($r) => $r['_id'], $results)],
            'status' => 'pending',
        ]));
        $pendingByResult = [];
        foreach ($pendingRequests as $req) {
            $pendingByResult[(string) $req['resultId']] = $req;
        }

        $rows = [];
        foreach ($enrollments as $e) {
            $s = $db->students->findOne(['_id' => $e['studentId']]);
            if (!$s) {
                continue;
            }
            $user = $db->users->findOne(['_id' => $s['userId']]);
            $existing = $resultsByStudent[(string) $s['_id']] ?? null;
            $pendingRequest = $existing ? ($pendingByResult[(string) $existing['_id']] ?? null) : null;

            $rows[] = [
                'studentObjectId' => (string) $s['_id'],
                'studentId' => $s['studentId'],
                'studentName' => $user['name'] ?? '—',
                'resultId' => $existing ? (string) $existing['_id'] : null,
                'quizMarks' => $existing['quizMarks'] ?? null,
                'assignmentMarks' => $existing['assignmentMarks'] ?? null,
                'attendanceMarks' => $existing['attendanceMarks'] ?? null,
                'midMarks' => $existing['midMarks'] ?? null,
                'finalMarks' => $existing['finalMarks'] ?? null,
                'totalMarks' => $existing['totalMarks'] ?? null,
                'grade' => $existing['grade'] ?? null,
                'gradePoint' => $existing['gradePoint'] ?? null,
                'teacherComment' => $existing['teacherComment'] ?? '',
                'resultStatus' => $existing['resultStatus'] ?? 'not_entered',
                'changeRequest' => $pendingRequest ? [
                    'id' => (string) $pendingRequest['_id'],
                    'reason' => $pendingRequest['reason'],
                    'createdAt' => $pendingRequest['createdAt']->toDateTime()->format(DATE_ATOM),
                ] : null,
            ];
        }

        Response::success([
            'course' => ['id' => (string) $course['_id'], 'code' => $course['code'], 'name' => $course['name'], 'credit' => $course['credit']],
            'semester' => $semester,
            'year' => $year,
            'componentMax' => GradeService::COMPONENT_MAX,
            'rows' => $rows,
        ]);
    }

    public function saveMarks(Request $request): void
    {
        $db = Database::getInstance();
        $teacher = $this->currentTeacher($request);

        $courseId = $request->body['courseId'] ?? null;
        $semester = $request->body['semester'] ?? null;
        $year = isset($request->body['year']) ? (int) $request->body['year'] : null;
        $action = $request->body['action'] ?? 'draft'; // draft | submit
        $entries = $request->body['entries'] ?? [];

        if (!$courseId || !$semester || !$year || !is_array($entries) || count($entries) === 0) {
            Response::error('courseId, semester, year and at least one entry are required.', 422);
        }
        if (!in_array($action, ['draft', 'submit'], true)) {
            Response::error('Invalid action.', 422);
        }

        $course = $this->ownedCourse($request, $teacher, $courseId);

        $enrolledIds = array_map(
            fn($e) => (string) $e['studentId'],
            iterator_to_array($db->enrollments->find(['courseId' => $course['_id'], 'semester' => $semester, 'year' => $year], ['projection' => ['studentId' => 1]]))
        );

        $errors = [];
        $saved = [];
        $newResultStatus = $action === 'submit' ? 'submitted' : 'draft';

        foreach ($entries as $i => $entry) {
            $studentObjectId = $entry['studentObjectId'] ?? null;
            if (!$studentObjectId || !in_array($studentObjectId, $enrolledIds, true)) {
                Response::error('One or more students are not enrolled in this course/semester.', 403);
            }

            $components = [
                'quiz' => $entry['quizMarks'] ?? null,
                'assignment' => $entry['assignmentMarks'] ?? null,
                'attendance' => $entry['attendanceMarks'] ?? null,
                'mid' => $entry['midMarks'] ?? null,
                'final' => $entry['finalMarks'] ?? null,
            ];

            $componentErrors = GradeService::validateComponents($components);
            if ($componentErrors) {
                $errors[$studentObjectId] = $componentErrors;
                continue;
            }

            $total = GradeService::computeTotal(
                (float) $components['quiz'],
                (float) $components['assignment'],
                (float) $components['attendance'],
                (float) $components['mid'],
                (float) $components['final']
            );
            $graded = GradeService::fromMarks($total);
            $comment = trim((string) ($entry['teacherComment'] ?? ''));

            $saved[] = [
                'studentObjectId' => $studentObjectId,
                'quizMarks' => $components['quiz'],
                'assignmentMarks' => $components['assignment'],
                'attendanceMarks' => $components['attendance'],
                'midMarks' => $components['mid'],
                'finalMarks' => $components['final'],
                'totalMarks' => $total,
                'grade' => $graded['grade'],
                'gradePoint' => $graded['gradePoint'],
                'teacherComment' => $comment,
            ];
        }

        if ($errors) {
            Response::error('Please fix the marks entry errors below.', 422, $errors);
        }

        $now = new UTCDateTime();
        $studentCache = [];

        foreach ($saved as $entry) {
            $studentObjectId = new ObjectId($entry['studentObjectId']);
            $existing = $db->results->findOne(['courseId' => $course['_id'], 'studentId' => $studentObjectId, 'semester' => $semester, 'year' => $year]);

            if ($existing && $existing['resultStatus'] === 'published') {
                // Editing an already-published result: keep it visible, but every change is audited.
                $changed = (float) $existing['totalMarks'] !== $entry['totalMarks']
                    || $existing['grade'] !== $entry['grade']
                    || (string) ($existing['teacherComment'] ?? '') !== $entry['teacherComment'];

                if ($changed) {
                    GradeAuditService::record([
                        'resultId' => $existing['_id'],
                        'studentId' => $studentObjectId,
                        'courseId' => $course['_id'],
                        'previousMarks' => $existing['totalMarks'],
                        'newMarks' => $entry['totalMarks'],
                        'previousGrade' => $existing['grade'],
                        'newGrade' => $entry['grade'],
                        'previousComment' => $existing['teacherComment'] ?? null,
                        'newComment' => $entry['teacherComment'],
                        'changedByUserId' => new ObjectId($request->user['sub']),
                        'changedByRole' => 'teacher',
                        'reason' => $request->body['reason'] ?? 'Correction to a published result.',
                    ]);
                }

                $db->results->updateOne(
                    ['_id' => $existing['_id']],
                    ['$set' => [
                        'quizMarks' => $entry['quizMarks'], 'assignmentMarks' => $entry['assignmentMarks'],
                        'attendanceMarks' => $entry['attendanceMarks'], 'midMarks' => $entry['midMarks'], 'finalMarks' => $entry['finalMarks'],
                        'totalMarks' => $entry['totalMarks'], 'marks' => $entry['totalMarks'],
                        'grade' => $entry['grade'], 'gradePoint' => $entry['gradePoint'],
                        'teacherComment' => $entry['teacherComment'],
                        'status' => $entry['totalMarks'] >= 40 ? 'passed' : 'failed',
                        'lastAction' => 'updated', 'updatedAt' => $now,
                    ]]
                );
                continue;
            }

            if ($existing) {
                // Draft or submitted result being edited further.
                $changed = (float) $existing['totalMarks'] !== $entry['totalMarks']
                    || $existing['grade'] !== $entry['grade']
                    || (string) ($existing['teacherComment'] ?? '') !== $entry['teacherComment'];

                if ($changed) {
                    GradeAuditService::record([
                        'resultId' => $existing['_id'],
                        'studentId' => $studentObjectId,
                        'courseId' => $course['_id'],
                        'previousMarks' => $existing['totalMarks'],
                        'newMarks' => $entry['totalMarks'],
                        'previousGrade' => $existing['grade'],
                        'newGrade' => $entry['grade'],
                        'previousComment' => $existing['teacherComment'] ?? null,
                        'newComment' => $entry['teacherComment'],
                        'changedByUserId' => new ObjectId($request->user['sub']),
                        'changedByRole' => 'teacher',
                        'reason' => $request->body['reason'] ?? null,
                    ]);
                }

                $db->results->updateOne(
                    ['_id' => $existing['_id']],
                    ['$set' => [
                        'quizMarks' => $entry['quizMarks'], 'assignmentMarks' => $entry['assignmentMarks'],
                        'attendanceMarks' => $entry['attendanceMarks'], 'midMarks' => $entry['midMarks'], 'finalMarks' => $entry['finalMarks'],
                        'totalMarks' => $entry['totalMarks'], 'marks' => $entry['totalMarks'],
                        'grade' => $entry['grade'], 'gradePoint' => $entry['gradePoint'],
                        'teacherComment' => $entry['teacherComment'],
                        'status' => $entry['totalMarks'] >= 40 ? 'passed' : 'failed',
                        'resultStatus' => $newResultStatus,
                        'submittedAt' => $newResultStatus === 'submitted' ? $now : ($existing['submittedAt'] ?? null),
                        'lastAction' => $action === 'submit' ? 'submitted' : 'updated',
                        'updatedAt' => $now,
                    ]]
                );
                continue;
            }

            // New result.
            $studentCache[$entry['studentObjectId']] ??= $db->students->findOne(['_id' => $studentObjectId]);
            $student = $studentCache[$entry['studentObjectId']];

            $db->results->insertOne([
                '_id' => new ObjectId(),
                'studentId' => $studentObjectId,
                'courseId' => $course['_id'],
                'courseCode' => $course['code'],
                'courseName' => $course['name'],
                'teacherId' => $teacher['_id'],
                'teacherName' => $request->user['name'],
                'credit' => $course['credit'],
                'semester' => $semester,
                'year' => $year,
                'quizMarks' => $entry['quizMarks'], 'assignmentMarks' => $entry['assignmentMarks'],
                'attendanceMarks' => $entry['attendanceMarks'], 'midMarks' => $entry['midMarks'], 'finalMarks' => $entry['finalMarks'],
                'totalMarks' => $entry['totalMarks'], 'marks' => $entry['totalMarks'],
                'grade' => $entry['grade'], 'gradePoint' => $entry['gradePoint'],
                'teacherComment' => $entry['teacherComment'],
                'status' => $entry['totalMarks'] >= 40 ? 'passed' : 'failed',
                'resultStatus' => $newResultStatus,
                'lastAction' => $action === 'submit' ? 'submitted' : 'entered',
                'submittedAt' => $newResultStatus === 'submitted' ? $now : null,
                'publishedAt' => null,
                'createdAt' => $now,
                'updatedAt' => $now,
            ]);
        }

        Response::success(['saved' => count($saved)], $action === 'submit' ? 'Results submitted for review.' : 'Draft saved successfully.');
    }

    // ---------------------------------------------------------------
    // Publish workflow
    // ---------------------------------------------------------------

    public function publishPreview(Request $request): void
    {
        $db = Database::getInstance();
        $teacher = $this->currentTeacher($request);

        $courseId = $request->input('courseId');
        $semester = $request->input('semester');
        $year = (int) $request->input('year');

        if (!$courseId || !$semester || !$year) {
            Response::error('courseId, semester and year are required.', 422);
        }

        $course = $this->ownedCourse($request, $teacher, $courseId);

        $submitted = iterator_to_array($db->results->find([
            'courseId' => $course['_id'], 'semester' => $semester, 'year' => $year, 'resultStatus' => 'submitted',
        ]));
        $draftCount = $db->results->countDocuments([
            'courseId' => $course['_id'], 'semester' => $semester, 'year' => $year, 'resultStatus' => 'draft',
        ]);

        $rows = array_map(function ($r) use ($db) {
            $s = $db->students->findOne(['_id' => $r['studentId']]);
            $user = $s ? $db->users->findOne(['_id' => $s['userId']]) : null;
            return [
                'studentId' => $s['studentId'] ?? '—',
                'studentName' => $user['name'] ?? '—',
                'totalMarks' => $r['totalMarks'],
                'grade' => $r['grade'],
                'gradePoint' => $r['gradePoint'],
            ];
        }, $submitted);

        $marks = array_column($submitted, 'totalMarks');
        $gradeDistribution = array_fill_keys(GradeService::gradeLabels(), 0);
        foreach ($submitted as $r) {
            if (isset($gradeDistribution[$r['grade']])) {
                $gradeDistribution[$r['grade']]++;
            }
        }

        Response::success([
            'course' => ['code' => $course['code'], 'name' => $course['name']],
            'semester' => $semester,
            'year' => $year,
            'readyToPublish' => count($submitted),
            'stillDraft' => $draftCount,
            'classAverage' => count($marks) > 0 ? round(array_sum($marks) / count($marks), 1) : 0.0,
            'highest' => count($marks) > 0 ? max($marks) : 0,
            'lowest' => count($marks) > 0 ? min($marks) : 0,
            'avgGradePoint' => count($submitted) > 0 ? round(array_sum(array_column($submitted, 'gradePoint')) / count($submitted), 2) : 0.0,
            'gradeDistribution' => array_map(fn($grade, $count) => ['grade' => $grade, 'count' => $count], array_keys($gradeDistribution), $gradeDistribution),
            'rows' => $rows,
        ]);
    }

    public function publish(Request $request): void
    {
        $db = Database::getInstance();
        $teacher = $this->currentTeacher($request);

        $courseId = $request->body['courseId'] ?? null;
        $semester = $request->body['semester'] ?? null;
        $year = isset($request->body['year']) ? (int) $request->body['year'] : null;

        if (!$courseId || !$semester || !$year) {
            Response::error('courseId, semester and year are required.', 422);
        }

        $course = $this->ownedCourse($request, $teacher, $courseId);

        $submitted = iterator_to_array($db->results->find([
            'courseId' => $course['_id'], 'semester' => $semester, 'year' => $year, 'resultStatus' => 'submitted',
        ]));

        if (count($submitted) === 0) {
            Response::error('There are no submitted results ready to publish for this course/semester.', 400);
        }

        $now = new UTCDateTime();

        foreach ($submitted as $r) {
            $db->results->updateOne(
                ['_id' => $r['_id']],
                ['$set' => ['resultStatus' => 'published', 'publishedAt' => $now, 'updatedAt' => $now, 'lastAction' => 'published']]
            );

            $student = $db->students->findOne(['_id' => $r['studentId']]);
            if ($student) {
                NotificationService::notifyResultPublished((array) $student, (array) $r);
            }
        }

        Response::success(['publishedCount' => count($submitted)], count($submitted) . ' result(s) published successfully.');
    }

    // ---------------------------------------------------------------
    // Audit log (read-only for teachers)
    // ---------------------------------------------------------------

    public function auditLog(Request $request): void
    {
        $db = Database::getInstance();
        $teacher = $this->currentTeacher($request);

        $filter = [];
        if ($resultId = $request->input('resultId')) {
            $result = $db->results->findOne(['_id' => new ObjectId($resultId)]);
            if (!$result || (string) $result['teacherId'] !== (string) $teacher['_id']) {
                Response::error('You do not have permission to view this result history.', 403);
            }
            $filter['resultId'] = $result['_id'];
        } elseif ($courseId = $request->input('courseId')) {
            $this->ownedCourse($request, $teacher, $courseId);
            $filter['courseId'] = new ObjectId($courseId);
        } else {
            Response::error('resultId or courseId is required.', 422);
        }

        $logs = $db->grade_audit_logs->find($filter, ['sort' => ['changedAt' => -1]]);

        Response::success(array_map(function ($log) use ($db) {
            $student = $db->students->findOne(['_id' => $log['studentId']]);
            return [
                'id' => (string) $log['_id'],
                'studentId' => $student['studentId'] ?? '—',
                'previousMarks' => $log['previousMarks'],
                'newMarks' => $log['newMarks'],
                'previousGrade' => $log['previousGrade'],
                'newGrade' => $log['newGrade'],
                'previousComment' => $log['previousComment'],
                'newComment' => $log['newComment'],
                'changedByRole' => $log['changedByRole'],
                'reason' => $log['reason'],
                'changedAt' => $log['changedAt']->toDateTime()->format(DATE_ATOM),
            ];
        }, iterator_to_array($logs)));
    }

    // ---------------------------------------------------------------
    // Grade change requests
    // ---------------------------------------------------------------

    public function resolveGradeChangeRequest(Request $request): void
    {
        $db = Database::getInstance();
        $teacher = $this->currentTeacher($request);

        $status = $request->body['status'] ?? null;
        if (!in_array($status, ['resolved', 'dismissed'], true)) {
            Response::error('status must be resolved or dismissed.', 422);
        }

        try {
            $changeRequest = $db->grade_change_requests->findOne(['_id' => new ObjectId($request->params['id'])]);
        } catch (\Throwable $e) {
            Response::error('Invalid request.', 400);
        }

        if (!$changeRequest || (string) $changeRequest['teacherId'] !== (string) $teacher['_id']) {
            Response::error('Request not found.', 404);
        }
        if ($changeRequest['status'] !== 'pending') {
            Response::error('This request has already been handled.', 409);
        }

        $now = new UTCDateTime();
        $db->grade_change_requests->updateOne(
            ['_id' => $changeRequest['_id']],
            ['$set' => [
                'status' => $status,
                'resolutionNote' => trim((string) ($request->body['note'] ?? '')),
                'resolvedAt' => $now,
                'updatedAt' => $now,
            ]]
        );

        $student = $db->students->findOne(['_id' => $changeRequest['studentId']]);
        if ($student) {
            NotificationService::notify([
                'userId' => $student['userId'],
                'relatedStudentId' => $student['_id'],
                'category' => 'results',
                'title' => "Grade change request {$status} — {$changeRequest['courseCode']}",
                'description' => $status === 'resolved'
                    ? "Your request to review the {$changeRequest['courseCode']} result has been resolved."
                    : "Your request to review the {$changeRequest['courseCode']} result was reviewed and dismissed.",
            ]);
        }

        Response::success(null, 'Request updated.');
    }

    // ---------------------------------------------------------------
    // Report card
    // ---------------------------------------------------------------

    public function reportCard(Request $request): void
    {
        $db = Database::getInstance();
        $teacher = $this->currentTeacher($request);

        $studentIdParam = $request->input('studentId');
        if (!$studentIdParam) {
            Response::error('studentId is required.', 422);
        }

        $student = $db->students->findOne(['_id' => new ObjectId($studentIdParam)]);
        if (!$student) {
            Response::error('Student not found.', 404);
        }

        $isEnrolled = $db->enrollments->countDocuments(['studentId' => $student['_id'], 'teacherId' => $teacher['_id']]) > 0;
        if (!$isEnrolled) {
            Response::error('This student is not enrolled in any of your courses.', 403);
        }

        $user = $db->users->findOne(['_id' => $student['userId']]);
        $department = $student['departmentId'] ? $db->departments->findOne(['_id' => $student['departmentId']]) : null;

        $results = iterator_to_array($db->results->find(['studentId' => $student['_id'], 'resultStatus' => 'published'], ['sort' => ['year' => 1, 'semester' => 1]]));

        $semesterOrder = ['Spring' => 1, 'Summer' => 2, 'Fall' => 3];
        usort($results, fn($a, $b) => $a['year'] <=> $b['year'] ?: ($semesterOrder[$a['semester']] ?? 99) <=> ($semesterOrder[$b['semester']] ?? 99));

        $cumulative = [];
        foreach ($results as $r) {
            $cumulative[] = ['credit' => $r['credit'], 'gradePoint' => $r['gradePoint']];
        }
        $cgpa = GradeService::calculateGpa($cumulative);

        Response::success([
            'university' => ['name' => 'UniPortal University', 'address' => 'Dhaka, Bangladesh'],
            'student' => [
                'studentId' => $student['studentId'],
                'name' => $user['name'] ?? '—',
                'department' => $department['name'] ?? '—',
                'currentSemester' => $student['currentSemester'] ?? null,
            ],
            'cgpa' => $cgpa,
            'results' => array_map(function ($r) {
                return [
                    'courseCode' => $r['courseCode'],
                    'courseName' => $r['courseName'],
                    'credit' => $r['credit'],
                    'semester' => $r['semester'],
                    'year' => $r['year'],
                    'totalMarks' => $r['totalMarks'],
                    'grade' => $r['grade'],
                    'gradePoint' => $r['gradePoint'],
                    'teacherComment' => $r['teacherComment'] ?? '',
                ];
            }, $results),
        ]);
    }

    // ---------------------------------------------------------------
    // Profile
    // ---------------------------------------------------------------

    public function getProfile(Request $request): void
    {
        $db = Database::getInstance();
        $teacher = $this->currentTeacher($request);
        $user = $db->users->findOne(['_id' => $teacher['userId']]);
        $department = $teacher['departmentId'] ? $db->departments->findOne(['_id' => $teacher['departmentId']]) : null;
        $courses = iterator_to_array($db->courses->find(['teacherId' => $teacher['_id']]));

        Response::success([
            'id' => (string) $teacher['_id'],
            'teacherId' => $teacher['teacherId'] ?? '—',
            'name' => $user['name'],
            'email' => $user['email'],
            'avatarUrl' => $user['avatarUrl'] ?? null,
            'department' => $department['name'] ?? null,
            'designation' => $teacher['designation'] ?? null,
            'phone' => $teacher['phone'] ?? '',
            'officeHours' => $teacher['officeHours'] ?? '',
            'assignedCourses' => array_map(fn($c) => ['code' => $c['code'], 'name' => $c['name']], $courses),
        ]);
    }

    public function updateProfile(Request $request): void
    {
        $db = Database::getInstance();
        $teacher = $this->currentTeacher($request);

        $v = new Validator($request->body);
        $v->required('name', 'Name');
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
                'phone' => $request->body['phone'] ?? ($teacher['phone'] ?? ''),
                'officeHours' => $request->body['officeHours'] ?? ($teacher['officeHours'] ?? ''),
                'updatedAt' => new UTCDateTime(),
            ]]
        );

        Response::success(null, 'Profile updated successfully.');
    }

    public function changePassword(Request $request): void
    {
        $db = Database::getInstance();
        $teacher = $this->currentTeacher($request);

        $v = new Validator($request->body);
        $v->required('currentPassword', 'Current Password')
          ->required('newPassword', 'New Password')->minLength('newPassword', 8)
          ->required('confirmPassword', 'Confirm Password')
          ->matches('confirmPassword', 'newPassword', 'Passwords do not match.');

        if ($v->fails()) {
            Response::error('Please fix the errors below.', 422, $v->errors());
        }

        $user = $db->users->findOne(['_id' => $teacher['userId']]);

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
