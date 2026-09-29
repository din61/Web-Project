import { useParentContext } from '../../context/ParentContext';
import { Select } from '../ui/FormControls';

export default function ChildSwitcher() {
  const { children, selectedChildId, selectChild, loading } = useParentContext();

  if (loading || children.length <= 1) return null;

  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 shadow-soft dark:border-slate-700 dark:bg-slate-800">
      <span className="material-symbols-rounded text-primary">family_restroom</span>
      <p className="text-sm font-medium text-text dark:text-slate-200">Viewing:</p>
      <Select value={selectedChildId} onChange={(e) => selectChild(e.target.value)} className="max-w-xs">
        {children.map((c) => (
          <option key={c.id} value={c.id}>{c.name} ({c.studentId})</option>
        ))}
      </Select>
    </div>
  );
}
