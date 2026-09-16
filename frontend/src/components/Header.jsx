import { Icon } from "../utils/format.jsx";

export default function Header({
  onUploadClick,
  uploading,
  live,
  filename,
  sidebarOpen,
  onToggleSidebar,
  activeLabel,
}) {
  return (
    <header className="z-40 shrink-0 border-b border-line bg-white">
      <div className="flex h-14 items-center justify-between gap-4 px-4 md:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-canvas text-ink transition-colors hover:border-accent hover:bg-chip-bg"
            title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          >
            <Icon name={sidebarOpen ? "left_panel_close" : "left_panel_open"} />
          </button>

          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">
              <Icon name="eco" className="text-[20px]" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-base font-bold leading-none tracking-tight text-ink md:text-lg">
                Atlas Fresh
              </div>
              <div className="mt-1 truncate font-mono text-[10px] font-medium tracking-wide text-muted">
                {activeLabel} · Export Decision Support
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div
            className={`hidden items-center gap-2 rounded-sm border px-2.5 py-1 sm:flex ${
              live
                ? "border-[#9aae37]/60 bg-chip-bg text-ink"
                : "border-line bg-canvas text-muted"
            }`}
          >
            <span className="relative flex h-2 w-2">
              {live ? (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              ) : null}
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  live ? "bg-accent" : "bg-[#c6c8b2]"
                }`}
              />
            </span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider">
              {live ? "Live · Synchronized" : "Awaiting Workbook"}
            </span>
          </div>

          {filename ? (
            <span className="hidden max-w-[160px] truncate font-mono text-[11px] text-muted lg:inline">
              {filename}
            </span>
          ) : null}

          <button
            type="button"
            onClick={onUploadClick}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent-border bg-accent-strong px-3.5 py-1.5 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-95 disabled:cursor-wait disabled:opacity-70"
          >
            <Icon name="cloud_upload" className="text-[16px]" />
            <span className="hidden sm:inline">
              {uploading ? "Uploading…" : "Upload New Data"}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
