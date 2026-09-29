import { useMemo, useState } from 'react';
import { NotificationApi } from '../../api/endpoints';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { Input, Select } from '../../components/ui/FormControls';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

const categoryMeta = {
  academic: { icon: 'menu_book', color: 'text-primary', bg: 'bg-blue-50' },
  results: { icon: 'grading', color: 'text-success', bg: 'bg-green-50' },
  exams: { icon: 'event', color: 'text-warning', bg: 'bg-amber-50' },
  attendance: { icon: 'event_available', color: 'text-danger', bg: 'bg-red-50' },
  general: { icon: 'campaign', color: 'text-secondary', bg: 'bg-teal-50' },
};

export default function Notifications() {
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  const query = useMemo(() => ({ category: category || undefined, search: search || undefined }), [category, search]);
  const { data, loading, error, refetch, setData } = useFetch(() => NotificationApi.list(query), [category, search]);

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const markAllRead = async () => {
    try {
      await NotificationApi.markAllRead();
      setData((d) => d.map((n) => ({ ...n, isRead: true })));
      toast.success('All notifications marked as read.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const markOneRead = async (id) => {
    try {
      await NotificationApi.markRead(id);
      setData((d) => d.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const deleteSelected = async () => {
    setDeleting(true);
    try {
      await NotificationApi.deleteMany(selected);
      setData((d) => d.filter((n) => !selected.includes(n.id)));
      toast.success(`${selected.length} notification(s) deleted.`);
      setSelected([]);
      setConfirmOpen(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <LoadingState label="Loading notifications..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text dark:text-slate-100">Notifications</h1>
          <p className="mt-1 text-sm text-text-secondary dark:text-slate-400">Stay up to date with academic activity.</p>
        </div>
        <div className="flex gap-2">
          {selected.length > 0 && (
            <Button variant="danger" icon="delete" onClick={() => setConfirmOpen(true)}>
              Delete Selected ({selected.length})
            </Button>
          )}
          <Button variant="secondary" icon="done_all" onClick={markAllRead}>Mark All as Read</Button>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap gap-3">
          <div className="min-w-[220px] flex-1">
            <Input icon="search" placeholder="Search notifications" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-52">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All Categories</option>
              <option value="academic">Academic</option>
              <option value="results">Results</option>
              <option value="exams">Exams</option>
              <option value="attendance">Attendance</option>
              <option value="general">General</option>
            </Select>
          </div>
        </div>
      </Card>

      <Card noPadding>
        {data.length === 0 ? (
          <EmptyState icon="notifications_off" message="No notifications found." />
        ) : (
          <ul className="divide-y divide-border dark:divide-slate-700">
            {data.map((n) => {
              const meta = categoryMeta[n.category] || categoryMeta.general;
              return (
                <li key={n.id} className={`flex items-start gap-3 px-5 py-4 ${!n.isRead ? 'bg-blue-50/40 dark:bg-blue-950/10' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selected.includes(n.id)}
                    onChange={() => toggle(n.id)}
                    className="mt-1.5 rounded border-border text-primary focus:ring-primary"
                  />
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.bg} ${meta.color}`}>
                    <span className="material-symbols-rounded" style={{ fontSize: 18 }}>{meta.icon}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-text dark:text-slate-100">{n.title}</p>
                      <Badge variant="neutral" className="capitalize">{n.category}</Badge>
                      {!n.isRead && <Badge variant="primary">New</Badge>}
                    </div>
                    <p className="mt-0.5 text-sm text-text-secondary dark:text-slate-400">{n.description}</p>
                    <p className="mt-1 text-xs text-text-secondary/70 dark:text-slate-500">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!n.isRead && (
                    <button
                      onClick={() => markOneRead(n.id)}
                      className="shrink-0 text-xs font-medium text-primary hover:underline"
                    >
                      Mark read
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={deleteSelected}
        title="Delete notifications"
        message={`Are you sure you want to delete ${selected.length} selected notification(s)? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </div>
  );
}
