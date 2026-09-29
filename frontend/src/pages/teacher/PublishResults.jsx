import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TeacherApi } from '../../api/endpoints';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import { Select } from '../../components/ui/FormControls';
import LoadingState from '../../components/ui/LoadingState';
import EmptyState from '../../components/ui/EmptyState';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import StatCard from '../../components/ui/StatCard';

const gradeColors = {
  'A+': '#22C55E', A: '#22C55E', 'A-': '#22C55E',
  'B+': '#2563EB', B: '#2563EB', 'B-': '#2563EB',
  'C+': '#F59E0B', C: '#F59E0B', D: '#F59E0B',
  F: '#EF4444',
};

export default function PublishResults() {
  const { data: offerings, loading: loadingOfferings } = useFetch(() => TeacherApi.courses(), []);
  const toast = useToast();

  const [selection, setSelection] = useState('');
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [courseId, semester, year] = selection ? selection.split('|') : [null, null, null];

  const loadPreview = async (value) => {
    const [cId, sem, yr] = value.split('|');
    setLoadingPreview(true);
    setPreview(null);
    try {
      const res = await TeacherApi.publishPreview({ courseId: cId, semester: sem, year: yr });
      setPreview(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingPreview(false);
    }
  };

  const onSelect = (e) => {
    const value = e.target.value;
    setSelection(value);
    if (value) loadPreview(value);
    else setPreview(null);
  };

  const doPublish = async () => {
    setPublishing(true);
    try {
      const res = await TeacherApi.publish({ courseId, semester, year });
      toast.success(res.message);
      setConfirmOpen(false);
      loadPreview(selection);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text dark:text-slate-100">Publish Results</h1>
        <p className="mt-1 text-sm text-text-secondary dark:text-slate-400">
          Preview submitted results before publishing — publishing notifies students and linked parents immediately.
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
              {(offerings || []).map((o) => (
                <option key={`${o.courseId}|${o.semester}|${o.year}`} value={`${o.courseId}|${o.semester}|${o.year}`}>
                  {o.courseCode} — {o.courseName} ({o.semester} {o.year})
                </option>
              ))}
            </Select>
          )}
        </div>
      </Card>

      {!selection ? (
        <Card><EmptyState icon="campaign" message="Select a course offering to preview its results." /></Card>
      ) : loadingPreview ? (
        <LoadingState label="Loading preview..." />
      ) : preview ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon="task_alt" label="Ready to Publish" value={preview.readyToPublish} accent="text-success" bg="bg-green-50" />
            <StatCard icon="hourglass_empty" label="Still Draft" value={preview.stillDraft} accent="text-warning" bg="bg-amber-50" />
            <StatCard icon="query_stats" label="Class Average" value={`${preview.classAverage}%`} />
            <StatCard icon="workspace_premium" label="Avg Grade Point" value={preview.avgGradePoint.toFixed(2)} accent="text-secondary" bg="bg-secondary/10" />
          </div>

          {preview.readyToPublish === 0 ? (
            <Card>
              <EmptyState
                icon="hourglass_empty"
                message="No submitted results ready to publish yet. Ask teachers to submit marks from the Enter Marks page first."
              />
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Card title="Grade Distribution" className="lg:col-span-2">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={preview.gradeDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="grade" tick={{ fontSize: 12 }} stroke="#6B7280" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#6B7280" />
                      <Tooltip />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {preview.gradeDistribution.map((g) => (
                          <Cell key={g.grade} fill={gradeColors[g.grade] || '#2563EB'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
                <Card title="Range">
                  <div className="flex flex-col divide-y divide-border dark:divide-slate-700">
                    <div className="flex items-center justify-between py-3">
                      <p className="text-sm text-text-secondary dark:text-slate-400">Highest</p>
                      <p className="font-bold text-success">{preview.highest}</p>
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <p className="text-sm text-text-secondary dark:text-slate-400">Lowest</p>
                      <p className="font-bold text-danger">{preview.lowest}</p>
                    </div>
                  </div>
                </Card>
              </div>

              <Card noPadding title="Preview" subtitle={`${preview.course.code} — ${preview.course.name} (${preview.semester} ${preview.year})`}>
                <Table
                  columns={[
                    { key: 'studentId', label: 'Student ID' },
                    { key: 'studentName', label: 'Name' },
                    { key: 'totalMarks', label: 'Total' },
                    { key: 'grade', label: 'Grade', render: (r) => <Badge variant="primary">{r.grade}</Badge> },
                    { key: 'gradePoint', label: 'Grade Point' },
                  ]}
                  data={preview.rows}
                />
              </Card>

              <div>
                <Button icon="campaign" onClick={() => setConfirmOpen(true)}>Publish {preview.readyToPublish} Result(s)</Button>
              </div>
            </>
          )}
        </>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={doPublish}
        title="Publish results?"
        message={`This will publish ${preview?.readyToPublish ?? 0} result(s) for ${preview?.course.code} (${preview?.semester} ${preview?.year}). Students and their linked parents will be notified immediately. This action cannot be undone.`}
        confirmLabel="Publish"
        loading={publishing}
      />
    </div>
  );
}
