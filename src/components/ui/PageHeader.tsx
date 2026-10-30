export function PageHeader({
  eyebrow,
  title,
  description,
  right,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-line pb-5 md:mb-8 md:flex-row md:items-end md:justify-between md:gap-4 md:pb-6">
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <div className="mb-1 text-[10px] uppercase tracking-[0.3em] text-accent">
            {eyebrow}
          </div>
        )}
        <h1 className="text-[18px] font-semibold tracking-[0.06em] text-text md:text-[22px] md:tracking-[0.08em]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-[12px] leading-[1.8] text-muted md:text-[12.5px]">
            {description}
          </p>
        )}
      </div>
      {right && (
        <div className="flex flex-wrap items-center gap-2">{right}</div>
      )}
    </div>
  );
}
