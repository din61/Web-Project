import { useFetch } from '../../hooks/useFetch';
import { NotificationApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';

export default function AdminNotifications() {
  const { data, loading, error, refetch, setData } = useFetch(() => NotificationApi.list(), []);
  const toast = useToast();

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

  if (loading) return <LoadingState label="Loading notifications..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text dark:text-slate-100">Notifications</h1>
          <p className="mt-1 text-sm text-text-secondary dark:text-slate-400">System notifications.</p>
        </div>
        <Button variant="secondary" icon="done_all" onClick={markAllRead}>Mark All as Read</Button>
      </div>

      <Card noPadding>
        {data.length === 0 ? (
          <EmptyState icon="notifications_off" message="No notifications." />
        ) : (
          <ul className="divide-y divide-border dark:divide-slate-700">
            {data.map((n) => (
              <li key={n.id} className={`flex items-start gap-3 px-5 py-4 ${!n.isRead ? 'bg-blue-50/40 dark:bg-blue-950/10' : ''}`}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <span className="material-symbols-rounded" style={{ fontSize: 18 }}>campaign</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-text dark:text-slate-100">{n.title}</p>
                    {!n.isRead && <Badge variant="primary">New</Badge>}
                  </div>
                  <p className="mt-0.5 text-sm text-text-secondary dark:text-slate-400">{n.description}</p>
                  <p className="mt-1 text-xs text-text-secondary/70 dark:text-slate-500">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
                {!n.isRead && (
                  <button onClick={() => markOneRead(n.id)} className="shrink-0 text-xs font-medium text-primary hover:underline">
                    Mark read
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
