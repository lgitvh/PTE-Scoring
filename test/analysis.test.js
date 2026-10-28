import { test } from "node:test";
import assert from "node:assert/strict";
import { alignWords, matchShortAnswer, deliveryMetrics, tokenize } from "../src/analysis.js";
import { overallScore } from "../src/scorer.js";

test("tokenize normalises case, punctuation, hyphens and number words", () => {
  assert.deepEqual(tokenize("By-product, Three CATS!"), ["by", "product", "3", "cats"]);
});

test("alignWords marks omitted and inserted words", () => {
  const a = alignWords("The library will be closed today.", "the library will um closed today");
  assert.equal(a.total, 6);
  assert.equal(a.matched, 5);
  assert.deepEqual(a.words.filter((w) => w.status === "omitted").map((w) => w.word), ["be"]);
  assert.deepEqual(a.inserted, ["um"]);
});

test("alignWords handles empty speech", () => {
  const a = alignWords("Hello world", "");
  assert.equal(a.matched, 0);
  assert.equal(a.accuracy, 0);
});

test("matchShortAnswer accepts answers inside a longer reply", () => {
  assert.ok(matchShortAnswer(["mars"], "I think it's Mars"));
  assert.ok(matchShortAnswer(["three hundred and sixty six"], "Three hundred and sixty-six days"));
  assert.ok(!matchShortAnswer(["ice"], "rice"));
});

test("deliveryMetrics computes pace and pauses", () => {
  const m = deliveryMetrics("one two three four five six", { durationSec: 4, onsetSec: 1, pauses: [0.4, 1.5, 2.2] });
  assert.equal(m.wordCount, 6);
  assert.equal(m.wordsPerMinute, 120);
  assert.equal(m.longPauses, 2);
  assert.equal(m.longestPauseSec, 2.2);
});

test("overallScore maps traits to the 10-90 scale", () => {
  const max = { content: 5, oralFluency: 5, pronunciation: 5 };
  assert.equal(overallScore({ content: 5, oralFluency: 5, pronunciation: 5 }, max), 90);
  assert.equal(overallScore({ content: 0, oralFluency: 0, pronunciation: 0 }, max), 10);
  assert.equal(overallScore({ content: 1, oralFluency: null, pronunciation: null }, { content: 1, oralFluency: null, pronunciation: null }), 90);
});
