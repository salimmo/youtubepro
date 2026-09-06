import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeScriptModelOutput, parseScriptGenerationOutput } from "./gemini";

// Regression für die Live-Fehler mit Gemini 3.5 Flash-Lite:
// "Expected string, received object" und "String must contain at most 2000 character(s)".
describe("normalizeScriptModelOutput", () => {
  it("wandelt Objekt- und Array-Felder in Text um und akzeptiert die Antwort", () => {
    const raw = {
      titles: [{ title: "Titel A" }, "Titel B", { text: "Titel C" }, "Titel D"],
      hook: { text: "Du willst deine erste Drohne kaufen?" },
      structure: [{ section: "HOOK", purpose: "Einstieg", evidenceClaimIds: [] }, "HAUPTTEIL"],
      script: { HOOK: "Du willst deine erste Drohne kaufen?", HAUPTTEIL: "Drei Kriterien zählen." },
      payoff: ["Du kennst die Kriterien.", "Fertig."],
      primaryCta: { action: "Vergleichsvideo ansehen" },
      studioValidation: { metric: "Retention", rule: "Über 40 %" },
    };
    const parsed = parseScriptGenerationOutput(JSON.stringify(raw));
    assert.deepEqual(parsed.titles, ["Titel A", "Titel B", "Titel C"]);
    assert.equal(parsed.hook, "Du willst deine erste Drohne kaufen?");
    assert.match(parsed.script, /## HOOK\nDu willst/);
    assert.match(parsed.script, /## HAUPTTEIL\nDrei Kriterien/);
    assert.equal(parsed.structure.length, 2);
    assert.equal(parsed.structure[1].section, "HAUPTTEIL");
    assert.match(parsed.payoff, /Du kennst die Kriterien/);
    assert.equal(parsed.primaryCta, "Vergleichsvideo ansehen");
    assert.match(parsed.studioValidation, /Retention/);
  });

  it("kürzt zu lange Felder auf die erlaubte Länge", () => {
    const long = "Wort ".repeat(1_000);
    const parsed = parseScriptGenerationOutput(JSON.stringify({
      titles: ["Ein Titel"],
      hook: long,
      structure: [{ section: "A", purpose: "a", evidenceClaimIds: [] }, { section: "B", purpose: "b", evidenceClaimIds: [] }],
      script: "## HOOK\nText",
      payoff: long,
      primaryCta: long,
      studioValidation: long,
    }));
    assert.ok(parsed.hook.length <= 1_500);
    assert.ok(parsed.payoff.length <= 1_000);
    assert.ok(parsed.primaryCta.length <= 800);
    assert.ok(parsed.studioValidation.length <= 800);
    assert.ok(parsed.hook.endsWith("…"));
  });

  it("leitet fehlende Struktur und Hook aus dem Skript ab", () => {
    const parsed = parseScriptGenerationOutput(JSON.stringify({
      titles: "Nur ein Titel als String",
      script: "## HOOK\nErster Absatz.\n\n## HAUPTTEIL\nZweiter Absatz.\n\n## CALL-TO-ACTION\nAbo.",
    }));
    assert.deepEqual(parsed.titles, ["Nur ein Titel als String"]);
    assert.equal(parsed.hook, "Erster Absatz.");
    assert.deepEqual(parsed.structure.map((entry) => entry.section), ["HOOK", "HAUPTTEIL", "CALL-TO-ACTION"]);
    assert.equal(parsed.payoff, "Siehe Skript.");
  });

  it("akzeptiert lange Skripte weit über 2000 Zeichen", () => {
    const longScript = "## HOOK\n" + "Satz für ein langes Skript. ".repeat(400);
    const parsed = parseScriptGenerationOutput(JSON.stringify({
      titles: ["Titel"],
      hook: "Hook",
      structure: [{ section: "A", purpose: "a", evidenceClaimIds: [] }, { section: "B", purpose: "b", evidenceClaimIds: [] }],
      script: longScript,
      payoff: "p", primaryCta: "c", studioValidation: "s",
    }));
    assert.ok(parsed.script.length > 10_000);
  });

  it("lehnt Antworten ohne Skripttext weiterhin ab", () => {
    assert.throws(() => parseScriptGenerationOutput(JSON.stringify({ titles: ["x"], hook: "y" })), /schema validation/);
    assert.equal(normalizeScriptModelOutput("kein objekt"), "kein objekt");
  });
});
