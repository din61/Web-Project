import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { TeacherApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import Button from '../../components/ui/Button';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import Badge from '../../components/ui/Badge';
import { firstName } from '../../utils/name';

const gradeColors = {
  'A+': '#22C55E', A: '#22C55E', 'A-': '#22C55E',
  'B+': '#2563EB', B: '#2563EB', 'B-': '#2563EB',
  'C+': '#F59E0B', C: '#F59E0B', D: '#F59E0B',
  F: '#EF4444',
};

const activityIcon = {
  entered: 'edit_note',
  updated: 'sync',
  submitted: 'send',
  published: 'campaign',
};

const statusVariant = { draft: 'neutral', submitted: 'warning', published: 'success' };

export default function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useFetch(() => TeacherApi.dashboard(), []);

  if (loading) return <LoadingState label="Loading your dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text dark:text-slate-100">Welcome back, {firstName(user.name)} 👋</h1>
        <p className="mt-1 text-sm text-text-secondary dark:text-slate-400">Here's what's happening across your courses.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon="auto_stories" label="Assigned Courses" value={data.assignedCourses} />
        <StatCard icon="groups" label="Total Students" value={data.totalStudents} accent="text-secondary" bg="bg-secondary/10" />
        <StatCard icon="pending_actions" label="Pending Results" value={data.pendingResults} accent="text-warning" bg="bg-amber-50" />
        <StatCard icon="task_alt" label="Published Results" value={data.publishedResults} accent="text-success" bg="bg-green-50" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Grade Distribution" subtitle="Across all finalized results" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.gradeDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="grade" tick={{ fontSize: 12 }} stroke="#6B7280" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#6B7280" />
              <Tooltip />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {data.gradeDistribution.map((g) => (
                  <Cell key={g.grade} fill={gradeColors[g.grade] || '#2563EB'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Result Statistics" subtitle="From finalized (submitted + published) results">
          <div className="flex flex-col divide-y divide-border dark:divide-slate-700">
            <Stat label="Class Average" value={`${data.classAverage}%`} />
            <Stat label="Average Grade Point" value={data.avgGradePoint.toFixed(2)} />
            <Stat label="Published" value={data.publishedResults} />
            <Stat label="Pending" value={data.pendingResults} />
          </div>
        </Card>
      </div>

      <Card
        title="Recent Activities"
        noPadding
        action={<Button variant="ghost" size="sm" onClick={() => navigate('/teacher/marks')}>Enter Marks</Button>}
      >
        {data.recentActivities.length === 0 ? (
          <EmptyState icon="history" message="No activity yet. Start by entering marks for your courses." />
        ) : (
          <ul className="divide-y divide-border dark:divide-slate-700">
            {data.recentActivities.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                <span className="material-symbols-rounded text-primary" style={{ fontSize: 18 }}>
                  {activityIcon[a.action] || 'history'}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text dark:text-slate-100">
                    {a.label} {a.studentName && <span className="text-text-secondary dark:text-slate-400">— {a.studentName}</span>}
                  </p>
                  <p className="text-xs text-text-secondary dark:text-slate-400">{new Date(a.at).toLocaleString()}</p>
                </div>
                <Badge variant={statusVariant[a.resultStatus] || 'neutral'} className="capitalize">{a.resultStatus}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Quick Actions">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: 'auto_stories', label: 'My Courses', to: '/teacher/courses' },
            { icon: 'edit_note', label: 'Enter Marks', to: '/teacher/marks' },
            { icon: 'campaign', label: 'Publish Results', to: '/teacher/publish' },
            { icon: 'description', label: 'Report Card', to: '/teacher/report-card' },
          ].map((a) => (
            <button
              key={a.label}
              onClick={() => navigate(a.to)}
              className="flex flex-col items-center gap-2 rounded-btn border border-border p-4 text-sm font-medium text-text hover:border-primary hover:bg-primary/5 dark:border-slate-700 dark:text-slate-200"
            >
              <span className="material-symbols-rounded text-primary">{a.icon}</span>
              {a.label}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="flex items-center justify-between py-3">
      <p className="text-sm text-text-secondary dark:text-slate-400">{label}</p>
      <p className="font-bold text-text dark:text-slate-100">{value}</p>
    </div>
  );
}
