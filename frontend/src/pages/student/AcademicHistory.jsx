import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { StudentApi } from '../../api/endpoints';
import { useFetch } from '../../hooks/useFetch';
import Card from '../../components/ui/Card';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';

export default function AcademicHistory() {
  const { data, loading, error, refetch } = useFetch(() => StudentApi.academicHistory(), []);

  if (loading) return <LoadingState label="Loading academic history..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const timeline = data.timeline;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text dark:text-slate-100">Academic History</h1>
        <p className="mt-1 text-sm text-text-secondary dark:text-slate-400">Your semester-by-semester performance.</p>
      </div>

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

          <Card title="Semester Details" noPadding>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-text-secondary dark:border-slate-700 dark:text-slate-400">
                    <th className="px-4 py-3 font-medium">Semester</th>
                    <th className="px-4 py-3 font-medium">Credits</th>
                    <th className="px-4 py-3 font-medium">SGPA</th>
                    <th className="px-4 py-3 font-medium">CGPA</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.map((s) => (
                    <tr key={`${s.semester}-${s.year}-row`} className="border-b border-border last:border-0 dark:border-slate-700">
                      <td className="px-4 py-3 text-text dark:text-slate-200">{s.semester} {s.year}</td>
                      <td className="px-4 py-3 text-text dark:text-slate-200">{s.credits}</td>
                      <td className="px-4 py-3 font-medium text-primary">{s.sgpa.toFixed(2)}</td>
                      <td className="px-4 py-3 font-medium text-secondary">{s.cgpa.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
