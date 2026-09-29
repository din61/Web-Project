import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { StudentApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';

const gradeBadge = (grade) => {
  if (grade.startsWith('A')) return 'success';
  if (grade.startsWith('B') || grade.startsWith('C')) return 'primary';
  if (grade === 'D') return 'warning';
  return 'danger';
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useFetch(() => StudentApi.dashboard(), []);

  if (loading) return <LoadingState label="Loading your dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const creditData = [
    { name: 'Completed', value: data.completedCredits },
    { name: 'Remaining', value: Math.max(160 - data.completedCredits, 0) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text dark:text-slate-100">Welcome back, {user.name.split(' ')[0]} 👋</h1>
        <p className="mt-1 text-sm text-text-secondary dark:text-slate-400">Here's a snapshot of your academic progress.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon="workspace_premium" label="Current CGPA" value={data.cgpa.toFixed(2)} />
        <StatCard icon="school" label="Completed Credits" value={data.completedCredits} accent="text-secondary" bg="bg-secondary/10" />
        <StatCard icon="calendar_month" label="Current Semester" value={data.currentSemester || '—'} accent="text-warning" bg="bg-amber-50" />
        <StatCard icon="event_available" label="Attendance" value={`${data.attendancePercent}%`} accent="text-success" bg="bg-green-50" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Semester GPA Trend" subtitle="SGPA across recent semesters" className="lg:col-span-2">
          {data.sgpaTrend.length === 0 ? (
            <EmptyState message="No results published yet." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.sgpaTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="semester" tick={{ fontSize: 12 }} stroke="#6B7280" />
                <YAxis domain={[0, 4]} tick={{ fontSize: 12 }} stroke="#6B7280" />
                <Tooltip />
                <Line type="monotone" dataKey="sgpa" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Credit Completion" subtitle="Towards 160 credit degree">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={creditData} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={2}>
                <Cell fill="#2563EB" />
                <Cell fill="#E5E7EB" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <p className="text-center text-sm text-text-secondary dark:text-slate-400">
            {data.completedCredits} of 160 credits completed
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card
          title="Recent Results"
          className="lg:col-span-2"
          noPadding
          action={<Button variant="ghost" size="sm" onClick={() => navigate('/student/results')}>View all</Button>}
        >
          <Table
            emptyMessage="No results published yet."
            columns={[
              { key: 'courseCode', label: 'Course Code' },
              { key: 'courseName', label: 'Course' },
              { key: 'grade', label: 'Grade', render: (r) => <Badge variant={gradeBadge(r.grade)}>{r.grade}</Badge> },
              { key: 'credit', label: 'Credit' },
            ]}
            data={data.recentResults}
          />
        </Card>

        <Card title="Announcements" subtitle="Latest from your university" noPadding>
          {data.announcements.length === 0 ? (
            <EmptyState message="No announcements right now." />
          ) : (
            <ul className="divide-y divide-border dark:divide-slate-700">
              {data.announcements.map((a) => (
                <li key={a.id} className="flex gap-3 px-5 py-3">
                  <span className="material-symbols-rounded mt-0.5 text-primary" style={{ fontSize: 18 }}>campaign</span>
                  <div>
                    <p className="text-sm font-medium text-text dark:text-slate-100">{a.title}</p>
                    <p className="line-clamp-2 text-xs text-text-secondary dark:text-slate-400">{a.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Upcoming Exams" subtitle="From recent exam announcements" noPadding>
        {data.announcements.filter((a) => a.category === 'exams').length === 0 ? (
          <EmptyState icon="event" message="No upcoming exam announcements." />
        ) : (
          <ul className="divide-y divide-border dark:divide-slate-700">
            {data.announcements
              .filter((a) => a.category === 'exams')
              .map((a) => (
                <li key={a.id} className="flex gap-3 px-5 py-3">
                  <span className="material-symbols-rounded mt-0.5 text-warning" style={{ fontSize: 18 }}>event</span>
                  <div>
                    <p className="text-sm font-medium text-text dark:text-slate-100">{a.title}</p>
                    <p className="text-xs text-text-secondary dark:text-slate-400">{a.description}</p>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </Card>

      <Card title="Quick Actions">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: 'grading', label: 'View Results', to: '/student/results' },
            { icon: 'history_edu', label: 'Academic History', to: '/student/academic-history' },
            { icon: 'event_available', label: 'Attendance', to: '/student/attendance' },
            { icon: 'person', label: 'Edit Profile', to: '/student/profile' },
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
