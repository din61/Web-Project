import { useMemo, useState } from 'react';
import { AdminApi } from '../../api/endpoints';
import { useFetch } from '../../hooks/useFetch';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import { Input, Select } from '../../components/ui/FormControls';
import ErrorState from '../../components/ui/ErrorState';

const statusVariant = { draft: 'neutral', submitted: 'warning', published: 'success' };

export default function AdminResults() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const query = useMemo(() => ({ status: status || undefined, search: search || undefined }), [status, search]);
  const { data, loading, error, refetch } = useFetch(() => AdminApi.results(query), [status, search]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text dark:text-slate-100">Results</h1>
        <p className="mt-1 text-sm text-text-secondary dark:text-slate-400">
          Read-only view of result status across the system. Full approval/publishing tools ship in the Final Update.
        </p>
      </div>

      <Card>
        <div className="flex flex-wrap gap-3">
          <div className="min-w-[220px] flex-1">
            <Input icon="search" placeholder="Search by course code or name" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-48">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="published">Published</option>
            </Select>
          </div>
        </div>
      </Card>

      <Card noPadding title="Results" subtitle={data ? `${data.length} record(s) shown (most recent 300)` : undefined}>
        {error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : (
          <Table
            loading={loading}
            emptyMessage="No results found."
            columns={[
              { key: 'studentId', label: 'Student ID' },
              { key: 'courseCode', label: 'Course' },
              { key: 'teacherName', label: 'Teacher' },
              { key: 'semester', label: 'Semester', render: (r) => `${r.semester} ${r.year}` },
              { key: 'totalMarks', label: 'Marks', render: (r) => r.totalMarks ?? '—' },
              { key: 'grade', label: 'Grade', render: (r) => <Badge variant="primary">{r.grade}</Badge> },
              { key: 'resultStatus', label: 'Status', render: (r) => <Badge variant={statusVariant[r.resultStatus]} className="capitalize">{r.resultStatus}</Badge> },
            ]}
            data={data}
          />
        )}
      </Card>
    </div>
  );
}
