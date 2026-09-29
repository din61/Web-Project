<?php

namespace App\Controllers;

use App\Config\Database;
use App\Core\Request;
use App\Core\Response;
use App\Services\GradeService;
use App\Utils\Password;
use App\Utils\Validator;
use MongoDB\BSON\ObjectId;
use MongoDB\BSON\UTCDateTime;

/**
 * Every method here is strictly read-only with respect to academic data —
 * parents can view but never modify marks, grades, comments, attendance,
 * courses, or the student's academic profile. The only writes in this
 * controller are to the parent's own account (profile fields, password).
 */
class ParentController
{
    /** Total credits required to complete the degree — kept in sync with the frontend's credit-progress chart. */
    private const TOTAL_REQUIRED_CREDITS = 160;

    private function currentParent(Request $request): array
    {
        $db = Database::getInstance();
        $parent = $db->parents->findOne(['userId' => new ObjectId($request->user['sub'])]);

        if (!$parent) {
            Response::error('Parent profile not found.', 404);
        }

        return (array) $parent;
    }

    /**
     * Resolves the student a request is asking about and verifies the
     * current parent is actually linked to them. This is the enforcement
     * point for "Parent A must never access Student B's data" — it runs on
     * every endpoint below, never trusting a studentId passed from the
     * frontend without checking it against parents.studentIds first.
     */
    private function resolveStudent(Request $request, array $parent): array
    {
        $db = Database::getInstance();
        $studentIds = array_map(fn($id) => (string) $id, (array) ($parent['studentIds'] ?? []));

        if (count($studentIds) === 0) {
            Response::error('No student is linked to this parent account.', 404);
        }

        $requested = $request->input('studentId');
        $targetId = $requested ?: $studentIds[0];

        if (!in_array($targetId, $studentIds, true)) {
            Response::error('You do not have permission to view this student.', 403);
        }

        try {
            $student = $db->students->findOne(['_id' => new ObjectId($targetId)]);
        } catch (\Throwable $e) {
            Response::error('Invalid student.', 400);
        }

        if (!$student) {
            Response::error('Student not found.', 404);
        }

        return (array) $student;
    }

    public function children(Request $request): void
    {
        $db = Database::getInstance();
        $parent = $this->currentParent($request);

        $studentIds = (array) ($parent['studentIds'] ?? []);
        $students = iterator_to_array($db->students->find(['_id' => ['$in' => $studentIds]]));

        Response::success(array_map(function ($s) use ($db) {
            $user = $db->users->findOne(['_id' => $s['userId']]);
            $department = $s['departmentId'] ? $db->departments->findOne(['_id' => $s['departmentId']]) : null;
            return [
                'id' => (string) $s['_id'],
                'studentId' => $s['studentId'],
                'name' => $user['name'] ?? '—',
                'avatarUrl' => $user['avatarUrl'] ?? null,
                'department' => $department['name'] ?? null,
                'currentSemester' => $s['currentSemester'] ?? null,
            ];
        }, $students));
    }

    public function dashboard(Request $request): void
    {
        $db = Database::getInstance();
        $parent = $this->currentParent($request);
        $student = $this->resolveStudent($request, $parent);

        $allResults = iterator_to_array($db->results->find(['studentId' => $student['_id'], 'resultStatus' => 'published']));

        $semesterOrder = ['Spring' => 1, 'Summer' => 2, 'Fall' => 3];
        $semesterGroups = [];
        foreach ($allResults as $r) {
            $key = $r['semester'] . ' ' . $r['year'];
            $semesterGroups[$key]['label'] = $key;
            $semesterGroups[$key]['year'] = $r['year'];
            $semesterGroups[$key]['order'] = $semesterOrder[$r['semester']] ?? 99;
            $semesterGroups[$key]['rows'][] = $r;
        }
        uasort($semesterGroups, fn($a, $b) => $a['year'] <=> $b['year'] ?: $a['order'] <=> $b['order']);

        $cgpaTrend = [];
        $sgpaTrend = [];
        $completedCredits = 0.0;
        $passedCourses = 0;
        $cumulative = [];

        foreach ($semesterGroups as $group) {
            $rows = $group['rows'];
            $semRows = array_map(fn($r) => ['credit' => $r['credit'], 'gradePoint' => $r['gradePoint']], $rows);
            $sgpa = GradeService::calculateGpa($semRows);
            $cumulative = array_merge($cumulative, $semRows);
            $cgpa = GradeService::calculateGpa($cumulative);

            $sgpaTrend[] = ['semester' => $group['label'], 'sgpa' => $sgpa];
            $cgpaTrend[] = ['semester' => $group['label'], 'cgpa' => $cgpa];

            foreach ($rows as $r) {
                if ($r['status'] === 'passed') {
                    $completedCredits += $r['credit'];
                    $passedCourses++;
                }
            }
        }

        $currentCgpa = count($cgpaTrend) > 0 ? end($cgpaTrend)['cgpa'] : 0.0;
        $previousCgpa = count($cgpaTrend) > 1 ? $cgpaTrend[count($cgpaTrend) - 2]['cgpa'] : null;
        $currentSgpa = count($sgpaTrend) > 0 ? end($sgpaTrend)['sgpa'] : 0.0;

        $attendanceRecords = iterator_to_array($db->attendance->find(['studentId' => $student['_id']]));
        $present = count(array_filter($attendanceRecords, fn($a) => $a['status'] === 'present'));
        $attendancePercent = count($attendanceRecords) > 0 ? round(($present / count($attendanceRecords)) * 100, 1) : 0.0;

        Response::success([
            'student' => [
                'id' => (string) $student['_id'],
                'studentId' => $student['studentId'],
                'currentSemester' => $student['currentSemester'] ?? null,
            ],
            'currentCgpa' => $currentCgpa,
            'previousCgpa' => $previousCgpa,
            'currentSgpa' => $currentSgpa,
            'completedCredits' => $completedCredits,
            'totalRequiredCredits' => self::TOTAL_REQUIRED_CREDITS,
            'remainingCredits' => max(self::TOTAL_REQUIRED_CREDITS - $completedCredits, 0),
            'passedCourses' => $passedCourses,
            'attendancePercent' => $attendancePercent,
            'cgpaTrend' => $cgpaTrend,
            'sgpaTrend' => $sgpaTrend,
        ]);
    }

    public function results(Request $request): void
    {
        $db = Database::getInstance();
        $parent = $this->currentParent($request);
        $student = $this->resolveStudent($request, $parent);

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

        $results = $db->results->find($filter, ['sort' => ['year' => -1, 'semester' => -1]]);

        Response::success(array_map(function ($r) {
            return [
                'id' => (string) $r['_id'],
                'courseCode' => $r['courseCode'],
                'courseName' => $r['courseName'],
                'credit' => $r['credit'],
                'grade' => $r['grade'],
                'gradePoint' => $r['gradePoint'],
                'teacherComment' => $r['teacherComment'] ?? '',
                'semester' => $r['semester'],
                'year' => $r['year'],
                'status' => $r['status'],
            ];
        }, iterator_to_array($results)));
    }

    public function academicHistory(Request $request): void
    {
        $db = Database::getInstance();
        $parent = $this->currentParent($request);
        $student = $this->resolveStudent($request, $parent);

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
        $parent = $this->currentParent($request);
        $student = $this->resolveStudent($request, $parent);

        $records = iterator_to_array($db->attendance->find(['studentId' => $student['_id']], ['sort' => ['date' => -1]]));

        $present = count(array_filter($records, fn($a) => $a['status'] === 'present'));
        $total = count($records);

        $monthly = [];
        foreach ($records as $a) {
            $month = $a['date']->toDateTime()->format('Y-m');
            $monthly[$month]['month'] = $month;
            $monthly[$month]['present'] = ($monthly[$month]['present'] ?? 0) + ($a['status'] === 'present' ? 1 : 0);
            $monthly[$month]['total'] = ($monthly[$month]['total'] ?? 0) + 1;
        }
        ksort($monthly);
        $monthlyPercent = array_values(array_map(function ($m) {
            return ['month' => $m['month'], 'percent' => round(($m['present'] / $m['total']) * 100, 1)];
        }, $monthly));

        $bySemester = [];
        foreach ($records as $a) {
            $sem = $a['semester'] ?? 'Unspecified';
            $bySemester[$sem]['semester'] = $sem;
            $bySemester[$sem]['present'] = ($bySemester[$sem]['present'] ?? 0) + ($a['status'] === 'present' ? 1 : 0);
            $bySemester[$sem]['total'] = ($bySemester[$sem]['total'] ?? 0) + 1;
        }
        $semesterPercent = array_values(array_map(function ($s) {
            return ['semester' => $s['semester'], 'percent' => round(($s['present'] / $s['total']) * 100, 1)];
        }, $bySemester));

        $absences = array_values(array_map(function ($a) {
            return [
                'courseCode' => $a['courseCode'],
                'courseName' => $a['courseName'],
                'date' => $a['date']->toDateTime()->format('Y-m-d'),
            ];
        }, array_filter($records, fn($a) => $a['status'] === 'absent')));

        Response::success([
            'overallPercent' => $total > 0 ? round(($present / $total) * 100, 1) : 0.0,
            'monthly' => $monthlyPercent,
            'bySemester' => $semesterPercent,
            'absences' => $absences,
        ]);
    }

    public function reportCard(Request $request): void
    {
        $db = Database::getInstance();
        $parent = $this->currentParent($request);
        $student = $this->resolveStudent($request, $parent);

        $user = $db->users->findOne(['_id' => $student['userId']]);
        $department = $student['departmentId'] ? $db->departments->findOne(['_id' => $student['departmentId']]) : null;

        $results = iterator_to_array($db->results->find(['studentId' => $student['_id'], 'resultStatus' => 'published']));

        $semesterOrder = ['Spring' => 1, 'Summer' => 2, 'Fall' => 3];
        usort($results, fn($a, $b) => $a['year'] <=> $b['year'] ?: ($semesterOrder[$a['semester']] ?? 99) <=> ($semesterOrder[$b['semester']] ?? 99));

        $cumulative = [];
        foreach ($results as $r) {
            $cumulative[] = ['credit' => $r['credit'], 'gradePoint' => $r['gradePoint']];
        }
        $cgpa = GradeService::calculateGpa($cumulative);

        $attendanceRecords = iterator_to_array($db->attendance->find(['studentId' => $student['_id']]));
        $present = count(array_filter($attendanceRecords, fn($a) => $a['status'] === 'present'));
        $attendancePercent = count($attendanceRecords) > 0 ? round(($present / count($attendanceRecords)) * 100, 1) : 0.0;

        Response::success([
            'university' => ['name' => 'UniPortal University', 'address' => 'Dhaka, Bangladesh'],
            'student' => [
                'studentId' => $student['studentId'],
                'name' => $user['name'] ?? '—',
                'department' => $department['name'] ?? '—',
                'currentSemester' => $student['currentSemester'] ?? null,
            ],
            'cgpa' => $cgpa,
            'attendancePercent' => $attendancePercent,
            'results' => array_map(function ($r) {
                return [
                    'courseCode' => $r['courseCode'],
                    'courseName' => $r['courseName'],
                    'credit' => $r['credit'],
                    'semester' => $r['semester'],
                    'year' => $r['year'],
                    'totalMarks' => $r['totalMarks'] ?? $r['marks'] ?? null,
                    'grade' => $r['grade'],
                    'gradePoint' => $r['gradePoint'],
                    'teacherComment' => $r['teacherComment'] ?? '',
                ];
            }, $results),
        ]);
    }

    public function getProfile(Request $request): void
    {
        $db = Database::getInstance();
        $parent = $this->currentParent($request);
        $user = $db->users->findOne(['_id' => $parent['userId']]);

        $children = iterator_to_array($db->students->find(['_id' => ['$in' => $parent['studentIds'] ?? []]]));
        $childInfo = array_map(function ($s) use ($db) {
            $childUser = $db->users->findOne(['_id' => $s['userId']]);
            return ['studentId' => $s['studentId'], 'name' => $childUser['name'] ?? '—'];
        }, $children);

        Response::success([
            'id' => (string) $parent['_id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'avatarUrl' => $user['avatarUrl'] ?? null,
            'phone' => $parent['phone'] ?? '',
            'address' => $parent['address'] ?? '',
            'children' => $childInfo,
        ]);
    }

    public function updateProfile(Request $request): void
    {
        $db = Database::getInstance();
        $parent = $this->currentParent($request);

        $v = new Validator($request->body);
        $v->required('name', 'Name');
        if ($v->fails()) {
            Response::error('Please fix the errors below.', 422, $v->errors());
        }

        $db->users->updateOne(
            ['_id' => $parent['userId']],
            ['$set' => ['name' => $request->body['name'], 'updatedAt' => new UTCDateTime()]]
        );

        $db->parents->updateOne(
            ['_id' => $parent['_id']],
            ['$set' => [
                'phone' => $request->body['phone'] ?? ($parent['phone'] ?? ''),
                'address' => $request->body['address'] ?? ($parent['address'] ?? ''),
                'updatedAt' => new UTCDateTime(),
            ]]
        );

        Response::success(null, 'Profile updated successfully.');
    }

    public function changePassword(Request $request): void
    {
        $db = Database::getInstance();
        $parent = $this->currentParent($request);

        $v = new Validator($request->body);
        $v->required('currentPassword', 'Current Password')
          ->required('newPassword', 'New Password')->minLength('newPassword', 8)
          ->required('confirmPassword', 'Confirm Password')
          ->matches('confirmPassword', 'newPassword', 'Passwords do not match.');

        if ($v->fails()) {
            Response::error('Please fix the errors below.', 422, $v->errors());
        }

        $user = $db->users->findOne(['_id' => $parent['userId']]);

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
