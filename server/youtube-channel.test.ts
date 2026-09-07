import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ageInDays, computeChannelStats, median, outlierScore, parseChannelReference, scoreVideos } from "./youtube-channel";

describe("Kanal-Referenz erkennen", () => {
  it("erkennt Handles, IDs, URLs und Benutzernamen", () => {
    assert.deepEqual(parseChannelReference("@Finanz4U"), { kind: "handle", value: "Finanz4U" });
    assert.deepEqual(parseChannelReference("https://www.youtube.com/@Finanz4U/videos"), { kind: "handle", value: "Finanz4U" });
    assert.deepEqual(parseChannelReference("youtube.com/channel/UCabcdefghijklmnopqrstuv"), { kind: "id", value: "UCabcdefghijklmnopqrstuv" });
    assert.deepEqual(parseChannelReference("UCabcdefghijklmnopqrstuv"), { kind: "id", value: "UCabcdefghijklmnopqrstuv" });
    assert.deepEqual(parseChannelReference("https://youtube.com/user/altername"), { kind: "username", value: "altername" });
    assert.deepEqual(parseChannelReference("Finanz für alle"), { kind: "query", value: "Finanz für alle" });
  });
});

describe("Outlier-Berechnung", () => {
  it("berechnet Median und Outlier-Wert wie 1of10", () => {
    assert.equal(median([1, 5, 3]), 3);
    assert.equal(median([1, 2, 3, 4]), 2.5);
    assert.equal(median([]), null);
    assert.equal(outlierScore(74_600, 1_000), 74.6);
    assert.equal(outlierScore(500, 1_000), 0.5);
    assert.equal(outlierScore(null, 1_000), null);
    assert.equal(outlierScore(100, 0), null);
  });

  it("markiert kleine Stichproben als wenig belastbar", () => {
    const now = Date.now();
    const videos = [10, 20, 30].map((views, index) => ({
      viewCount: views,
      viewsPerDay: views / (index + 1),
      publishedAt: new Date(now - (index + 1) * 86_400_000).toISOString(),
    }));
    const stats = computeChannelStats(videos);
    assert.equal(stats.analyzedVideos, 3);
    assert.equal(stats.medianViews, 20);
    assert.equal(stats.lowConfidence, true);
    const scored = scoreVideos(videos, stats);
    assert.equal(scored[2].outlierScore, 1.5);
  });

  it("berechnet das Alter in Tagen mit Mindestwert 1", () => {
    const now = Date.UTC(2026, 8, 6);
    assert.equal(ageInDays(new Date(now - 10 * 86_400_000).toISOString(), now), 10);
    assert.equal(ageInDays(new Date(now + 86_400_000).toISOString(), now), 1);
  });
});
