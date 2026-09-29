import { useNavigate } from 'react-router-dom';
import { TeacherApi } from '../../api/endpoints';
import { useFetch } from '../../hooks/useFetch';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';

export default function Courses() {
  const { data, loading, error, refetch } = useFetch(() => TeacherApi.courses(), []);
  const navigate = useNavigate();

  if (loading) return <LoadingState label="Loading your courses..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const openCourse = (c) => {
    navigate(`/teacher/marks?courseId=${c.courseId}&semester=${c.semester}&year=${c.year}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text dark:text-slate-100">My Courses</h1>
        <p className="mt-1 text-sm text-text-secondary dark:text-slate-400">Courses assigned to you, across all semesters.</p>
      </div>

      {data.length === 0 ? (
        <Card><EmptyState icon="auto_stories" message="No courses assigned yet." /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => (
            <div key={`${c.courseId}-${c.semester}-${c.year}`} className="flex flex-col rounded-card border border-border bg-surface p-5 shadow-soft dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-text dark:text-slate-100">{c.courseCode}</p>
                  <p className="text-sm text-text-secondary dark:text-slate-400">{c.courseName}</p>
                </div>
                <Badge variant={c.status === 'active' ? 'success' : 'neutral'} className="capitalize">{c.status}</Badge>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-text-secondary dark:text-slate-400">Semester</p>
                  <p className="text-sm font-medium text-text dark:text-slate-100">{c.semester}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary dark:text-slate-400">Year</p>
                  <p className="text-sm font-medium text-text dark:text-slate-100">{c.year}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary dark:text-slate-400">Students</p>
                  <p className="text-sm font-medium text-text dark:text-slate-100">{c.studentsCount}</p>
                </div>
              </div>

              <Button className="mt-4" icon="open_in_new" onClick={() => openCourse(c)}>Open Course</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
