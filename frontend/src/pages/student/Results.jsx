import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StudentApi } from '../../api/endpoints';
import { useFetch } from '../../hooks/useFetch';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/FormControls';
import ErrorState from '../../components/ui/ErrorState';
import { useToast } from '../../context/ToastContext';

const gradeBadge = (grade) => {
  if (grade.startsWith('A')) return 'success';
  if (grade.startsWith('B') || grade.startsWith('C')) return 'primary';
  if (grade === 'D') return 'warning';
  return 'danger';
};

export default function Results() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const [semester, setSemester] = useState(params.get('semester') || '');
  const [year, setYear] = useState(params.get('year') || '');
  const [search, setSearch] = useState(params.get('search') || '');

  const query = useMemo(() => ({ semester: semester || undefined, year: year || undefined, search: search || undefined }), [semester, year, search]);

  const { data, loading, error, refetch } = useFetch(() => StudentApi.results(query), [semester, year, search]);

  const [disputeRow, setDisputeRow] = useState(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const openDispute = (row) => {
    setDisputeRow(row);
    setReason('');
  };

  const submitDispute = async () => {
    if (reason.trim().length < 10) {
      toast.warning('Please describe your reason in at least 10 characters.');
      return;
    }
    setSubmitting(true);
    try {
      await StudentApi.requestGradeChange({ resultId: disputeRow.id, reason: reason.trim() });
      toast.success('Your request has been sent to the teacher.');
      setDisputeRow(null);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const applyFilters = (e) => {
    e.preventDefault();
    const next = {};
    if (semester) next.semester = semester;
    if (year) next.year = year;
    if (search) next.search = search;
    setParams(next);
    refetch();
  };

  const clearFilters = () => {
    setSemester('');
    setYear('');
    setSearch('');
    setParams({});
  };

  const handlePrint = () => window.print();

  const handleDownload = () => {
    if (!data || data.length === 0) {
      toast.warning('No results available to download.');
      return;
    }
    const header = ['Course Code', 'Course Name', 'Teacher', 'Credit', 'Grade', 'Grade Point', 'Semester', 'Year', 'Status'];
    const rows = data.map((r) => [r.courseCode, r.courseName, r.teacher, r.credit, r.grade, r.gradePoint, r.semester, r.year, r.status]);
    const csv = [header, ...rows].map((row) => row.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'my-results.csv';
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Results downloaded.');
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text dark:text-slate-100">Results</h1>
          <p className="mt-1 text-sm text-text-secondary dark:text-slate-400">All your published course results.</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="secondary" icon="print" onClick={handlePrint}>Print Report</Button>
          <Button icon="download" onClick={handleDownload}>Download PDF</Button>
        </div>
      </div>

      <Card className="print:hidden">
        <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-3">
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
          <Button type="submit" icon="filter_alt">Apply</Button>
          <Button type="button" variant="secondary" onClick={clearFilters}>Clear</Button>
        </form>
      </Card>

      <Card noPadding title="My Results" subtitle={data ? `${data.length} record(s) found` : undefined}>
        {error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : (
          <Table
            loading={loading}
            emptyMessage="No results found for the selected filters."
            columns={[
              { key: 'courseCode', label: 'Course Code' },
              { key: 'courseName', label: 'Course Name' },
              { key: 'teacher', label: 'Teacher' },
              { key: 'credit', label: 'Credit' },
              { key: 'grade', label: 'Grade', render: (r) => <Badge variant={gradeBadge(r.grade)}>{r.grade}</Badge> },
              { key: 'gradePoint', label: 'Grade Point' },
              {
                key: 'status',
                label: 'Status',
                render: (r) => <Badge variant={r.status === 'passed' ? 'success' : 'danger'} className="capitalize">{r.status}</Badge>,
              },
              {
                key: 'dispute',
                label: '',
                render: (r) => (
                  r.hasPendingChangeRequest ? (
                    <Badge variant="warning">Review pending</Badge>
                  ) : (
                    <button
                      onClick={() => openDispute(r)}
                      className="text-sm font-medium text-primary hover:underline print:hidden"
                    >
                      Request grade change
                    </button>
                  )
                ),
              },
            ]}
            data={data}
          />
        )}
      </Card>

      <Modal
        open={!!disputeRow}
        onClose={() => setDisputeRow(null)}
        title={disputeRow ? `Request Grade Change — ${disputeRow.courseCode}` : ''}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setDisputeRow(null)}>Cancel</Button>
            <Button loading={submitting} onClick={submitDispute}>Send Request</Button>
          </>
        )}
      >
        {disputeRow && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-text-secondary dark:text-slate-400">
              Your current grade for <strong>{disputeRow.courseName}</strong> is{' '}
              <Badge variant={gradeBadge(disputeRow.grade)}>{disputeRow.grade}</Badge> ({disputeRow.marks?.total ?? '—'} marks).
              This will be sent to {disputeRow.teacher} for review.
            </p>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text dark:text-slate-200">Reason</label>
              <Textarea
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why you believe this grade should be reviewed..."
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
