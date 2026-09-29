import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ParentApi } from '../../api/endpoints';
import { useFetch } from '../../hooks/useFetch';
import { useParentContext } from '../../context/ParentContext';
import Card from '../../components/ui/Card';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import ChildSwitcher from '../../components/layout/ChildSwitcher';

export default function ParentAcademicHistory() {
  const { selectedChildId } = useParentContext();
  const { data, loading, error, refetch } = useFetch(
    () => ParentApi.academicHistory(selectedChildId ? { studentId: selectedChildId } : {}),
    [selectedChildId]
  );

  if (loading) return <LoadingState label="Loading academic history..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const timeline = data.timeline;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text dark:text-slate-100">Academic History</h1>
        <p className="mt-1 text-sm text-text-secondary dark:text-slate-400">Semester-by-semester performance for your child.</p>
      </div>

      <ChildSwitcher />

      {timeline.length === 0 ? (
        <Card><EmptyState message="No semester history yet." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {timeline.map((s) => (
              <div key={`${s.semester}-${s.year}`} className="rounded-card border border-border bg-surface p-5 shadow-soft dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-text dark:text-slate-100">{s.semester} {s.year}</p>
                  <span className="material-symbols-rounded text-primary">calendar_month</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-text-secondary dark:text-slate-400">Credits</p>
                    <p className="font-bold text-text dark:text-slate-100">{s.credits}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary dark:text-slate-400">SGPA</p>
                    <p className="font-bold text-primary">{s.sgpa.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary dark:text-slate-400">CGPA</p>
                    <p className="font-bold text-secondary">{s.cgpa.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Card title="Performance Timeline" subtitle="SGPA vs CGPA across semesters">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeline.map((s) => ({ ...s, label: `${s.semester} ${s.year}` }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#6B7280" />
                <YAxis domain={[0, 4]} tick={{ fontSize: 12 }} stroke="#6B7280" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="sgpa" name="SGPA" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="cgpa" name="CGPA" stroke="#14B8A6" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}
    </div>
  );
}
