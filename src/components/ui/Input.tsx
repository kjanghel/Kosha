import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string | null;
}

const fieldClass =
  'w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent ' +
  'placeholder:text-slate-400';

export function Input({ label, hint, error, className = '', id, ...rest }: InputProps) {
  const inputId = id ?? rest.name;
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-slate-600">
          {label}
        </label>
      )}
      <input id={inputId} className={`${fieldClass} ${className}`} {...rest} />
      {(error || hint) && (
        <p className={`text-xs ${error ? 'text-red-600' : 'text-slate-500'}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
}

export function Textarea({ label, hint, className = '', id, ...rest }: TextareaProps) {
  const inputId = id ?? rest.name;
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-slate-600">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={`${fieldClass} h-24 pt-2 pb-2 ${className}`}
        {...rest}
      />
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
