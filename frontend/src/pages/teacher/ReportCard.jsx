import { useState } from 'react';
import { TeacherApi } from '../../api/endpoints';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Select } from '../../components/ui/FormControls';
import LoadingState from '../../components/ui/LoadingState';
import EmptyState from '../../components/ui/EmptyState';

export default function ReportCard() {
  const { data: students, loading: loadingStudents } = useFetch(() => TeacherApi.students(), []);
  const toast = useToast();

  const [studentId, setStudentId] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const generate = async (id) => {
    setStudentId(id);
    if (!id) {
      setReport(null);
      return;
    }
    setLoading(true);
    try {
      const res = await TeacherApi.reportCard({ studentId: id });
      setReport(res.data);
    } catch (err) {
      toast.error(err.message);
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-text dark:text-slate-100">Report Card</h1>
          <p className="mt-1 text-sm text-text-secondary dark:text-slate-400">Generate a printable report card for any of your students.</p>
        </div>
        {report && (
          <div className="flex gap-2">
            <Button variant="secondary" icon="print" onClick={handlePrint}>Print</Button>
            <Button icon="download" onClick={handleDownload}>Download</Button>
          </div>
        )}
      </div>

      <Card className="print:hidden">
        <div className="max-w-sm">
          <label className="mb-1.5 block text-sm font-medium text-text dark:text-slate-200">Student</label>
          {loadingStudents ? (
            <LoadingState label="Loading students..." />
          ) : (
            <Select value={studentId} onChange={(e) => generate(e.target.value)}>
              <option value="">Search / select a student...</option>
              {(students || []).map((s) => (
                <option key={s.id} value={s.id}>{s.studentId} — {s.name}</option>
              ))}
            </Select>
          )}
        </div>
      </Card>

      {loading ? (
        <LoadingState label="Generating report card..." />
      ) : !report ? (
        <Card className="print:hidden"><EmptyState icon="description" message="Select a student above to generate their report card." /></Card>
      ) : (
        <Card>
          <div className="border-b border-border pb-4 text-center dark:border-slate-700">
            <h2 className="text-xl font-bold text-text dark:text-slate-100">{report.university.name}</h2>
            <p className="text-sm text-text-secondary dark:text-slate-400">{report.university.address}</p>
            <p className="mt-2 font-semibold text-primary">Official Report Card</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Student ID" value={report.student.studentId} />
            <Field label="Name" value={report.student.name} />
            <Field label="Department" value={report.student.department} />
            <Field label="CGPA" value={report.cgpa.toFixed(2)} />
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
                    <td className="px-3 py-2 text-text dark:text-slate-200">{r.totalMarks}</td>
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
      )}
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
