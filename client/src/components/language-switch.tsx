import { useI18n, type UiLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Sprachumschalter mit Flaggen (Deutsch / Englisch). Inline-SVG statt
// Emoji-Flaggen, weil Windows keine Flaggen-Emojis darstellt.

function GermanFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 5 3" className={className} aria-hidden="true" focusable="false">
      <rect width="5" height="3" fill="#000" />
      <rect width="5" height="2" y="1" fill="#D00" />
      <rect width="5" height="1" y="2" fill="#FFCE00" />
    </svg>
  );
}

function BritishFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 30" className={className} aria-hidden="true" focusable="false">
      <clipPath id="uk-flag-clip">
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#uk-flag-clip)" stroke="#C8102E" strokeWidth="4" />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}

const OPTIONS: ReadonlyArray<{ code: UiLanguage; label: string; Flag: typeof GermanFlag }> = [
  { code: "de", label: "Deutsch", Flag: GermanFlag },
  { code: "en", label: "English", Flag: BritishFlag },
];

export function LanguageSwitch({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { language, setLanguage, t } = useI18n();
  return (
    <div
      role="radiogroup"
      aria-label={t("common.language")}
      className={cn("inline-flex items-center gap-1 rounded-md border border-border bg-background/60 p-0.5", className)}
      data-testid="language-switch"
    >
      {OPTIONS.map(({ code, label, Flag }) => {
        const active = language === code;
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setLanguage(code)}
            data-testid={`language-${code}`}
            className={cn(
              "flex items-center gap-1.5 rounded px-1.5 py-1 text-xs font-medium transition-colors",
              active ? "bg-primary/15 text-foreground ring-1 ring-primary/40" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Flag className="h-3.5 w-5 rounded-[2px] shadow-sm" />
            {!compact && <span>{code.toUpperCase()}</span>}
          </button>
        );
      })}
    </div>
  );
}
