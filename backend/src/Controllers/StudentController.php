<?php

namespace App\Controllers;

use App\Config\Database;
use App\Core\Request;
use App\Core\Response;
use App\Services\GradeService;
use App\Services\NotificationService;
use App\Utils\Password;
use App\Utils\Validator;
use MongoDB\BSON\ObjectId;
use MongoDB\BSON\UTCDateTime;

class StudentController
{
    private function currentStudent(Request $request): array
    {
        $db = Database::getInstance();
        $student = $db->students->findOne(['userId' => new ObjectId($request->user['sub'])]);

        if (!$student) {
            Response::error('Student profile not found.', 404);
        }

        return (array) $student;
    }

    public function dashboard(Request $request): void
    {
        $db = Database::getInstance();
        $student = $this->currentStudent($request);

        $allResults = iterator_to_array($db->results->find(['studentId' => $student['_id'], 'resultStatus' => 'published']));

        $semesterGroups = [];
        foreach ($allResults as $r) {
            $key = $r['semester'] . ' ' . $r['year'];
            $semesterGroups[$key]['label'] = $key;
            $semesterGroups[$key]['year'] = $r['year'];
            $semesterGroups[$key]['order'] = ['Spring' => 1, 'Summer' => 2, 'Fall' => 3][$r['semester']] ?? 99;
            $semesterGroups[$key]['rows'][] = $r;
        }
        uasort($semesterGroups, fn($a, $b) => $a['year'] <=> $b['year'] ?: $a['order'] <=> $b['order']);

        $sgpaTrend = [];
        $completedCredits = 0.0;
        $allForCgpa = [];

        foreach ($semesterGroups as $group) {
            $rows = $group['rows'];
            $semRows = array_map(fn($r) => ['credit' => $r['credit'], 'gradePoint' => $r['gradePoint']], $rows);
            $sgpa = GradeService::calculateGpa($semRows);
            $sgpaTrend[] = ['semester' => $group['label'], 'sgpa' => $sgpa];
            foreach ($rows as $r) {
                if ($r['status'] === 'passed') {
                    $completedCredits += $r['credit'];
                }
            }
            $allForCgpa = array_merge($allForCgpa, $semRows);
        }

        $cgpa = GradeService::calculateGpa($allForCgpa);

        $attendanceRecords = iterator_to_array($db->attendance->find(['studentId' => $student['_id']]));
        $presentCount = count(array_filter($attendanceRecords, fn($a) => $a['status'] === 'present'));
        $attendancePercent = count($attendanceRecords) > 0
            ? round(($presentCount / count($attendanceRecords)) * 100, 1)
            : 0.0;

        $recentResults = $db->results->find(
            ['studentId' => $student['_id'], 'resultStatus' => 'published'],
            ['sort' => ['publishedAt' => -1], 'limit' => 5]
        );

        $notifications = $db->notifications->find(
            ['$or' => [['userId' => $student['userId']], ['audience' => 'student']]],
            ['sort' => ['createdAt' => -1], 'limit' => 5]
        );

        Response::success([
            'cgpa' => $cgpa,
            'completedCredits' => $completedCredits,
            'currentSemester' => $student['currentSemester'] ?? null,
            'attendancePercent' => $attendancePercent,
            'sgpaTrend' => array_values($sgpaTrend),
            'recentResults' => array_map([$this, 'formatResult'], iterator_to_array($recentResults)),
            'announcements' => array_map([$this, 'formatNotification'], iterator_to_array($notifications)),
        ]);
    }

    public function results(Request $request): void
    {
        $db = Database::getInstance();
        $student = $this->currentStudent($request);

        $filter = ['studentId' => $student['_id'], 'resultStatus' => 'published'];

        if ($semester = $request->input('semester')) {
            $filter['semester'] = $semester;
        }
        if ($year = $request->input('year')) {
            $filter['year'] = (int) $year;
        }
        if ($search = $request->input('search')) {
            $filter['$or'] = [
                ['courseName' => ['$regex' => $search, '$options' => 'i']],
                ['courseCode' => ['$regex' => $search, '$options' => 'i']],
            ];
        }

        $results = iterator_to_array($db->results->find($filter, ['sort' => ['year' => -1, 'semester' => -1]]));

        $pending = iterator_to_array($db->grade_change_requests->find([
            'resultId' => ['$in' => array_map(fn($r) => $r['_id'], $results)],
            'status' => 'pending',
        ]));
        $pendingResultIds = array_map(fn($p) => (string) $p['resultId'], $pending);

        Response::success(array_map(function ($r) use ($pendingResultIds) {
            $formatted = $this->formatResult($r);
            $formatted['hasPendingChangeRequest'] = in_array($formatted['id'], $pendingResultIds, true);
            return $formatted;
        }, $results));
    }

    public function academicHistory(Request $request): void
    {
        $db = Database::getInstance();
        $student = $this->currentStudent($request);

        $allResults = iterator_to_array($db->results->find(['studentId' => $student['_id'], 'resultStatus' => 'published']));

        $bySemester = [];
        foreach ($allResults as $r) {
            $key = $r['semester'] . '|' . $r['year'];
            $bySemester[$key]['semester'] = $r['semester'];
            $bySemester[$key]['year'] = $r['year'];
            $bySemester[$key]['rows'][] = $r;
        }

        $semesterOrder = ['Spring' => 1, 'Summer' => 2, 'Fall' => 3];
        uasort($bySemester, function ($a, $b) use ($semesterOrder) {
            return $a['year'] <=> $b['year']
                ?: ($semesterOrder[$a['semester']] ?? 99) <=> ($semesterOrder[$b['semester']] ?? 99);
        });

        $timeline = [];
        $cumulative = [];
        foreach ($bySemester as $group) {
            $semRows = array_map(fn($r) => ['credit' => $r['credit'], 'gradePoint' => $r['gradePoint']], $group['rows']);
            $sgpa = GradeService::calculateGpa($semRows);
            $credits = array_sum(array_column($semRows, 'credit'));
            $cumulative = array_merge($cumulative, $semRows);
            $cgpa = GradeService::calculateGpa($cumulative);

            $timeline[] = [
                'semester' => $group['semester'],
                'year' => $group['year'],
                'credits' => $credits,
                'sgpa' => $sgpa,
                'cgpa' => $cgpa,
            ];
        }

        Response::success(['timeline' => $timeline]);
    }

    public function attendance(Request $request): void
    {
        $db = Database::getInstance();
        $student = $this->currentStudent($request);

        $filter = ['studentId' => $student['_id']];
        if ($semester = $request->input('semester')) {
            $filter['semester'] = $semester;
        }

        $records = iterator_to_array($db->attendance->find($filter, ['sort' => ['date' => -1]]));

        $present = count(array_filter($records, fn($a) => $a['status'] === 'present'));
        $total = count($records);

        Response::success([
            'summary' => [
                'total' => $total,
                'present' => $present,
                'absent' => count(array_filter($records, fn($a) => $a['status'] === 'absent')),
                'late' => count(array_filter($records, fn($a) => $a['status'] === 'late')),
                'percent' => $total > 0 ? round(($present / $total) * 100, 1) : 0.0,
            ],
            'records' => array_map(function ($a) {
                return [
                    'id' => (string) $a['_id'],
                    'courseCode' => $a['courseCode'],
                    'courseName' => $a['courseName'],
                    'date' => $a['date']->toDateTime()->format('Y-m-d'),
                    'status' => $a['status'],
                ];
            }, $records),
        ]);
    }

    public function getProfile(Request $request): void
    {
        $db = Database::getInstance();
        $student = $this->currentStudent($request);
        $user = $db->users->findOne(['_id' => $student['userId']]);
        $department = $student['departmentId']
            ? $db->departments->findOne(['_id' => $student['departmentId']])
            : null;

        Response::success([
            'id' => (string) $student['_id'],
            'studentId' => $student['studentId'],
            'name' => $user['name'],
            'email' => $user['email'],
            'avatarUrl' => $user['avatarUrl'] ?? null,
            'department' => $department['name'] ?? null,
            'currentSemester' => $student['currentSemester'] ?? null,
            'phone' => $student['phone'] ?? '',
            'address' => $student['address'] ?? '',
            'dateOfBirth' => $student['dateOfBirth'] ?? '',
        ]);
    }

    public function updateProfile(Request $request): void
    {
        $db = Database::getInstance();
        $student = $this->currentStudent($request);

        $v = new Validator($request->body);
        $v->required('name', 'Name');
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
                'phone' => $request->body['phone'] ?? ($student['phone'] ?? ''),
                'address' => $request->body['address'] ?? ($student['address'] ?? ''),
                'updatedAt' => new UTCDateTime(),
            ]]
        );

        Response::success(null, 'Profile updated successfully.');
    }

    public function changePassword(Request $request): void
    {
        $db = Database::getInstance();
        $student = $this->currentStudent($request);

        $v = new Validator($request->body);
        $v->required('currentPassword', 'Current Password')
          ->required('newPassword', 'New Password')->minLength('newPassword', 8)
          ->required('confirmPassword', 'Confirm Password')
          ->matches('confirmPassword', 'newPassword', 'Passwords do not match.');

        if ($v->fails()) {
            Response::error('Please fix the errors below.', 422, $v->errors());
        }

        $user = $db->users->findOne(['_id' => $student['userId']]);

        if (!Password::verify($request->body['currentPassword'], $user['passwordHash'])) {
            Response::error('Current password is incorrect.', 401);
        }

        $db->users->updateOne(
            ['_id' => $user['_id']],
            ['$set' => ['passwordHash' => Password::hash($request->body['newPassword']), 'updatedAt' => new UTCDateTime()]]
        );

        Response::success(null, 'Password changed successfully.');
    }

    // ---------------------------------------------------------------
    // Grade change requests
    // ---------------------------------------------------------------

    public function gradeChangeRequests(Request $request): void
    {
        $db = Database::getInstance();
        $student = $this->currentStudent($request);

        $requests = $db->grade_change_requests->find(
            ['studentId' => $student['_id']],
            ['sort' => ['createdAt' => -1]]
        );

        Response::success(array_map([$this, 'formatChangeRequest'], iterator_to_array($requests)));
    }

    public function requestGradeChange(Request $request): void
    {
        $db = Database::getInstance();
        $student = $this->currentStudent($request);

        $v = new Validator($request->body);
        $v->required('resultId', 'Result')
          ->required('reason', 'Reason')->minLength('reason', 10);
        if ($v->fails()) {
            Response::error('Please fix the errors below.', 422, $v->errors());
        }

        try {
            $result = $db->results->findOne(['_id' => new ObjectId($request->body['resultId'])]);
        } catch (\Throwable $e) {
            Response::error('Invalid result.', 400);
        }

        if (!$result || (string) $result['studentId'] !== (string) $student['_id']) {
            Response::error('Result not found.', 404);
        }
        if ($result['resultStatus'] !== 'published') {
            Response::error('Only published results can be disputed.', 422);
        }

        $existingPending = $db->grade_change_requests->findOne([
            'resultId' => $result['_id'],
            'status' => 'pending',
        ]);
        if ($existingPending) {
            Response::error('You already have a pending request for this result.', 409);
        }

        $now = new UTCDateTime();

        $db->grade_change_requests->insertOne([
            '_id' => new ObjectId(),
            'resultId' => $result['_id'],
            'studentId' => $student['_id'],
            'studentIdCode' => $student['studentId'],
            'teacherId' => $result['teacherId'],
            'courseId' => $result['courseId'],
            'courseCode' => $result['courseCode'],
            'courseName' => $result['courseName'],
            'currentMarks' => $result['totalMarks'] ?? $result['marks'] ?? null,
            'currentGrade' => $result['grade'],
            'reason' => trim($request->body['reason']),
            'status' => 'pending',
            'resolutionNote' => null,
            'resolvedAt' => null,
            'createdAt' => $now,
            'updatedAt' => $now,
        ]);

        $user = $db->users->findOne(['_id' => $student['userId']]);
        $teacher = $db->teachers->findOne(['_id' => $result['teacherId']]);
        if ($teacher) {
            NotificationService::notify([
                'userId' => $teacher['userId'],
                'relatedStudentId' => $student['_id'],
                'category' => 'results',
                'title' => "Grade change requested — {$result['courseCode']}",
                'description' => ($user['name'] ?? 'A student') . " has requested a review of their {$result['courseCode']} result.",
            ]);
        }

        Response::success(null, 'Your request has been sent to the teacher.');
    }

    private function formatChangeRequest($r): array
    {
        return [
            'id' => (string) $r['_id'],
            'resultId' => (string) $r['resultId'],
            'courseCode' => $r['courseCode'],
            'courseName' => $r['courseName'],
            'currentMarks' => $r['currentMarks'],
            'currentGrade' => $r['currentGrade'],
            'reason' => $r['reason'],
            'status' => $r['status'],
            'resolutionNote' => $r['resolutionNote'] ?? null,
            'createdAt' => $r['createdAt']->toDateTime()->format(DATE_ATOM),
            'resolvedAt' => isset($r['resolvedAt']) && $r['resolvedAt'] ? $r['resolvedAt']->toDateTime()->format(DATE_ATOM) : null,
        ];
    }

    private function formatResult($r): array
    {
        return [
            'id' => (string) $r['_id'],
            'courseCode' => $r['courseCode'],
            'courseName' => $r['courseName'],
            'teacher' => $r['teacherName'],
            'credit' => $r['credit'],
            'marks' => [
                'quiz' => $r['quizMarks'] ?? null,
                'assignment' => $r['assignmentMarks'] ?? null,
                'attendance' => $r['attendanceMarks'] ?? null,
                'mid' => $r['midMarks'] ?? null,
                'final' => $r['finalMarks'] ?? null,
                'total' => $r['totalMarks'] ?? $r['marks'] ?? null,
            ],
            'grade' => $r['grade'],
            'gradePoint' => $r['gradePoint'],
            'teacherComment' => $r['teacherComment'] ?? null,
            'semester' => $r['semester'],
            'year' => $r['year'],
            'status' => $r['status'],
            'publishedAt' => isset($r['publishedAt']) ? $r['publishedAt']->toDateTime()->format(DATE_ATOM) : null,
        ];
    }

    private function formatNotification($n): array
    {
        return [
            'id' => (string) $n['_id'],
            'category' => $n['category'],
            'title' => $n['title'],
            'description' => $n['description'],
            'createdAt' => $n['createdAt']->toDateTime()->format(DATE_ATOM),
            'isRead' => $n['isRead'] ?? false,
        ];
    }
}
