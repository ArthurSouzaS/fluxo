import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import styles from './Field.module.scss';

interface FieldWrapperProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  hideLabel?: boolean;
  children: (props: {
    id: string;
    'aria-invalid'?: boolean;
    'aria-describedby'?: string;
  }) => ReactNode;
}

/** Envolve um controle com rótulo, dica e mensagem de erro ligados via aria. */
export function Field({ label, error, hint, hideLabel, children }: FieldWrapperProps) {
  const id = useId();
  const describedBy =
    [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={hideLabel ? 'visually-hidden' : styles.label}>
        {label}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {hint && !error ? (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: ReactNode;
  hideLabel?: boolean;
};

export const TextInput = forwardRef<HTMLInputElement, InputProps>(function TextInput(
  { label, error, hint, hideLabel, className, ...props },
  ref,
) {
  return (
    <Field label={label} error={error} hint={hint} hideLabel={hideLabel}>
      {(aria) => (
        <input
          ref={ref}
          className={[styles.control, className].filter(Boolean).join(' ')}
          {...aria}
          {...props}
        />
      )}
    </Field>
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  hint?: ReactNode;
  hideLabel?: boolean;
};

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaProps>(function TextArea(
  { label, error, hint, hideLabel, className, ...props },
  ref,
) {
  return (
    <Field label={label} error={error} hint={hint} hideLabel={hideLabel}>
      {(aria) => (
        <textarea
          ref={ref}
          className={[styles.control, styles.textarea, className].filter(Boolean).join(' ')}
          {...aria}
          {...props}
        />
      )}
    </Field>
  );
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  hideLabel?: boolean;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hideLabel, className, children, ...props },
  ref,
) {
  return (
    <Field label={label} error={error} hideLabel={hideLabel}>
      {(aria) => (
        <select
          ref={ref}
          className={[styles.control, styles.select, className].filter(Boolean).join(' ')}
          {...aria}
          {...props}
        >
          {children}
        </select>
      )}
    </Field>
  );
});

export { styles as fieldStyles };
