import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ParentApi } from '../../api/endpoints';
import { useFetch } from '../../hooks/useFetch';
import { useParentContext } from '../../context/ParentContext';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import Table from '../../components/ui/Table';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import ChildSwitcher from '../../components/layout/ChildSwitcher';

export default function ParentAttendance() {
  const { selectedChildId } = useParentContext();
  const { data, loading, error, refetch } = useFetch(
    () => ParentApi.attendance(selectedChildId ? { studentId: selectedChildId } : {}),
    [selectedChildId]
  );

  if (loading) return <LoadingState label="Loading attendance..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text dark:text-slate-100">Attendance</h1>
        <p className="mt-1 text-sm text-text-secondary dark:text-slate-400">Read-only view of your child's attendance record.</p>
      </div>

      <ChildSwitcher />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon="event_available" label="Overall Attendance" value={`${data.overallPercent}%`} accent="text-success" bg="bg-green-50" />
        <StatCard icon="calendar_month" label="Semesters Tracked" value={data.bySemester.length} />
        <StatCard icon="event_busy" label="Total Absences" value={data.absences.length} accent="text-danger" bg="bg-red-50" />
      </div>

      <Card title="Monthly Attendance" subtitle="Attendance percentage by month">
        {data.monthly.length === 0 ? (
          <EmptyState icon="calendar_month" message="No attendance records yet." />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#6B7280" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#6B7280" />
              <Tooltip formatter={(v) => `${v}%`} />
              <Bar dataKey="percent" fill="#2563EB" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card title="Semester Attendance">
        {data.bySemester.length === 0 ? (
          <EmptyState message="No semester attendance data yet." />
        ) : (
          <div className="flex flex-col divide-y divide-border dark:divide-slate-700">
            {data.bySemester.map((s) => (
              <div key={s.semester} className="flex items-center justify-between py-3">
                <p className="text-sm text-text-secondary dark:text-slate-400">{s.semester}</p>
                <p className="font-bold text-text dark:text-slate-100">{s.percent}%</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card noPadding title="Absent List">
        <Table
          emptyMessage="No absences recorded — great attendance!"
          columns={[
            { key: 'courseCode', label: 'Course Code' },
            { key: 'courseName', label: 'Course Name' },
            { key: 'date', label: 'Date' },
          ]}
          data={data.absences}
        />
      </Card>
    </div>
  );
}
