import { ParentApi } from '../../api/endpoints';
import { useFetch } from '../../hooks/useFetch';
import { useParentContext } from '../../context/ParentContext';
import { useToast } from '../../context/ToastContext';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import ChildSwitcher from '../../components/layout/ChildSwitcher';

export default function ParentReportCard() {
  const { selectedChildId } = useParentContext();
  const toast = useToast();
  const { data: report, loading, error, refetch } = useFetch(
    () => ParentApi.reportCard(selectedChildId ? { studentId: selectedChildId } : {}),
    [selectedChildId]
  );

  const handlePrint = () => window.print();

  const handleDownload = () => {
    if (!report) return;
    const header = ['Course Code', 'Course Name', 'Credit', 'Semester', 'Year', 'Marks', 'Grade', 'Grade Point', 'Teacher Comment'];
    const rows = report.results.map((r) => [r.courseCode, r.courseName, r.credit, r.semester, r.year, r.totalMarks, r.grade, r.gradePoint, r.teacherComment]);
    const csv = [header, ...rows].map((row) => row.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report.student.studentId}-report-card.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Report card downloaded.');
  };

  if (loading) return <LoadingState label="Generating report card..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-text dark:text-slate-100">Report Card</h1>
          <p className="mt-1 text-sm text-text-secondary dark:text-slate-400">Printable/downloadable report card for your child.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon="print" onClick={handlePrint}>Print</Button>
          <Button icon="download" onClick={handleDownload}>Download</Button>
        </div>
      </div>

      <div className="print:hidden"><ChildSwitcher /></div>

      <Card>
        <div className="border-b border-border pb-4 text-center dark:border-slate-700">
          <h2 className="text-xl font-bold text-text dark:text-slate-100">{report.university.name}</h2>
          <p className="text-sm text-text-secondary dark:text-slate-400">{report.university.address}</p>
          <p className="mt-2 font-semibold text-primary">Official Report Card</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Field label="Student ID" value={report.student.studentId} />
          <Field label="Name" value={report.student.name} />
          <Field label="Department" value={report.student.department} />
          <Field label="CGPA" value={report.cgpa.toFixed(2)} />
          <Field label="Attendance" value={`${report.attendancePercent}%`} />
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-text-secondary dark:border-slate-700 dark:text-slate-400">
                <th className="px-3 py-2 font-medium">Course</th>
                <th className="px-3 py-2 font-medium">Semester</th>
                <th className="px-3 py-2 font-medium">Credit</th>
                <th className="px-3 py-2 font-medium">Marks</th>
                <th className="px-3 py-2 font-medium">Grade</th>
                <th className="px-3 py-2 font-medium">GP</th>
                <th className="px-3 py-2 font-medium">Comment</th>
              </tr>
            </thead>
            <tbody>
              {report.results.map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0 dark:border-slate-700">
                  <td className="px-3 py-2">
                    <p className="font-medium text-text dark:text-slate-100">{r.courseCode}</p>
                    <p className="text-xs text-text-secondary dark:text-slate-400">{r.courseName}</p>
                  </td>
                  <td className="px-3 py-2 text-text dark:text-slate-200">{r.semester} {r.year}</td>
                  <td className="px-3 py-2 text-text dark:text-slate-200">{r.credit}</td>
                  <td className="px-3 py-2 text-text dark:text-slate-200">{r.totalMarks ?? '—'}</td>
                  <td className="px-3 py-2 font-semibold text-primary">{r.grade}</td>
                  <td className="px-3 py-2 text-text dark:text-slate-200">{r.gradePoint}</td>
                  <td className="px-3 py-2 text-xs text-text-secondary dark:text-slate-400">{r.teacherComment}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.results.length === 0 && <EmptyState message="No published results yet for this student." />}
        </div>
      </Card>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs text-text-secondary dark:text-slate-400">{label}</p>
      <p className="font-semibold text-text dark:text-slate-100">{value}</p>
    </div>
  );
}
