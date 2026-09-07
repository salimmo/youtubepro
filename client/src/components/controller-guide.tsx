import { FileText, Gamepad2, Image, Rocket, Search, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";

const guideItems = [
  { key: "research", icon: Search },
  { key: "scriptWriter", icon: FileText },
  { key: "thumbnail", icon: Image },
  { key: "settings", icon: Settings },
  { key: "newWorkflow", icon: Rocket },
] as const;

export function ControllerGuide() {
  const t = useT();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("script.guide.openAria")}
          title={t("script.guide.title")}
          data-testid="button-controller-guide"
        >
          <Gamepad2 className="h-5 w-5" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-primary" aria-hidden="true" />
            {t("script.guide.dialogTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("script.guide.dialogDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2" aria-label={t("script.guide.navAria")}>
          {guideItems.map((item) => (
            <section key={item.key} className="flex gap-3 rounded-lg border border-border bg-card p-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <item.icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">{t(`script.guide.${item.key}.label`)}</h2>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{t(`script.guide.${item.key}.description`)}</p>
              </div>
            </section>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          {t("script.guide.order")}
        </p>
      </DialogContent>
    </Dialog>
  );
}
