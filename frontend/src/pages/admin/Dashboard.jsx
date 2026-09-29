import { useNavigate } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { AdminApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import { firstName } from '../../utils/name';

const activityIcon = {
  student_added: 'person_add',
  teacher_added: 'person_add',
  course_added: 'auto_stories',
  result_published: 'campaign',
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useFetch(() => AdminApi.dashboard(), []);

  if (loading) return <LoadingState label="Loading dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text dark:text-slate-100">Welcome back, {firstName(user.name)} 👋</h1>
        <p className="mt-1 text-sm text-text-secondary dark:text-slate-400">System-wide overview.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon="school" label="Total Students" value={data.totalStudents} />
        <StatCard icon="groups" label="Total Teachers" value={data.totalTeachers} accent="text-secondary" bg="bg-secondary/10" />
        <StatCard icon="auto_stories" label="Total Courses" value={data.totalCourses} accent="text-primary" bg="bg-blue-50" />
        <StatCard icon="calendar_month" label="Current Semester" value={data.currentSemester || '—'} accent="text-warning" bg="bg-amber-50" />
        <StatCard icon="task_alt" label="Published Results" value={data.publishedResults} accent="text-success" bg="bg-green-50" />
      </div>

      <Card
        title="Recent Activity"
        noPadding
        action={<button onClick={() => navigate('/admin/students')} className="text-xs font-medium text-primary hover:underline">Manage Students</button>}
      >
        {data.recentActivity.length === 0 ? (
          <EmptyState icon="history" message="No activity yet." />
        ) : (
          <ul className="divide-y divide-border dark:divide-slate-700">
            {data.recentActivity.map((a, i) => (
              <li key={i} className="flex items-center gap-3 px-5 py-3">
                <span className="material-symbols-rounded text-primary" style={{ fontSize: 18 }}>{activityIcon[a.type] || 'info'}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text dark:text-slate-100">{a.label}</p>
                  <p className="text-xs text-text-secondary dark:text-slate-400">{new Date(a.at).toLocaleString()}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Quick Actions">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: 'school', label: 'Students', to: '/admin/students' },
            { icon: 'groups', label: 'Teachers', to: '/admin/teachers' },
            { icon: 'auto_stories', label: 'Courses', to: '/admin/courses' },
            { icon: 'calendar_month', label: 'Semesters', to: '/admin/semesters' },
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
