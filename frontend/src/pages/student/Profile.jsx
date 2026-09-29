import { useEffect, useState } from 'react';
import { StudentApi } from '../../api/endpoints';
import { useFetch } from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { Field, Input, Textarea } from '../../components/ui/FormControls';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';

export default function Profile() {
  const { data, loading, error, refetch } = useFetch(() => StudentApi.getProfile(), []);
  const { user, setUser } = useAuth();
  const toast = useToast();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const [pwOpen, setPwOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwErrors, setPwErrors] = useState({});

  useEffect(() => {
    if (data) setForm({ name: data.name, phone: data.phone, address: data.address });
  }, [data]);

  if (loading) return <LoadingState label="Loading profile..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const save = async (e) => {
    e.preventDefault();
    setErrors({});
    setSaving(true);
    try {
      await StudentApi.updateProfile(form);
      toast.success('Profile updated successfully.');
      setEditing(false);
      refetch();
      const updatedUser = { ...user, name: form.name };
      setUser(updatedUser);
      localStorage.setItem('srms_user', JSON.stringify(updatedUser));
    } catch (err) {
      setErrors(err.errors || {});
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwErrors({});
    setPwSaving(true);
    try {
      await StudentApi.changePassword(pwForm);
      toast.success('Password changed successfully.');
      setPwOpen(false);
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPwErrors(err.errors || {});
      toast.error(err.message);
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text dark:text-slate-100">My Profile</h1>
          <p className="mt-1 text-sm text-text-secondary dark:text-slate-400">Manage your personal information.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon="lock" onClick={() => setPwOpen(true)}>Change Password</Button>
          {!editing && <Button icon="edit" onClick={() => setEditing(true)}>Edit</Button>}
        </div>
      </div>

      <Card>
        <div className="flex flex-col items-center gap-4 border-b border-border pb-6 sm:flex-row dark:border-slate-700">
          <img
            src={data.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${data.name}`}
            alt={data.name}
            className="h-24 w-24 rounded-full border border-border object-cover dark:border-slate-600"
          />
          <div className="text-center sm:text-left">
            <h2 className="text-xl font-bold text-text dark:text-slate-100">{data.name}</h2>
            <p className="text-sm text-text-secondary dark:text-slate-400">{data.studentId}</p>
            <p className="text-sm text-text-secondary dark:text-slate-400">{data.department} &middot; {data.currentSemester}</p>
          </div>
        </div>

        {!editing ? (
          <dl className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <InfoRow icon="badge" label="Student ID" value={data.studentId} />
            <InfoRow icon="mail" label="Email" value={data.email} />
            <InfoRow icon="call" label="Phone" value={data.phone || '—'} />
            <InfoRow icon="home" label="Address" value={data.address || '—'} />
            <InfoRow icon="apartment" label="Department" value={data.department} />
            <InfoRow icon="calendar_month" label="Semester" value={data.currentSemester} />
          </dl>
        ) : (
          <form onSubmit={save} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full Name" error={errors.name?.[0]}>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" icon="save" loading={saving}>Save</Button>
              <Button type="button" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </form>
        )}
      </Card>

      <Modal
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        title="Change Password"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPwOpen(false)}>Cancel</Button>
            <Button onClick={changePassword} loading={pwSaving}>Update Password</Button>
          </>
        }
      >
        <form onSubmit={changePassword} className="flex flex-col gap-4">
          <Field label="Current Password" error={pwErrors.currentPassword?.[0]}>
            <Input type="password" value={pwForm.currentPassword} onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} required />
          </Field>
          <Field label="New Password" error={pwErrors.newPassword?.[0]}>
            <Input type="password" value={pwForm.newPassword} onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} required />
          </Field>
          <Field label="Confirm New Password" error={pwErrors.confirmPassword?.[0]}>
            <Input type="password" value={pwForm.confirmPassword} onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })} required />
          </Field>
        </form>
      </Modal>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <span className="material-symbols-rounded mt-0.5 text-primary">{icon}</span>
      <div>
        <dt className="text-xs text-text-secondary dark:text-slate-400">{label}</dt>
        <dd className="font-medium text-text dark:text-slate-100">{value}</dd>
      </div>
    </div>
  );
}
