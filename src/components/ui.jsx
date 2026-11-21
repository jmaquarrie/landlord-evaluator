// Shared UI building blocks. Every page uses these so spacing, type and colour stay consistent.
import { useEffect, useId, useState } from 'react';

export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function Card({ title, subtitle, actions, children, className, padded = true }) {
  return (
    <section className={cx('rounded-xl border border-slate-200 bg-white', padded && 'p-5', className)}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

const TONES = {
  neutral: 'bg-slate-100 text-slate-700',
  accent: 'bg-indigo-50 text-indigo-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-800',
  danger: 'bg-rose-50 text-rose-700',
};

export const TONE_TEXT = {
  neutral: 'text-slate-900',
  success: 'text-emerald-700',
  warning: 'text-amber-700',
  danger: 'text-rose-700',
  accent: 'text-indigo-700',
};

export function Tag({ tone = 'neutral', children, className, title }) {
  return (
    <span title={title} className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium', TONES[tone], className)}>
      {children}
    </span>
  );
}

export function Metric({ label, value, hint, tone = 'neutral', size = 'md' }) {
  return (
    <div className="rounded-lg bg-slate-50 px-4 py-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={cx('mt-0.5 font-semibold tabular-nums', size === 'lg' ? 'text-2xl' : 'text-xl', TONE_TEXT[tone])}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function Button({ variant = 'secondary', size = 'md', className, children, ...props }) {
  const styles = {
    primary: 'bg-slate-900 text-white hover:bg-slate-700 border-slate-900',
    secondary: 'bg-white text-slate-800 hover:bg-slate-50 border-slate-300',
    ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 border-transparent',
    danger: 'bg-white text-rose-700 hover:bg-rose-50 border-rose-200',
  };
  const sizes = { sm: 'h-8 px-3 text-xs', md: 'h-9 px-4 text-sm' };
  return (
    <button
      type="button"
      className={cx('inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition disabled:cursor-not-allowed disabled:opacity-50', styles[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function Segmented({ value, onChange, options, size = 'md', label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-md font-medium transition',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            value === o.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children, className }) {
  const id = useId();
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-slate-600">
          {label}
        </label>
      )}
      {typeof children === 'function' ? children(id) : children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

const inputClass =
  'h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';

export function TextInput({ label, hint, value, onChange, className, ...props }) {
  return (
    <Field label={label} hint={hint} className={className}>
      {(id) => <input id={id} className={inputClass} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...props} />}
    </Field>
  );
}

export function Select({ label, hint, value, onChange, options, className }) {
  return (
    <Field label={label} hint={hint} className={className}>
      {(id) => (
        <select id={id} className={inputClass} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function TextArea({ label, value, onChange, rows = 4, className, ...props }) {
  return (
    <Field label={label} className={className}>
      {(id) => (
        <textarea
          id={id}
          rows={rows}
          className={cx(inputClass, 'h-auto py-2')}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          {...props}
        />
      )}
    </Field>
  );
}

/**
 * Number input that formats as you leave it. kind: 'money' | 'percent' | 'number'.
 * Percent values are stored as fractions (0.05) and shown as 5.
 */
export function NumberInput({ label, hint, value, onChange, kind = 'number', step, min, max, className, suffix }) {
  const toText = (v) => {
    if (!Number.isFinite(v)) return '';
    if (kind === 'percent') return String(Math.round(v * 10000) / 100);
    if (kind === 'money') return Math.round(v).toLocaleString('en-GB');
    return String(v);
  };
  const [text, setText] = useState(toText(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(toText(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused]);
  const commit = (raw) => {
    const n = Number(String(raw).replace(/[^0-9.\-]/g, ''));
    if (raw === '' || !Number.isFinite(n)) return;
    let v = kind === 'percent' ? n / 100 : n;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    onChange(v);
  };
  const prefix = kind === 'money' ? '£' : null;
  const unit = suffix ?? (kind === 'percent' ? '%' : null);
  return (
    <Field label={label} hint={hint} className={className}>
      {(id) => (
        <div className="relative">
          {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{prefix}</span>}
          <input
            id={id}
            inputMode="decimal"
            className={cx(inputClass, 'tabular-nums', prefix && 'pl-7', unit && 'pr-9')}
            value={text}
            step={step}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              commit(text);
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            onChange={(e) => {
              setText(e.target.value);
              commit(e.target.value);
            }}
          />
          {unit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{unit}</span>}
        </div>
      )}
    </Field>
  );
}

/** Labelled slider with live value. */
export function Slider({ label, value, onChange, min, max, step = 1, format = (v) => v }) {
  const id = useId();
  return (
    <div className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)_72px] items-center gap-3 py-1">
      <label htmlFor={id} className="text-sm text-slate-600">
        {label}
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-slate-900" />
      <span className="text-right text-sm font-semibold tabular-nums text-slate-900">{format(value)}</span>
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-5 w-9 rounded-full bg-slate-300 transition peer-checked:bg-slate-900 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-300" />
        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-4" />
      </span>
      <span>
        <span className="block text-sm text-slate-800">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-slate-200" aria-label="Sections">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          aria-current={active === t.id ? 'page' : undefined}
          className={cx(
            'whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition',
            active === t.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800',
          )}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}

export function EmptyState({ title, body, action, icon = '○' }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <div className="mb-3 text-2xl text-slate-300" aria-hidden="true">
        {icon}
      </div>
      <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
      {body && <p className="mt-1 max-w-md text-sm text-slate-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({ tone = 'neutral', children }) {
  const styles = {
    neutral: 'border-slate-200 bg-slate-50 text-slate-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-rose-200 bg-rose-50 text-rose-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  };
  return <div className={cx('rounded-lg border px-3 py-2 text-sm', styles[tone])}>{children}</div>;
}

export function Row({ label, value, strong, tone, hint }) {
  return (
    <div className={cx('flex items-baseline justify-between gap-4 border-t border-slate-100 py-2 text-sm first:border-t-0', strong && 'font-semibold')}>
      <span className={strong ? 'text-slate-900' : 'text-slate-600'}>
        {label}
        {hint && <span className="ml-1 text-xs font-normal text-slate-400">{hint}</span>}
      </span>
      <span className={cx('tabular-nums', tone ? TONE_TEXT[tone] : 'text-slate-900')}>{value}</span>
    </div>
  );
}

export function Modal({ open, title, onClose, children, footer, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx('w-full rounded-xl bg-white shadow-xl', wide ? 'max-w-3xl' : 'max-w-lg')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            ✕
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

export function Spinner({ label = 'Loading' }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" aria-hidden="true" />
      {label}
    </span>
  );
}

export function verdictTone(verdict) {
  return { works: 'success', tight: 'warning', fails: 'danger' }[verdict] ?? 'neutral';
}

export function scoreTone(score) {
  if (score >= 75) return 'success';
  if (score >= 55) return 'warning';
  return 'danger';
}
