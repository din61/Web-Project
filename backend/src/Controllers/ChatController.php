<?php

namespace App\Controllers;

use App\Config\Database;
use App\Core\Request;
use App\Core\Response;
use App\Utils\Validator;
use MongoDB\BSON\ObjectId;
use MongoDB\BSON\UTCDateTime;

/**
 * Direct-message chat between a student and a teacher. One conversation per
 * (studentId, teacherId) pair — not scoped to a single course, since a
 * student may want to message a teacher about anything. Shared by both
 * roles: every method branches on $request->user['role'] rather than
 * duplicating near-identical student/teacher controllers.
 */
class ChatController
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

    private function currentTeacher(Request $request): array
    {
        $db = Database::getInstance();
        $teacher = $db->teachers->findOne(['userId' => new ObjectId($request->user['sub'])]);
        if (!$teacher) {
            Response::error('Teacher profile not found.', 404);
        }
        return (array) $teacher;
    }

    /** Loads the conversation and verifies the current user is one of its two participants. */
    private function ownedConversation(Request $request, string $id): array
    {
        $db = Database::getInstance();

        try {
            $conversation = $db->conversations->findOne(['_id' => new ObjectId($id)]);
        } catch (\Throwable $e) {
            Response::error('Invalid conversation.', 400);
        }

        if (!$conversation) {
            Response::error('Conversation not found.', 404);
        }

        $role = $request->user['role'];
        $userId = $request->user['sub'];
        $belongs = ($role === 'student' && (string) $conversation['studentUserId'] === $userId)
            || ($role === 'teacher' && (string) $conversation['teacherUserId'] === $userId);

        if (!$belongs) {
            Response::error('You do not have permission to access this conversation.', 403);
        }

        return (array) $conversation;
    }

    // ---------------------------------------------------------------
    // Contacts — who the current user is allowed to start a chat with
    // ---------------------------------------------------------------

    public function contacts(Request $request): void
    {
        $db = Database::getInstance();
        $role = $request->user['role'];

        if ($role === 'student') {
            $student = $this->currentStudent($request);
            $teacherIds = $db->enrollments->distinct('teacherId', ['studentId' => $student['_id']]);
            $teachers = iterator_to_array($db->teachers->find(['_id' => ['$in' => $teacherIds]]));

            $rows = array_map(function ($t) use ($db) {
                $user = $db->users->findOne(['_id' => $t['userId']]);
                return [
                    'id' => (string) $t['_id'],
                    'name' => $user['name'] ?? '—',
                    'avatarUrl' => $user['avatarUrl'] ?? null,
                    'subtitle' => $t['designation'] ?? 'Teacher',
                ];
            }, $teachers);
        } elseif ($role === 'teacher') {
            $teacher = $this->currentTeacher($request);
            $studentIds = $db->enrollments->distinct('studentId', ['teacherId' => $teacher['_id']]);
            $students = iterator_to_array($db->students->find(['_id' => ['$in' => $studentIds]]));

            $rows = array_map(function ($s) use ($db) {
                $user = $db->users->findOne(['_id' => $s['userId']]);
                return [
                    'id' => (string) $s['_id'],
                    'name' => $user['name'] ?? '—',
                    'avatarUrl' => $user['avatarUrl'] ?? null,
                    'subtitle' => $s['studentId'] ?? 'Student',
                ];
            }, $students);
        } else {
            Response::error('Chat is only available to students and teachers.', 403);
        }

        usort($rows, fn($a, $b) => strcasecmp($a['name'], $b['name']));
        Response::success(array_values($rows));
    }

    // ---------------------------------------------------------------
    // Conversations
    // ---------------------------------------------------------------

    public function conversations(Request $request): void
    {
        $db = Database::getInstance();
        $role = $request->user['role'];
        $userId = $request->user['sub'];

        if (!in_array($role, ['student', 'teacher'], true)) {
            Response::error('Chat is only available to students and teachers.', 403);
        }

        $filter = $role === 'student' ? ['studentUserId' => new ObjectId($userId)] : ['teacherUserId' => new ObjectId($userId)];
        $conversations = $db->conversations->find($filter, ['sort' => ['lastMessageAt' => -1]]);

        Response::success(array_map(fn($c) => $this->formatConversation($c, $role), iterator_to_array($conversations)));
    }

    public function startConversation(Request $request): void
    {
        $db = Database::getInstance();
        $role = $request->user['role'];

        $v = new Validator($request->body);
        $v->required('contactId', 'Contact');
        if ($v->fails()) {
            Response::error('Please fix the errors below.', 422, $v->errors());
        }

        try {
            $contactId = new ObjectId($request->body['contactId']);
        } catch (\Throwable $e) {
            Response::error('Invalid contact.', 400);
        }

        if ($role === 'student') {
            $student = $this->currentStudent($request);
            $isReachable = $db->enrollments->countDocuments(['studentId' => $student['_id'], 'teacherId' => $contactId]) > 0;
            if (!$isReachable) {
                Response::error('You can only message teachers of courses you are enrolled in.', 403);
            }
            $teacher = $db->teachers->findOne(['_id' => $contactId]);
            if (!$teacher) {
                Response::error('Teacher not found.', 404);
            }
            $conversation = $this->findOrCreateConversation($student, (array) $teacher);
        } elseif ($role === 'teacher') {
            $teacher = $this->currentTeacher($request);
            $isReachable = $db->enrollments->countDocuments(['teacherId' => $teacher['_id'], 'studentId' => $contactId]) > 0;
            if (!$isReachable) {
                Response::error('You can only message students enrolled in your courses.', 403);
            }
            $student = $db->students->findOne(['_id' => $contactId]);
            if (!$student) {
                Response::error('Student not found.', 404);
            }
            $conversation = $this->findOrCreateConversation((array) $student, $teacher);
        } else {
            Response::error('Chat is only available to students and teachers.', 403);
        }

        Response::success($this->formatConversation($conversation, $role));
    }

    private function findOrCreateConversation(array $student, array $teacher): array
    {
        $db = Database::getInstance();

        $existing = $db->conversations->findOne(['studentId' => $student['_id'], 'teacherId' => $teacher['_id']]);
        if ($existing) {
            return (array) $existing;
        }

        $studentUser = $db->users->findOne(['_id' => $student['userId']]);
        $teacherUser = $db->users->findOne(['_id' => $teacher['userId']]);
        $now = new UTCDateTime();

        $doc = [
            '_id' => new ObjectId(),
            'studentId' => $student['_id'],
            'studentUserId' => $student['userId'],
            'studentName' => $studentUser['name'] ?? '—',
            'studentAvatarUrl' => $studentUser['avatarUrl'] ?? null,
            'teacherId' => $teacher['_id'],
            'teacherUserId' => $teacher['userId'],
            'teacherName' => $teacherUser['name'] ?? '—',
            'teacherAvatarUrl' => $teacherUser['avatarUrl'] ?? null,
            'lastMessageText' => null,
            'lastMessageAt' => null,
            'lastSenderRole' => null,
            'studentUnreadCount' => 0,
            'teacherUnreadCount' => 0,
            'createdAt' => $now,
            'updatedAt' => $now,
        ];
        $db->conversations->insertOne($doc);

        return $doc;
    }

    // ---------------------------------------------------------------
    // Messages
    // ---------------------------------------------------------------

    public function messages(Request $request): void
    {
        $db = Database::getInstance();
        $conversation = $this->ownedConversation($request, $request->params['id']);
        $role = $request->user['role'];

        $filter = ['conversationId' => $conversation['_id']];
        if ($after = $request->input('after')) {
            try {
                $filter['createdAt'] = ['$gt' => new UTCDateTime((int) $after * 1000)];
            } catch (\Throwable $e) {
                // Ignore a malformed `after` — just return the full history.
            }
        }

        $messages = iterator_to_array($db->messages->find($filter, ['sort' => ['createdAt' => 1], 'limit' => 500]));

        // Mark the other party's messages as read, and clear this user's unread counter.
        $otherRole = $role === 'student' ? 'teacher' : 'student';
        $db->messages->updateMany(
            ['conversationId' => $conversation['_id'], 'senderRole' => $otherRole, 'readAt' => null],
            ['$set' => ['readAt' => new UTCDateTime()]]
        );
        $db->conversations->updateOne(
            ['_id' => $conversation['_id']],
            ['$set' => [$role . 'UnreadCount' => 0]]
        );
        $conversation[$role . 'UnreadCount'] = 0;

        Response::success([
            'conversation' => $this->formatConversation($conversation, $role),
            'messages' => array_map([$this, 'formatMessage'], $messages),
        ]);
    }

    public function sendMessage(Request $request): void
    {
        $db = Database::getInstance();
        $conversation = $this->ownedConversation($request, $request->params['id']);
        $role = $request->user['role'];

        $v = new Validator($request->body);
        $v->required('text', 'Message')->minLength('text', 1);
        if ($v->fails()) {
            Response::error('Please fix the errors below.', 422, $v->errors());
        }

        $text = trim((string) $request->body['text']);
        if ($text === '') {
            Response::error('Message cannot be empty.', 422);
        }
        if (strlen($text) > 4000) {
            Response::error('Message is too long.', 422);
        }

        $now = new UTCDateTime();
        $senderName = $role === 'student' ? $conversation['studentName'] : $conversation['teacherName'];

        $message = [
            '_id' => new ObjectId(),
            'conversationId' => $conversation['_id'],
            'senderRole' => $role,
            'senderUserId' => new ObjectId($request->user['sub']),
            'senderName' => $senderName,
            'text' => $text,
            'createdAt' => $now,
            'readAt' => null,
        ];
        $db->messages->insertOne($message);

        $otherUnreadField = $role === 'student' ? 'teacherUnreadCount' : 'studentUnreadCount';
        $db->conversations->updateOne(
            ['_id' => $conversation['_id']],
            [
                '$set' => ['lastMessageText' => $text, 'lastMessageAt' => $now, 'lastSenderRole' => $role, 'updatedAt' => $now],
                '$inc' => [$otherUnreadField => 1],
            ]
        );

        Response::success($this->formatMessage($message));
    }

    private function formatConversation($c, string $role): array
    {
        $c = (array) $c;
        return [
            'id' => (string) $c['_id'],
            'contactId' => (string) ($role === 'student' ? $c['teacherId'] : $c['studentId']),
            'contactName' => $role === 'student' ? $c['teacherName'] : $c['studentName'],
            'contactAvatarUrl' => $role === 'student' ? ($c['teacherAvatarUrl'] ?? null) : ($c['studentAvatarUrl'] ?? null),
            'lastMessageText' => $c['lastMessageText'] ?? null,
            'lastMessageAt' => isset($c['lastMessageAt']) && $c['lastMessageAt'] ? $c['lastMessageAt']->toDateTime()->format(DATE_ATOM) : null,
            'lastSenderRole' => $c['lastSenderRole'] ?? null,
            'unreadCount' => $c[$role . 'UnreadCount'] ?? 0,
        ];
    }

    private function formatMessage($m): array
    {
        $m = (array) $m;
        return [
            'id' => (string) $m['_id'],
            'conversationId' => (string) $m['conversationId'],
            'senderRole' => $m['senderRole'],
            'senderName' => $m['senderName'],
            'text' => $m['text'],
            'createdAt' => $m['createdAt']->toDateTime()->format(DATE_ATOM),
            'createdAtTs' => $m['createdAt']->toDateTime()->getTimestamp(),
        ];
    }
}
