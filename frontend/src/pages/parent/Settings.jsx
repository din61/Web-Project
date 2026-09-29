import { useEffect, useState } from 'react';
import { SettingsApi } from '../../api/endpoints';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useTheme } from '../../context/ThemeContext';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Toggle, Select } from '../../components/ui/FormControls';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';

export default function ParentSettings() {
  const { data, loading, error, refetch } = useFetch(() => SettingsApi.get(), []);
  const { setTheme } = useTheme();
  const toast = useToast();

  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (loading || !form) return <LoadingState label="Loading settings..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      await SettingsApi.update(form);
      setTheme(form.theme);
      toast.success('Settings saved successfully.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setForm(data);
    setTheme(data.theme);
    toast.info('Changes discarded.');
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text dark:text-slate-100">Settings</h1>
        <p className="mt-1 text-sm text-text-secondary dark:text-slate-400">Manage your account preferences.</p>
      </div>

      <Card title="Appearance">
        <div className="flex flex-col divide-y divide-border dark:divide-slate-700">
          <Toggle
            label="Dark Mode"
            description="Switch between light and dark themes"
            checked={form.theme === 'dark'}
            onChange={(v) => set('theme')(v ? 'dark' : 'light')}
          />
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-text dark:text-slate-200">Language</p>
              <p className="text-xs text-text-secondary dark:text-slate-400">Choose your preferred language</p>
            </div>
            <Select value={form.language} onChange={(e) => set('language')(e.target.value)} className="w-40">
              <option value="en">English</option>
              <option value="bn">বাংলা</option>
            </Select>
          </div>
        </div>
      </Card>

      <Card title="Notification Preferences">
        <div className="flex flex-col divide-y divide-border dark:divide-slate-700">
          <Toggle label="Email Notifications" description="Receive updates via email" checked={form.emailNotifications} onChange={set('emailNotifications')} />
          <Toggle label="Result Notifications" description="Notify me when a new result is published for my child" checked={form.resultNotifications} onChange={set('resultNotifications')} />
          <Toggle label="Attendance Alerts" description="Notify me about my child's attendance" checked={form.attendanceNotifications} onChange={set('attendanceNotifications')} />
          <Toggle label="Exam Notices" description="Notify me about upcoming exams" checked={form.examReminders} onChange={set('examReminders')} />
        </div>
      </Card>

      <Card title="Privacy Settings">
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-text dark:text-slate-200">Profile Visibility</p>
            <p className="text-xs text-text-secondary dark:text-slate-400">Who can see your profile information</p>
          </div>
          <Select value={form.profileVisibility} onChange={(e) => set('profileVisibility')(e.target.value)} className="w-48">
            <option value="university">University Only</option>
            <option value="private">Private</option>
          </Select>
        </div>
      </Card>

      <div className="flex gap-2">
        <Button icon="save" loading={saving} onClick={save}>Save Changes</Button>
        <Button variant="secondary" onClick={cancel}>Cancel</Button>
      </div>
    </div>
  );
}
