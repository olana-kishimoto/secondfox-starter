import { cn } from "@/lib/cn";

const inputBase =
  "w-full rounded border border-line bg-surface px-3 py-[7px] text-[13px] text-text " +
  "placeholder:text-muted focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent-soft " +
  "disabled:bg-base disabled:text-muted";

export function Label({
  htmlFor,
  required,
  children,
  className,
}: {
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "mb-1 block text-[10px] uppercase tracking-[0.14em] text-muted",
        className,
      )}
    >
      {children}
      {required && <span className="ml-1 text-accent">*</span>}
    </label>
  );
}

export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
      {children}
      {hint && (
        <p className="mt-0.5 text-[11px] leading-[1.6] text-muted">{hint}</p>
      )}
      {error && (
        <p className="mt-0.5 text-[11px] leading-[1.6] text-bad">{error}</p>
      )}
    </div>
  );
}

export function Input({
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cn(inputBase, className)} />;
}

export function Textarea({
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...rest} className={cn(inputBase, "min-h-[80px]", className)} />
  );
}

export function Select({
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cn(inputBase, "pr-9", className)}>
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label
      className={cn(
        "inline-flex items-center gap-2 text-[12.5px] tracking-[0.04em] text-text",
        className,
      )}
    >
      <input
        type="checkbox"
        {...rest}
        className="h-4 w-4 rounded border-line text-accent accent-accent focus:ring-accent-soft"
      />
      {label}
    </label>
  );
}
