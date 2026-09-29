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

const emptyForm = { code: '', name: '', credit: '3', departmentId: '', semester: '', year: new Date().getFullYear() };

export default function AdminCourses() {
  const { data, loading, error, refetch, setData } = useFetch(() => AdminApi.courses(), []);
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

  const openEdit = (c) => {
    setEditing(c);
    setForm({ code: c.code, name: c.name, credit: String(c.credit), departmentId: c.departmentId || '', semester: c.semester || '', year: c.year || new Date().getFullYear() });
    setErrors({});
    setModalOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setErrors({});
    setSaving(true);
    try {
      if (editing) {
        await AdminApi.updateCourse(editing.id, form);
        toast.success('Course updated successfully.');
      } else {
        await AdminApi.createCourse(form);
        toast.success('Course created successfully.');
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

  const toggleStatus = async (c) => {
    const next = c.status === 'active' ? 'inactive' : 'active';
    try {
      await AdminApi.setCourseStatus(c.id, next);
      setData((d) => d.map((x) => (x.id === c.id ? { ...x, status: next } : x)));
      toast.success(next === 'active' ? 'Course activated.' : 'Course deactivated.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await AdminApi.deleteCourse(confirmDelete.id);
      toast.success('Course deleted successfully.');
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
          <h1 className="text-2xl font-bold text-text dark:text-slate-100">Courses</h1>
          <p className="mt-1 text-sm text-text-secondary dark:text-slate-400">Manage the course catalog.</p>
        </div>
        <Button icon="add" onClick={openAdd}>Add Course</Button>
      </div>

      <Card noPadding title="All Courses" subtitle={data ? `${data.length} course(s)` : undefined}>
        {error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : (
          <Table
            loading={loading}
            emptyMessage="No courses found."
            columns={[
              { key: 'code', label: 'Course Code' },
              { key: 'name', label: 'Course Title' },
              { key: 'credit', label: 'Credit' },
              { key: 'department', label: 'Department' },
              { key: 'semester', label: 'Semester', render: (c) => (c.semester ? `${c.semester} ${c.year}` : '—') },
              { key: 'teacher', label: 'Teacher', render: (c) => c.teacher || <span className="text-text-secondary/70">Unassigned</span> },
              { key: 'status', label: 'Status', render: (c) => <Badge variant={c.status === 'active' ? 'success' : 'neutral'} className="capitalize">{c.status}</Badge> },
              {
                key: 'actions',
                label: 'Actions',
                render: (c) => (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(c)} className="rounded p-1.5 text-text-secondary hover:bg-slate-100 hover:text-primary dark:hover:bg-slate-700" title="Edit">
                      <span className="material-symbols-rounded" style={{ fontSize: 18 }}>edit</span>
                    </button>
                    <button onClick={() => toggleStatus(c)} className="rounded p-1.5 text-text-secondary hover:bg-slate-100 hover:text-warning dark:hover:bg-slate-700" title={c.status === 'active' ? 'Deactivate' : 'Activate'}>
                      <span className="material-symbols-rounded" style={{ fontSize: 18 }}>{c.status === 'active' ? 'block' : 'check_circle'}</span>
                    </button>
                    <button onClick={() => setConfirmDelete(c)} className="rounded p-1.5 text-text-secondary hover:bg-red-50 hover:text-danger dark:hover:bg-red-950/40" title="Delete">
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
        title={editing ? 'Edit Course' : 'Add Course'}
        width="max-w-lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving}>{editing ? 'Save Changes' : 'Create Course'}</Button>
          </>
        }
      >
        <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Course Code" error={errors.code?.[0]}>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={!!editing} placeholder="e.g. CSE401" required />
          </Field>
          <Field label="Credit" error={errors.credit?.[0]}>
            <Input type="number" min="0.5" max="6" step="0.5" value={form.credit} onChange={(e) => setForm({ ...form, credit: e.target.value })} required />
          </Field>
          <Field label="Course Title" error={errors.name?.[0]} className="sm:col-span-2">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Department" error={errors.departmentId?.[0]}>
            <Select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} required>
              <option value="">Select department...</option>
              {(departments || []).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Semester" error={errors.semester?.[0]}>
              <Select value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} disabled={!!editing} required={!editing}>
                <option value="">Select...</option>
                <option value="Spring">Spring</option>
                <option value="Summer">Summer</option>
                <option value="Fall">Fall</option>
              </Select>
            </Field>
            <Field label="Year" error={errors.year?.[0]}>
              <Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} disabled={!!editing} required={!editing} />
            </Field>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title="Delete course"
        message={`Are you sure you want to permanently delete ${confirmDelete?.code}? This cannot be undone. Courses with existing enrollments or results cannot be deleted — deactivate them instead.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </div>
  );
}
