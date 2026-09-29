import { useState } from 'react';
import { AdminApi } from '../../api/endpoints';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { Field, Input, Select } from '../../components/ui/FormControls';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import EmptyState from '../../components/ui/EmptyState';

const emptyForm = { name: '', year: new Date().getFullYear(), startDate: '', endDate: '' };

export default function AdminSemesters() {
  const { data, loading, error, refetch, setData } = useFetch(() => AdminApi.semesters(), []);
  const toast = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({ name: s.name, year: s.year, startDate: s.startDate || '', endDate: s.endDate || '' });
    setErrors({});
    setModalOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setErrors({});
    setSaving(true);
    try {
      if (editing) {
        await AdminApi.updateSemester(editing.id, form);
        toast.success('Semester updated successfully.');
      } else {
        await AdminApi.createSemester(form);
        toast.success('Semester created successfully.');
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      setErrors(err.errors || {});
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (s) => {
    try {
      if (s.status === 'active') {
        await AdminApi.deactivateSemester(s.id);
        toast.success('Semester deactivated.');
      } else {
        await AdminApi.activateSemester(s.id);
        toast.success(`${s.label} is now the active semester.`);
      }
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await AdminApi.deleteSemester(confirmDelete.id);
      toast.success('Semester deleted successfully.');
      setConfirmDelete(null);
      refetch();
    } catch (err) {
      toast.error(err.message);
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text dark:text-slate-100">Semesters</h1>
          <p className="mt-1 text-sm text-text-secondary dark:text-slate-400">Exactly one semester is active — every other module reads it as "current".</p>
        </div>
        <Button icon="add" onClick={openAdd}>Add Semester</Button>
      </div>

      {loading ? (
        <LoadingState label="Loading semesters..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : data.length === 0 ? (
        <Card><EmptyState icon="calendar_month" message="No semesters yet." /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((s) => (
            <div key={s.id} className="flex flex-col rounded-card border border-border bg-surface p-5 shadow-soft dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-start justify-between">
                <p className="font-semibold text-text dark:text-slate-100">{s.label}</p>
                <Badge variant={s.status === 'active' ? 'success' : 'neutral'} className="capitalize">{s.status === 'active' ? 'Current' : 'Inactive'}</Badge>
              </div>
              {(s.startDate || s.endDate) && (
                <p className="mt-2 text-xs text-text-secondary dark:text-slate-400">
                  {s.startDate || '—'} → {s.endDate || '—'}
                </p>
              )}
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="secondary" icon="edit" onClick={() => openEdit(s)}>Edit</Button>
                <Button
                  size="sm"
                  variant={s.status === 'active' ? 'secondary' : 'primary'}
                  icon={s.status === 'active' ? 'toggle_off' : 'toggle_on'}
                  onClick={() => toggle(s)}
                >
                  {s.status === 'active' ? 'Deactivate' : 'Activate'}
                </Button>
                <Button size="sm" variant="danger" icon="delete" onClick={() => setConfirmDelete(s)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Semester' : 'Add Semester'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving}>{editing ? 'Save Changes' : 'Create Semester'}</Button>
          </>
        }
      >
        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Semester Name" error={errors.name?.[0]}>
              <Select value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!!editing} required>
                <option value="">Select...</option>
                <option value="Spring">Spring</option>
                <option value="Summer">Summer</option>
                <option value="Fall">Fall</option>
              </Select>
            </Field>
            <Field label="Academic Year" error={errors.year?.[0]}>
              <Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} disabled={!!editing} required />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start Date">
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </Field>
            <Field label="End Date">
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </Field>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title="Delete semester"
        message={`Are you sure you want to permanently delete ${confirmDelete?.label}? Semesters that already have academic records cannot be deleted — deactivate instead.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </div>
  );
}
