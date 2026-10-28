# PTE Speaking Practice

A website for practising the PTE Academic speaking section. You answer questions on the real test timings, the
browser records and transcribes your answer, and Claude scores it on the official PTE traits with feedback on
what to improve.

## Tasks

| Task | Prep | Record | Scored on |
| --- | --- | --- | --- |
| Read Aloud | 35s | 40s | Content (word accuracy), oral fluency, pronunciation |
| Repeat Sentence | — | 15s | Content (0–3), oral fluency, pronunciation |
| Describe Image | 25s | 40s | Content, oral fluency, pronunciation |
| Re-tell Lecture | 10s | 40s | Content, oral fluency, pronunciation |
| Answer Short Question | — | 10s | Vocabulary (correct / incorrect) |

Each result shows an estimated score on the 10–90 scale, per-trait scores, pace and pause measurements,
a word-by-word check for Read Aloud and Repeat Sentence, pronunciation tips, and a model answer.
Your recent scores are kept in the browser.

## How scoring works

1. **In the browser**: the Web Speech API transcribes your answer while you speak. The app also measures when you
   started speaking, the pauses between words and the recogniser's confidence. Your recording is kept locally so you
   can play it back. Audio is never uploaded.
2. **On the server**: content is scored without a model where it can be measured exactly (word alignment for Read
   Aloud and Repeat Sentence, answer matching for Answer Short Question). Claude then scores fluency, pronunciation and
   open-ended content against the PTE rubrics and writes the feedback.

Claude can't hear the audio. It judges fluency and pronunciation from the transcript, the timing and the recogniser's
confidence, so treat those scores as a guide, not an official result.

## Running it

You need Node 20+ and an [Anthropic API key](https://console.anthropic.com/).

```bash
npm install
```

```bash
ANTHROPIC_API_KEY=sk-ant-... npm start
```

Open http://localhost:3000 in **Chrome or Edge** (they support speech recognition; in other browsers you can type
your answer after recording). Allow microphone access when asked.

Optional environment variables:

- `PORT`: the port to listen on (default `3000`)
- `PTE_MODEL`: the Claude model to score with (default `claude-opus-5-5`)

## Adding questions

Questions live in `src/questions.js`. Each needs an `id` and a `task`, plus:

- Read Aloud, Repeat Sentence, Re-tell Lecture: `text` (lectures and sentences are read out by the browser's voice)
- Describe Image: `image` (`bar`, `line` or `pie`), `title`, `data` as `[label, value]` pairs, and `keyPoints`, a
  description of the chart that Claude uses to judge content
- Answer Short Question: `text` (the question) and `answers` (accepted answers)

## Tests

```bash
npm test
```
