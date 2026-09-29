import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TeacherApi } from '../../api/endpoints';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Select, Input, Textarea } from '../../components/ui/FormControls';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import { COMPONENT_MAX, previewTotal, previewGrade } from '../../utils/grading';

const statusVariant = { draft: 'neutral', submitted: 'warning', published: 'success', not_entered: 'danger' };
const statusLabel = { draft: 'Draft', submitted: 'Submitted', published: 'Published', not_entered: 'Not Entered' };

export default function EnterMarks() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();

  const { data: offerings, loading: loadingOfferings } = useFetch(() => TeacherApi.courses(), []);

  const [selection, setSelection] = useState(() => {
    const courseId = params.get('courseId');
    const semester = params.get('semester');
    const year = params.get('year');
    return courseId && semester && year ? `${courseId}|${semester}|${year}` : '';
  });

  const [courseId, semester, year] = selection ? selection.split('|') : [null, null, null];

  const { data: sheet, loading, error, refetch } = useFetch(
    () => (courseId ? TeacherApi.marksSheet({ courseId, semester, year }) : Promise.resolve({ data: null })),
    [courseId, semester, year]
  );

  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyStudent, setHistoryStudent] = useState('');
  const [requestRow, setRequestRow] = useState(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (sheet) setRows(sheet.rows.map((r) => ({ ...r })));
  }, [sheet]);

  const onSelect = (e) => {
    const value = e.target.value;
    setSelection(value);
    if (value) {
      const [cId, sem, yr] = value.split('|');
      setParams({ courseId: cId, semester: sem, year: yr });
    }
  };

  const updateRow = (studentObjectId, field, value) => {
    setRows((prev) => prev.map((r) => (r.studentObjectId === studentObjectId ? { ...r, [field]: value } : r)));
  };

  const save = async (action) => {
    setSaving(true);
    setFieldErrors({});
    try {
      const entries = rows.map((r) => ({
        studentObjectId: r.studentObjectId,
        quizMarks: r.quizMarks === '' || r.quizMarks === null ? 0 : Number(r.quizMarks),
        assignmentMarks: r.assignmentMarks === '' || r.assignmentMarks === null ? 0 : Number(r.assignmentMarks),
        attendanceMarks: r.attendanceMarks === '' || r.attendanceMarks === null ? 0 : Number(r.attendanceMarks),
        midMarks: r.midMarks === '' || r.midMarks === null ? 0 : Number(r.midMarks),
        finalMarks: r.finalMarks === '' || r.finalMarks === null ? 0 : Number(r.finalMarks),
        teacherComment: r.teacherComment || '',
      }));
      await TeacherApi.saveMarks({ courseId, semester, year, action, entries });
      toast.success(action === 'submit' ? 'Results submitted for review.' : 'Draft saved successfully.');
      refetch();
    } catch (err) {
      if (err.errors) setFieldErrors(err.errors);
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openHistory = async (row) => {
    if (!row.resultId) return;
    setHistoryOpen(true);
    setHistoryStudent(row.studentName);
    setHistoryLoading(true);
    try {
      const res = await TeacherApi.auditLog({ resultId: row.resultId });
      setHistoryRows(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const resolveRequest = async (status) => {
    if (!requestRow?.changeRequest) return;
    setResolving(true);
    try {
      await TeacherApi.resolveGradeChangeRequest(requestRow.changeRequest.id, { status });
      toast.success(status === 'resolved' ? 'Marked as resolved.' : 'Request dismissed.');
      setRequestRow(null);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setResolving(false);
    }
  };

  const options = useMemo(() => offerings || [], [offerings]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text dark:text-slate-100">Enter / Edit Marks</h1>
        <p className="mt-1 text-sm text-text-secondary dark:text-slate-400">
          Select a course offering, enter component marks, and save as draft or submit for publishing.
        </p>
      </div>

      <Card>
        <div className="max-w-sm">
          <label className="mb-1.5 block text-sm font-medium text-text dark:text-slate-200">Course Offering</label>
          {loadingOfferings ? (
            <LoadingState label="Loading courses..." />
          ) : (
            <Select value={selection} onChange={onSelect}>
              <option value="">Select a course...</option>
              {options.map((o) => (
                <option key={`${o.courseId}|${o.semester}|${o.year}`} value={`${o.courseId}|${o.semester}|${o.year}`}>
                  {o.courseCode} — {o.courseName} ({o.semester} {o.year})
                </option>
              ))}
            </Select>
          )}
        </div>
      </Card>

      {!courseId ? (
        <Card><EmptyState icon="edit_note" message="Select a course offering above to start entering marks." /></Card>
      ) : loading || !sheet ? (
        <LoadingState label="Loading roster..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <Card
          title={`${sheet.course.code} — ${sheet.course.name}`}
          subtitle={`${sheet.semester} ${sheet.year} · Max marks — Quiz ${COMPONENT_MAX.quiz}, Assignment ${COMPONENT_MAX.assignment}, Attendance ${COMPONENT_MAX.attendance}, Mid ${COMPONENT_MAX.mid}, Final ${COMPONENT_MAX.final}`}
          noPadding
        >
          {rows.length === 0 ? (
            <EmptyState message="No students enrolled in this course offering." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-text-secondary dark:border-slate-700 dark:text-slate-400">
                    <th className="px-3 py-3 font-medium">Student</th>
                    <th className="px-3 py-3 font-medium">Quiz</th>
                    <th className="px-3 py-3 font-medium">Assignment</th>
                    <th className="px-3 py-3 font-medium">Mid</th>
                    <th className="px-3 py-3 font-medium">Final</th>
                    <th className="px-3 py-3 font-medium">Attendance</th>
                    <th className="px-3 py-3 font-medium">Total</th>
                    <th className="px-3 py-3 font-medium">Grade</th>
                    <th className="px-3 py-3 font-medium">GP</th>
                    <th className="px-3 py-3 font-medium min-w-[220px]">Teacher Comment</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">History</th>
                    <th className="px-3 py-3 font-medium">Change Request</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const total = previewTotal({
                      quiz: r.quizMarks, assignment: r.assignmentMarks, attendance: r.attendanceMarks,
                      mid: r.midMarks, final: r.finalMarks,
                    });
                    const preview = previewGrade(total);
                    const errs = fieldErrors[r.studentObjectId];
                    const flagged = !!r.changeRequest;
                    return (
                      <tr
                        key={r.studentObjectId}
                        className={`border-b border-border last:border-0 dark:border-slate-700 ${
                          flagged ? 'bg-danger/10 dark:bg-danger/20' : ''
                        }`}
                      >
                        <td className="px-3 py-2 align-top">
                          <p className="font-medium text-text dark:text-slate-100">{r.studentName}</p>
                          <p className="text-xs text-text-secondary dark:text-slate-400">{r.studentId}</p>
                        </td>
                        {['quizMarks', 'assignmentMarks', 'midMarks', 'finalMarks', 'attendanceMarks'].map((field) => (
                          <td key={field} className="px-3 py-2 align-top">
                            <Input
                              type="number"
                              min={0}
                              step="0.5"
                              value={r[field] ?? ''}
                              onChange={(e) => updateRow(r.studentObjectId, field, e.target.value)}
                              className="w-20"
                            />
                          </td>
                        ))}
                        <td className="px-3 py-2 align-top font-semibold text-text dark:text-slate-100">{total ?? '—'}</td>
                        <td className="px-3 py-2 align-top"><Badge variant="primary">{preview.grade}</Badge></td>
                        <td className="px-3 py-2 align-top">{preview.gradePoint ?? '—'}</td>
                        <td className="px-3 py-2 align-top">
                          <Textarea
                            rows={2}
                            className="resize-none"
                            value={r.teacherComment || ''}
                            onChange={(e) => updateRow(r.studentObjectId, 'teacherComment', e.target.value)}
                            placeholder="Write a comment..."
                          />
                          {errs && <p className="mt-1 text-xs text-danger">{errs.join(' ')}</p>}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Badge variant={statusVariant[r.resultStatus]}>{statusLabel[r.resultStatus]}</Badge>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <button
                            disabled={!r.resultId}
                            onClick={() => openHistory(r)}
                            className="text-text-secondary hover:text-primary disabled:opacity-30"
                            title="View grade change history"
                          >
                            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>history</span>
                          </button>
                        </td>
                        <td className="px-3 py-2 align-top">
                          {flagged ? (
                            <button
                              onClick={() => setRequestRow(r)}
                              className="inline-flex items-center gap-1 text-sm font-medium text-danger hover:underline"
                              title="Student has requested a grade review"
                            >
                              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>flag</span>
                              Review
                            </button>
                          ) : (
                            <span className="text-text-secondary/50">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-2 border-t border-border p-5 dark:border-slate-700">
            <Button icon="save" variant="secondary" loading={saving} onClick={() => save('draft')}>Save Draft</Button>
            <Button icon="send" loading={saving} onClick={() => save('submit')}>Submit for Review</Button>
          </div>
        </Card>
      )}

      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title={`Grade History — ${historyStudent}`} width="max-w-2xl">
        {historyLoading ? (
          <LoadingState label="Loading history..." />
        ) : historyRows.length === 0 ? (
          <EmptyState icon="history" message="No changes recorded for this result yet." />
        ) : (
          <ul className="flex flex-col gap-3">
            {historyRows.map((h) => (
              <li key={h.id} className="rounded-btn border border-border p-3 text-sm dark:border-slate-700">
                <p className="text-text dark:text-slate-100">
                  Marks changed from <strong>{h.previousMarks}</strong> to <strong>{h.newMarks}</strong>
                  {' '}(<span className="text-danger">{h.previousGrade}</span> → <span className="text-success">{h.newGrade}</span>)
                </p>
                {h.previousComment !== h.newComment && (
                  <p className="mt-1 text-xs text-text-secondary dark:text-slate-400">
                    Comment: "{h.previousComment}" → "{h.newComment}"
                  </p>
                )}
                {h.reason && <p className="mt-1 text-xs italic text-text-secondary dark:text-slate-400">Reason: {h.reason}</p>}
                <p className="mt-1 text-xs text-text-secondary/70 dark:text-slate-500">
                  {new Date(h.changedAt).toLocaleString()} · by {h.changedByRole}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <Modal
        open={!!requestRow}
        onClose={() => setRequestRow(null)}
        title={requestRow ? `Grade Change Request — ${requestRow.studentName}` : ''}
        footer={(
          <>
            <Button variant="secondary" loading={resolving} onClick={() => resolveRequest('dismissed')}>Dismiss</Button>
            <Button loading={resolving} onClick={() => resolveRequest('resolved')}>Mark Resolved</Button>
          </>
        )}
      >
        {requestRow?.changeRequest && (
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-text-secondary dark:text-slate-400">
              Requested on {new Date(requestRow.changeRequest.createdAt).toLocaleString()}
            </p>
            <p className="rounded-btn border border-border p-3 text-text dark:border-slate-700 dark:text-slate-100">
              {requestRow.changeRequest.reason}
            </p>
            <p className="text-xs text-text-secondary dark:text-slate-400">
              If you adjust the marks above, remember to save. Once you're done, dismiss or mark this request resolved to clear the flag.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
