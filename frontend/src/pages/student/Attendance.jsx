import { StudentApi } from '../../api/endpoints';
import { useFetch } from '../../hooks/useFetch';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import Badge from '../../components/ui/Badge';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import Table from '../../components/ui/Table';

const statusVariant = { present: 'success', absent: 'danger', late: 'warning' };

export default function Attendance() {
  const { data, loading, error, refetch } = useFetch(() => StudentApi.attendance(), []);

  if (loading) return <LoadingState label="Loading attendance..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const { summary, records } = data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text dark:text-slate-100">Attendance</h1>
        <p className="mt-1 text-sm text-text-secondary dark:text-slate-400">Your course-wise attendance record.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon="event_available" label="Attendance %" value={`${summary.percent}%`} accent="text-success" bg="bg-green-50" />
        <StatCard icon="check_circle" label="Present" value={summary.present} accent="text-success" bg="bg-green-50" />
        <StatCard icon="cancel" label="Absent" value={summary.absent} accent="text-danger" bg="bg-red-50" />
        <StatCard icon="schedule" label="Late" value={summary.late} accent="text-warning" bg="bg-amber-50" />
      </div>

      <Card title="Attendance Log" noPadding>
        <Table
          emptyMessage="No attendance records yet."
          columns={[
            { key: 'courseCode', label: 'Course Code' },
            { key: 'courseName', label: 'Course Name' },
            { key: 'date', label: 'Date' },
            { key: 'status', label: 'Status', render: (r) => <Badge variant={statusVariant[r.status]} className="capitalize">{r.status}</Badge> },
          ]}
          data={records}
        />
      </Card>
    </div>
  );
}
