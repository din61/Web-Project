import { useMemo, useState } from 'react';
import { ParentApi } from '../../api/endpoints';
import { useFetch } from '../../hooks/useFetch';
import { useParentContext } from '../../context/ParentContext';
import { useToast } from '../../context/ToastContext';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/FormControls';
import ErrorState from '../../components/ui/ErrorState';
import ChildSwitcher from '../../components/layout/ChildSwitcher';

const gradeBadge = (grade) => {
  if (grade.startsWith('A')) return 'success';
  if (grade.startsWith('B') || grade.startsWith('C')) return 'primary';
  if (grade === 'D') return 'warning';
  return 'danger';
};

export default function ParentResults() {
  const { selectedChildId } = useParentContext();
  const toast = useToast();
  const [semester, setSemester] = useState('');
  const [year, setYear] = useState('');
  const [search, setSearch] = useState('');

  const query = useMemo(
    () => ({
      studentId: selectedChildId || undefined,
      semester: semester || undefined,
      year: year || undefined,
      search: search || undefined,
    }),
    [selectedChildId, semester, year, search]
  );

  const { data, loading, error, refetch } = useFetch(() => ParentApi.results(query), [selectedChildId, semester, year, search]);

  const handlePrint = () => window.print();

  const handleDownload = () => {
    if (!data || data.length === 0) {
      toast.warning('No results available to download.');
      return;
    }
    const header = ['Course Code', 'Course Name', 'Credit', 'Grade', 'Grade Point', 'Teacher Comment', 'Semester', 'Year', 'Status'];
    const rows = data.map((r) => [r.courseCode, r.courseName, r.credit, r.grade, r.gradePoint, r.teacherComment, r.semester, r.year, r.status]);
    const csv = [header, ...rows].map((row) => row.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'child-results.csv';
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Results downloaded.');
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text dark:text-slate-100">Child's Results</h1>
          <p className="mt-1 text-sm text-text-secondary dark:text-slate-400">Published course results, grades, and teacher comments.</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="secondary" icon="print" onClick={handlePrint}>Print</Button>
          <Button icon="download" onClick={handleDownload}>Download Report</Button>
        </div>
      </div>

      <div className="print:hidden"><ChildSwitcher /></div>

      <Card className="print:hidden">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <label className="mb-1.5 block text-sm font-medium text-text dark:text-slate-200">Semester</label>
            <Select value={semester} onChange={(e) => setSemester(e.target.value)}>
              <option value="">All</option>
              <option value="Spring">Spring</option>
              <option value="Summer">Summer</option>
              <option value="Fall">Fall</option>
            </Select>
          </div>
          <div className="w-32">
            <label className="mb-1.5 block text-sm font-medium text-text dark:text-slate-200">Year</label>
            <Select value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">All</option>
              {[2023, 2024, 2025, 2026].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
          </div>
          <div className="min-w-[200px] flex-1">
            <label className="mb-1.5 block text-sm font-medium text-text dark:text-slate-200">Search</label>
            <Input icon="search" placeholder="Course name or code" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card noPadding title="Results" subtitle={data ? `${data.length} record(s) found` : undefined}>
        {error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : (
          <Table
            loading={loading}
            emptyMessage="No results found for the selected filters."
            columns={[
              { key: 'courseCode', label: 'Course Code' },
              { key: 'courseName', label: 'Course' },
              { key: 'credit', label: 'Credit' },
              { key: 'grade', label: 'Grade', render: (r) => <Badge variant={gradeBadge(r.grade)}>{r.grade}</Badge> },
              { key: 'gradePoint', label: 'Grade Point' },
              { key: 'teacherComment', label: 'Teacher Comment', render: (r) => <span className="text-xs">{r.teacherComment || '—'}</span> },
              {
                key: 'status',
                label: 'Status',
                render: (r) => <Badge variant={r.status === 'passed' ? 'success' : 'danger'} className="capitalize">{r.status}</Badge>,
              },
            ]}
            data={data}
          />
        )}
      </Card>
    </div>
  );
}
