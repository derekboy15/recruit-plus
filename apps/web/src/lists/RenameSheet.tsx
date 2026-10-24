import { useId, useState, type FormEvent } from 'react';
import { Sheet } from '../ui/Sheet';

/** "Rename list": the name in a text box and Save. An empty name is refused. */
export function RenameSheet({ name, onSave, onClose }: { name: string; onSave: (name: string) => void; onClose: () => void }) {
  const id = useId();
  const [value, setValue] = useState(name);
  const [error, setError] = useState(false);
  const save = (e: FormEvent) => {
    e.preventDefault();
    const next = value.trim();
    if (!next) return setError(true);
    onSave(next);
  };
  return (
    <Sheet
      title="Rename list"
      onClose={onClose}
      footer={
        <button type="submit" form={`${id}-form`} className="btn btn--primary">
          Save
        </button>
      }
    >
      <form id={`${id}-form`} className="rename" onSubmit={save} noValidate>
        <label htmlFor={`${id}-name`} className="label-caps">
          List name
        </label>
        <input
          id={`${id}-name`}
          className="input"
          value={value}
          autoComplete="off"
          aria-invalid={error || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => {
            setValue(e.target.value);
            setError(false);
          }}
        />
        {error && (
          <p id={`${id}-error`} role="alert" className="field-error">
            Give the list a name.
          </p>
        )}
      </form>
    </Sheet>
  );
}
