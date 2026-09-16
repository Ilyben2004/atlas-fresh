export function formatTonnes(value, digits = 1) {
  const n = Number(value ?? 0);
  return `${n.toFixed(digits)} t`;
}

export function formatNumber(value, digits = 1) {
  return Number(value ?? 0).toFixed(digits);
}

export function formatEuro(value) {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

export function formatEuroExact(value) {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

export function formatPct(value, digits = 1) {
  return `${Number(value ?? 0).toFixed(digits)}%`;
}

export function Icon({ name, className = "" }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

/** Large readable metric with semantic color. */
export function Metric({
  children,
  tone = "ink",
  size = "lg",
  className = "",
}) {
  const tones = {
    ink: "text-ink",
    deep: "text-ink-deep",
    good: "text-[#3f6b00]",
    accent: "text-[#546500]",
    warn: "text-[#9b4500]",
    danger: "text-[#991b1b]",
    muted: "text-muted",
  };
  const sizes = {
    xl: "text-[34px] leading-none md:text-[40px]",
    lg: "text-[28px] leading-none md:text-[32px]",
    md: "text-[18px] leading-tight md:text-[20px]",
    sm: "text-[13px] leading-tight",
  };

  return (
    <span className={`metric-number ${tones[tone] || tones.ink} ${sizes[size] || sizes.lg} ${className}`}>
      {children}
    </span>
  );
}
