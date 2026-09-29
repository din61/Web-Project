import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useFetch } from '../../hooks/useFetch';
import { ParentApi } from '../../api/endpoints';
import { useParentContext } from '../../context/ParentContext';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import ChildSwitcher from '../../components/layout/ChildSwitcher';

export default function ParentDashboard() {
  const { selectedChildId, children, loading: loadingChildren } = useParentContext();
  const { data, loading, error, refetch } = useFetch(
    () => ParentApi.dashboard(selectedChildId ? { studentId: selectedChildId } : {}),
    [selectedChildId]
  );

  const child = children.find((c) => c.id === selectedChildId);

  if (loadingChildren || loading) return <LoadingState label="Loading dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return <Card><EmptyState icon="family_restroom" message="No student is linked to this account yet." /></Card>;

  const creditData = [
    { name: 'Completed', value: data.completedCredits },
    { name: 'Remaining', value: data.remainingCredits },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text dark:text-slate-100">
          {child ? `${child.name}'s Progress` : "Your Child's Progress"} 👋
        </h1>
        <p className="mt-1 text-sm text-text-secondary dark:text-slate-400">
          {data.student.studentId} · {data.student.currentSemester || '—'}
        </p>
      </div>

      <ChildSwitcher />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon="workspace_premium" label="Current CGPA" value={data.currentCgpa.toFixed(2)} />
        <StatCard icon="trending_up" label="Current SGPA" value={data.currentSgpa.toFixed(2)} accent="text-secondary" bg="bg-secondary/10" />
        <StatCard icon="school" label="Completed Credits" value={data.completedCredits} accent="text-warning" bg="bg-amber-50" />
        <StatCard icon="event_available" label="Attendance" value={`${data.attendancePercent}%`} accent="text-success" bg="bg-green-50" />
        <StatCard icon="task_alt" label="Courses Passed" value={data.passedCourses} accent="text-primary" bg="bg-blue-50" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="CGPA Progress" subtitle="Cumulative GPA across semesters" className="lg:col-span-2">
          {data.cgpaTrend.length === 0 ? (
            <EmptyState message="No published results yet." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.cgpaTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="semester" tick={{ fontSize: 12 }} stroke="#6B7280" />
                <YAxis domain={[0, 4]} tick={{ fontSize: 12 }} stroke="#6B7280" />
                <Tooltip />
                <Line type="monotone" dataKey="cgpa" name="CGPA" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Credit Progress" subtitle={`Towards ${data.totalRequiredCredits}-credit degree`}>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={creditData} dataKey="value" innerRadius={50} outerRadius={78} paddingAngle={2}>
                <Cell fill="#2563EB" />
                <Cell fill="#E5E7EB" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 grid grid-cols-2 gap-2 text-center text-sm">
            <div>
              <p className="text-text-secondary dark:text-slate-400">Completed</p>
              <p className="font-bold text-text dark:text-slate-100">{data.completedCredits}</p>
            </div>
            <div>
              <p className="text-text-secondary dark:text-slate-400">Remaining</p>
              <p className="font-bold text-text dark:text-slate-100">{data.remainingCredits}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card title="SGPA Progress" subtitle="Semester-by-semester GPA">
        {data.sgpaTrend.length === 0 ? (
          <EmptyState message="No published results yet." />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.sgpaTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="semester" tick={{ fontSize: 12 }} stroke="#6B7280" />
              <YAxis domain={[0, 4]} tick={{ fontSize: 12 }} stroke="#6B7280" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="sgpa" name="SGPA" stroke="#14B8A6" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card title="Academic Summary">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <SummaryRow label="Current CGPA" value={data.currentCgpa.toFixed(2)} />
          <SummaryRow label="Previous CGPA" value={data.previousCgpa !== null ? data.previousCgpa.toFixed(2) : '—'} />
          <SummaryRow label="Current SGPA" value={data.currentSgpa.toFixed(2)} />
          <SummaryRow label="Completed Credits" value={data.completedCredits} />
          <SummaryRow label="Attendance" value={`${data.attendancePercent}%`} />
          <SummaryRow label="Courses Passed" value={data.passedCourses} />
        </div>
      </Card>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="rounded-btn bg-bg p-4 dark:bg-slate-900">
      <p className="text-xs text-text-secondary dark:text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-bold text-text dark:text-slate-100">{value}</p>
    </div>
  );
}
