import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateContentWithRetry } from "./gemini";

// Regression: Der Wrapper hatte sich einmal selbst statt des SDK aufgerufen
// (endlose Rekursion, "Maximum call stack size exceeded"). Diese Tests rufen
// den Wrapper mit einem Stub auf und stellen sicher, dass genau der Stub
// aufgerufen wird und Fehler ohne Rekursion durchgereicht werden.
describe("generateContentWithRetry", () => {
  it("ruft den Aufrufer genau einmal auf, wenn die Anfrage gelingt", async () => {
    let calls = 0;
    const response = await generateContentWithRetry(
      { model: "test", contents: "hi" },
      async () => { calls += 1; return { text: "ok" } as any; },
      [],
    );
    assert.equal(calls, 1);
    assert.equal(response.text, "ok");
  });

  it("wiederholt bei Kontingentfehlern und gibt dann das Ergebnis zurück", async () => {
    let calls = 0;
    const response = await generateContentWithRetry(
      { model: "test", contents: "hi" },
      async () => {
        calls += 1;
        if (calls < 3) throw new Error("429 RESOURCE_EXHAUSTED: quota exceeded");
        return { text: "spät ok" } as any;
      },
      [1, 1],
    );
    assert.equal(calls, 3);
    assert.equal(response.text, "spät ok");
  });

  it("wirft andere Fehler sofort und ohne Rekursion weiter", async () => {
    let calls = 0;
    await assert.rejects(
      generateContentWithRetry(
        { model: "test", contents: "hi" },
        async () => { calls += 1; throw new Error("API key not valid"); },
        [1, 1],
      ),
      /API key not valid/,
    );
    assert.equal(calls, 1);
  });

  it("gibt nach Ausschöpfen der Wiederholungen den letzten Kontingentfehler zurück", async () => {
    let calls = 0;
    await assert.rejects(
      generateContentWithRetry(
        { model: "test", contents: "hi" },
        async () => { calls += 1; throw new Error("503 model is overloaded"); },
        [1],
      ),
      /overloaded/,
    );
    assert.equal(calls, 2);
  });
});
