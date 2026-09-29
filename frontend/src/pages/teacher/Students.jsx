import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TeacherApi } from '../../api/endpoints';
import { useFetch } from '../../hooks/useFetch';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/FormControls';
import ErrorState from '../../components/ui/ErrorState';

const statusVariant = { draft: 'neutral', submitted: 'warning', published: 'success', not_entered: 'danger' };
const statusLabel = { draft: 'Draft', submitted: 'Submitted', published: 'Published', not_entered: 'Not Entered' };

export default function Students() {
  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') || '');
  const [semester, setSemester] = useState('');

  const query = useMemo(() => ({ search: search || undefined, semester: semester || undefined }), [search, semester]);
  const { data, loading, error, refetch } = useFetch(() => TeacherApi.students(query), [search, semester]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text dark:text-slate-100">Students</h1>
        <p className="mt-1 text-sm text-text-secondary dark:text-slate-400">Students enrolled in your assigned courses.</p>
      </div>

      <Card>
        <div className="flex flex-wrap gap-3">
          <div className="min-w-[220px] flex-1">
            <Input icon="search" placeholder="Search by name or student ID" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-48">
            <Select value={semester} onChange={(e) => setSemester(e.target.value)}>
              <option value="">All Semesters</option>
              <option value="Spring">Spring</option>
              <option value="Summer">Summer</option>
              <option value="Fall">Fall</option>
            </Select>
          </div>
          <Button type="button" variant="secondary" onClick={() => { setSearch(''); setSemester(''); }}>Clear</Button>
        </div>
      </Card>

      <Card noPadding title="Enrolled Students" subtitle={data ? `${data.length} student(s) found` : undefined}>
        {error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : (
          <Table
            loading={loading}
            emptyMessage="No students found."
            columns={[
              { key: 'studentId', label: 'Student ID' },
              { key: 'name', label: 'Name' },
              { key: 'department', label: 'Department' },
              { key: 'attendancePercent', label: 'Attendance', render: (r) => r.attendancePercent === null ? '—' : `${r.attendancePercent}%` },
              {
                key: 'resultStatus',
                label: 'Result Status',
                render: (r) => <Badge variant={statusVariant[r.resultStatus]}>{statusLabel[r.resultStatus]}</Badge>,
              },
            ]}
            data={data}
          />
        )}
      </Card>
    </div>
  );
}
