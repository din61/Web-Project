import { useState } from 'react';
import { AdminApi } from '../../api/endpoints';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { Field, Input, Select } from '../../components/ui/FormControls';
import ErrorState from '../../components/ui/ErrorState';

const emptyForm = { name: '', email: '', password: '', teacherId: '', departmentId: '', designation: '', phone: '', officeHours: '' };

export default function AdminTeachers() {
  const [search, setSearch] = useState('');
  const { data, loading, error, refetch, setData } = useFetch(() => AdminApi.teachers({ search: search || undefined }), [search]);
  const { data: departments } = useFetch(() => AdminApi.departments(), []);
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

  const openEdit = (t) => {
    setEditing(t);
    setForm({ name: t.name, email: t.email, password: '', teacherId: t.teacherId, departmentId: t.departmentId || '', designation: t.designation || '', phone: t.phone || '', officeHours: t.officeHours || '' });
    setErrors({});
    setModalOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setErrors({});
    setSaving(true);
    try {
      if (editing) {
        await AdminApi.updateTeacher(editing.id, form);
        toast.success('Teacher updated successfully.');
      } else {
        await AdminApi.createTeacher(form);
        toast.success('Teacher created successfully.');
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

  const toggleStatus = async (t) => {
    const next = t.status === 'active' ? 'inactive' : 'active';
    try {
      await AdminApi.setTeacherStatus(t.id, next);
      setData((d) => d.map((x) => (x.id === t.id ? { ...x, status: next } : x)));
      toast.success(next === 'active' ? 'Teacher activated.' : 'Teacher deactivated.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await AdminApi.deleteTeacher(confirmDelete.id);
      toast.success('Teacher deleted successfully.');
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
          <h1 className="text-2xl font-bold text-text dark:text-slate-100">Teachers</h1>
          <p className="mt-1 text-sm text-text-secondary dark:text-slate-400">Manage teacher accounts.</p>
        </div>
        <Button icon="person_add" onClick={openAdd}>Add Teacher</Button>
      </div>

      <Card>
        <Input icon="search" placeholder="Search by name, ID, or email" value={search} onChange={(e) => setSearch(e.target.value)} />
      </Card>

      <Card noPadding title="All Teachers" subtitle={data ? `${data.length} teacher(s)` : undefined}>
        {error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : (
          <Table
            loading={loading}
            emptyMessage="No teachers found."
            columns={[
              { key: 'teacherId', label: 'Teacher ID' },
              { key: 'name', label: 'Name' },
              { key: 'email', label: 'Email' },
              { key: 'phone', label: 'Phone', render: (t) => t.phone || '—' },
              { key: 'department', label: 'Department' },
              { key: 'status', label: 'Status', render: (t) => <Badge variant={t.status === 'active' ? 'success' : 'neutral'} className="capitalize">{t.status}</Badge> },
              {
                key: 'actions',
                label: 'Actions',
                render: (t) => (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(t)} className="rounded p-1.5 text-text-secondary hover:bg-slate-100 hover:text-primary dark:hover:bg-slate-700" title="Edit">
                      <span className="material-symbols-rounded" style={{ fontSize: 18 }}>edit</span>
                    </button>
                    <button onClick={() => toggleStatus(t)} className="rounded p-1.5 text-text-secondary hover:bg-slate-100 hover:text-warning dark:hover:bg-slate-700" title={t.status === 'active' ? 'Deactivate' : 'Activate'}>
                      <span className="material-symbols-rounded" style={{ fontSize: 18 }}>{t.status === 'active' ? 'block' : 'check_circle'}</span>
                    </button>
                    <button onClick={() => setConfirmDelete(t)} className="rounded p-1.5 text-text-secondary hover:bg-red-50 hover:text-danger dark:hover:bg-red-950/40" title="Delete">
                      <span className="material-symbols-rounded" style={{ fontSize: 18 }}>delete</span>
                    </button>
                  </div>
                ),
              },
            ]}
            data={data}
          />
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Teacher' : 'Add Teacher'}
        width="max-w-lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving}>{editing ? 'Save Changes' : 'Create Teacher'}</Button>
          </>
        }
      >
        <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full Name" error={errors.name?.[0]} className="sm:col-span-2">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Teacher ID" error={errors.teacherId?.[0]}>
            <Input value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })} disabled={!!editing} required />
          </Field>
          <Field label="Email" error={errors.email?.[0]}>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!!editing} required />
          </Field>
          {!editing && (
            <Field label="Initial Password" error={errors.password?.[0]} className="sm:col-span-2">
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </Field>
          )}
          <Field label="Department" error={errors.departmentId?.[0]}>
            <Select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} required>
              <option value="">Select department...</option>
              {(departments || []).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Designation">
            <Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="e.g. Assistant Professor" />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Office Hours">
            <Input value={form.officeHours} onChange={(e) => setForm({ ...form, officeHours: e.target.value })} />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title="Delete teacher"
        message={`Are you sure you want to permanently delete ${confirmDelete?.name}? This cannot be undone. Teachers with assigned courses or results cannot be deleted — deactivate them instead.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </div>
  );
}
