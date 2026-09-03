# MBTI Mode Spec

## Overview

Add `mode: 'mbti'` to the existing quiz system. Scoring changes from "max axis wins → 1 of N results" to "per-dimension letter wins → concatenate code → lookup result". Everything else (webhook, LIFF screens, group/pair flow) stays the same.

---

## 1. Data Model

### 1.1 Config Shape (AppConfig)

```typescript
// Existing (axis mode) — unchanged
interface AxisConfig {
  mode: 'axis'                         // default, backward-compat
  axes: { key: string; label: string }[]
  questions: AxisQuestion[]
  results: AxisResult[]
}

// New
interface MBTIConfig {
  mode: 'mbti'
  dimensions: Dimension[]              // e.g. 4 dimensions for 16-type, or any N
  questions: MBTIQuestion[]
  results: MBTIResult[]                // 2^N entries
}

interface Dimension {
  key: string          // e.g. "EI"
  labelA: string       // e.g. "I (Introvert)"
  letterA: string      // e.g. "I"
  labelB: string       // e.g. "E (Extravert)"
  letterB: string      // e.g. "E"
}

interface MBTIQuestion {
  id: string
  text: string
  image?: string
  options: MBTIOption[]
}

interface MBTIOption {
  key: string          // A, B, C, D, E
  text: string
  scores: Record<string, number>  // { "EI": 2, "JP": -1 }
                                  // positive = toward letterA, negative = toward letterB
}

interface MBTIResult {
  code: string         // e.g. "INTJ" — must match concatenation of winning letters
  title: string
  description: string
  image?: string
  tags?: string[]
  // Same shape as AxisResult for frontend reuse
}
```

### 1.2 Score Accumulation

For each dimension `d`:
```
score[d] = sum of option.scores[d.key] across all answers
if score[d] >= 0 → winner = d.letterA
if score[d] <  0 → winner = d.letterB
```

Final code = winner letters joined in dimension order → `"INTJ"`, `"ENFP"`, etc.

### 1.3 DB Compatibility

- `topAxis` column (varchar) already stores a string → stores code like `"INTJ"` unchanged
- `axisScores` (jsonb) stores the raw per-dimension sums: `{ "EI": 3, "NS": -1, "TF": 2, "JP": 0 }`
- No migration needed

---

## 2. Backend Changes

### 2.1 New file: `src/services/mbti.ts`

```typescript
export function calcMBTI(
  dimensions: Dimension[],
  questions: MBTIQuestion[],
  answers: Record<string, string>   // { questionId: optionKey }
): { code: string; scores: Record<string, number> } {

  // Accumulate scores per dimension
  const scores: Record<string, number> = {}
  for (const dim of dimensions) scores[dim.key] = 0

  for (const q of questions) {
    const selectedKey = answers[q.id]
    if (!selectedKey) continue
    const option = q.options.find(o => o.key === selectedKey)
    if (!option) continue
    for (const [dimKey, val] of Object.entries(option.scores)) {
      scores[dimKey] = (scores[dimKey] ?? 0) + val
    }
  }

  // Determine winning letter per dimension
  const letters = dimensions.map(dim =>
    scores[dim.key] >= 0 ? dim.letterA : dim.letterB
  )

  return { code: letters.join(''), scores }
}
```

### 2.2 Branch in submit route (`src/services/match.ts` or quiz submit handler)

```typescript
// In handleQuizSubmit():
const config = await getAppConfig(campaignId)

let topAxis: string
let axisScores: Record<string, number>
let result: AxisResult | MBTIResult

if (config.mode === 'mbti') {
  const { code, scores } = calcMBTI(config.dimensions, config.questions, answers)
  topAxis = code
  axisScores = scores
  result = config.results.find(r => r.code === code)!
} else {
  // existing axis logic unchanged
  const { top, scores } = calcAxis(config.axes, config.questions, answers)
  topAxis = top
  axisScores = scores
  result = config.results.find(r => r.key === top)!
}

await db.updateSubmission({ topAxis, axisScores, result })
```

### 2.3 Pair Result (duo mode)

- Each person has a `code` string (e.g. `"INTJ"`, `"ENFP"`)
- Pair result lookup: `pairResults[codeA][codeB]` → same pair matrix approach
- If no pair matrix defined, fallback: show both codes + generic compatibility text
- `pairKey` stored as `"INTJ×ENFP"` (alphabetical sort for dedup)

### 2.4 Group Result (team mode)

- Group result = most common code among members, OR
- Optional: group code = dimension-by-dimension majority vote
- Recommendation: start with most-common-code, add majority-vote later

---

## 3. Frontend Changes

### 3.1 Result Screen (`liff/src/screens/Result.tsx`)

Minimal change — result object shape is identical (`title`, `description`, `image`, `tags`).

Only addition: show the type code badge if `mode === 'mbti'`

```tsx
{config.mode === 'mbti' && submission.topAxis && (
  <div style={{ fontFamily: 'Bangers', fontSize: 32, letterSpacing: 2 }}>
    {submission.topAxis}   {/* "INTJ" */}
  </div>
)}
```

### 3.2 PairResult Screen

Show both codes:
```tsx
<span style={{ fontFamily: 'Bangers' }}>{personA.topAxis} × {personB.topAxis}</span>
```

### 3.3 Group Screen

Show group code or top member codes — no major layout change needed.

### 3.4 No other screen changes required

Question, SoloShare, Invited, FriendGate — all mode-agnostic.

---

## 4. Admin CMS / Playground

### 4.1 Mode toggle

```
[ Axis Mode ]  [ MBTI Mode ]
```

Switching mode resets questions and results (warn user).

### 4.2 MBTI Mode — Dimensions section (replaces Axes)

```
+ Add Dimension

┌─────────────────────────────────────────────────┐
│ Dimension 1                                     │
│ Key:     [ EI          ]                        │
│ Letter A: [ I ] Label: [ Introvert            ] │
│ Letter B: [ E ] Label: [ Extravert            ] │
└─────────────────────────────────────────────────┘
```

### 4.3 MBTI Mode — Per-option scoring

Each option shows one numeric input per dimension:

```
Option A: [ text input                    ]
  EI: [ +2 ]  NS: [  0 ]  TF: [ -1 ]  JP: [ +1 ]

Option B: [ text input                    ]
  EI: [ -1 ]  NS: [ +2 ]  TF: [  0 ]  JP: [ -1 ]
```

Positive = toward letterA, negative = toward letterB.

### 4.4 MBTI Mode — Results table

2^N rows, auto-generated from dimension combinations:

```
┌──────┬──────────────┬─────────────────────────┬─────────┬────────┐
│ Code │ Title        │ Description             │ Tags    │ Image  │
├──────┼──────────────┼─────────────────────────┼─────────┼────────┤
│ INTJ │ [input]      │ [textarea]              │ [input] │ [url]  │
│ INTP │ [input]      │ [textarea]              │ [input] │ [url]  │
│ ENTJ │ ...          │                         │         │        │
│ ...  │              │                         │         │        │
└──────┴──────────────┴─────────────────────────┴─────────┴────────┘
```

Codes are read-only (auto-generated), all other fields editable.

### 4.5 Export JSON shape

```json
{
  "mode": "mbti",
  "dimensions": [
    { "key": "EI", "letterA": "I", "labelA": "Introvert", "letterB": "E", "labelB": "Extravert" },
    { "key": "NS", "letterA": "N", "labelA": "Intuition", "letterB": "S", "labelB": "Sensing" },
    { "key": "TF", "letterA": "T", "labelA": "Thinking",  "letterB": "F", "labelB": "Feeling" },
    { "key": "JP", "letterA": "J", "labelA": "Judging",   "letterB": "P", "labelB": "Perceiving" }
  ],
  "questions": [
    {
      "id": "q1",
      "text": "คุณชอบ...",
      "options": [
        { "key": "A", "text": "อยู่คนเดียว", "scores": { "EI": 2, "NS": 0, "TF": 0, "JP": 0 } },
        { "key": "B", "text": "อยู่กับเพื่อน", "scores": { "EI": -2, "NS": 0, "TF": 0, "JP": 0 } }
      ]
    }
  ],
  "results": [
    { "code": "INTJ", "title": "สถาปนิก", "description": "...", "image": "...", "tags": ["วิเคราะห์", "วางแผน"] },
    { "code": "INTP", "title": "นักตรรกะ", "description": "...", "image": "...", "tags": [] }
  ]
}
```

---

## 5. Implementation Order

1. **`src/services/mbti.ts`** — `calcMBTI()` function + tests
2. **Submit route branch** — detect `config.mode`, call correct calc, store result
3. **DB verify** — confirm `topAxis` varchar handles 4-char codes, `axisScores` stores dim sums
4. **Result screen** — add code badge for mbti mode (2-line change)
5. **Admin CMS** — Dimensions editor, per-option scoring UI, results code table
6. **Pair MBTI** — pairKey format + pair result lookup

Steps 1–4 are backend+minimal frontend. Steps 5–6 are CMS UI.

---

## 6. Out of Scope (for now)

- Pair matrix for MBTI (complex: 16×16 = 256 combos) — ship without, fallback to generic text
- Majority-vote group code — ship with most-common-code first
- MBTI mode in b2b-demo.html
- Campaign Playground MBTI tab
