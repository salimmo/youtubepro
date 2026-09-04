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

const guideItems = [
  {
    label: "Recherche",
    icon: Search,
    description: "Durchsuche YouTube, vergleiche öffentliche Videodaten, generiere fundierte KI-Insights und wähle eine Idee.",
  },
  {
    label: "Skript-Writer",
    icon: FileText,
    description: "Mach aus einer Idee ein Skript und lies es im integrierten Teleprompter mit Wiedergabe-, Tempo- und Textgrößen-Steuerung ab.",
  },
  {
    label: "Thumbnail-Creator",
    icon: Image,
    description: "Erstelle ein Thumbnail aus einem visuellen Briefing, einer optionalen Vorlage und zulässigen Referenzbildern.",
  },
  {
    label: "Einstellungen",
    icon: Settings,
    description: "Hinterlege lokale API-Schlüssel und wähle die Gemini-Modelle für Text und Bild.",
  },
  {
    label: "Neuer Workflow",
    icon: Rocket,
    description: "Leert die aktuelle Sitzung nach Bestätigung und beginnt wieder bei der Recherche.",
  },
] as const;

export function ControllerGuide() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Bedienungshilfe öffnen"
          title="Bedienungshilfe"
          data-testid="button-controller-guide"
        >
          <Gamepad2 className="h-5 w-5" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-primary" aria-hidden="true" />
            YouTube Pro Bedienungshinweis
          </DialogTitle>
          <DialogDescription>
            Nutze die folgenden Seitenleisten-Bezeichnungen, um dich im Arbeitsbereich zu bewegen.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2" aria-label="YouTube Pro Navigationshilfe">
          {guideItems.map((item) => (
            <section key={item.label} className="flex gap-3 rounded-lg border border-border bg-card p-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <item.icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">{item.label}</h2>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
              </div>
            </section>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Empfohlene Reihenfolge: Recherche, Skript-Writer, dann Thumbnail-Creator.
        </p>
      </DialogContent>
    </Dialog>
  );
}
