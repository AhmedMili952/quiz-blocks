# Quiz Blocks — Demo Template

Copy the block below into any Obsidian note to try all question types at once.

````md
```quiz-blocks
[
  // ── 1. SINGLE CHOICE ────────────────────────────────────────────────────
  {
    id: 'demo-1',
    title: 'Single Choice',
    prompt: 'What is the capital of France?',
    options: ['London', 'Berlin', 'Paris', 'Madrid'],
    correctIndex: 2,
    hint: 'It is also the city where the Eiffel Tower is located.',
    explainHtml: '<p>The capital of France is <strong>Paris</strong>. It has been the capital since the 10th century and is home to iconic landmarks like the Eiffel Tower and the Louvre.</p>',
  },

  // ── 2. MULTIPLE CHOICE ──────────────────────────────────────────────────
  {
    id: 'demo-2',
    title: 'Multiple Choice',
    prompt: 'Select all prime numbers:',
    options: ['2', '4', '5', '9', '11'],
    multiSelect: true,
    correctIndices: [0, 2, 4],
    hint: 'A prime number is only divisible by 1 and itself.',
    explainHtml: '<p>Prime numbers in this list: <strong>2, 5, 11</strong>.</p><ul><li>4 = 2×2, not prime.</li><li>9 = 3×3, not prime.</li></ul>',
  },

  // ── 3. TEXT INPUT ───────────────────────────────────────────────────────
  {
    id: 'demo-3',
    title: 'Text Answer',
    prompt: 'What is the chemical symbol for water?',
    type: 'text',
    placeholder: 'Enter your answer...',
    acceptedAnswers: ['H2O', 'h2o'],
    caseSensitive: false,
    hint: 'It is composed of 2 hydrogen atoms and 1 oxygen atom.',
    explainHtml: '<p>The chemical symbol for water is <strong>H₂O</strong> — 2 hydrogen (H) atoms bonded to 1 oxygen (O) atom.</p>',
  },

  // ── 4. CMD COMMAND LINE ─────────────────────────────────────────────────
  {
    id: 'demo-4',
    title: 'Windows CMD',
    prompt: 'Which cmdlet lists all running processes?',
    type: 'text',
    terminalVariant: 'powershell',
    commandPrefix: 'PS>',
    placeholder: 'Enter cmdlet here',
    acceptedAnswers: ['Get-Process', 'gps'],
    caseSensitive: false,
    hint: 'PowerShell cmdlets follow the Verb-Noun pattern.',
    explainHtml: '<p><code>Get-Process</code> (alias: <code>gps</code>) retrieves all currently active processes on the machine.</p>',
  },

  // ── 5. ORDERING (drag & drop) ───────────────────────────────────────────
  {
    id: 'demo-5',
    title: 'Ordering',
    prompt: 'Arrange these steps in the correct order to bake a cake:',
    ordering: true,
    slots: ['Step 1', 'Step 2', 'Step 3'],
    possibilities: ['Bake', 'Mix ingredients', 'Preheat oven'],
    correctOrder: [2, 1, 0],
    hint: 'You need to prepare the oven before anything else.',
    explainHtml: '<ol><li><strong>Preheat oven</strong> — prepare the heat source first.</li><li><strong>Mix ingredients</strong> — prepare the batter.</li><li><strong>Bake</strong> — put it in the oven.</li></ol>',
  },

  // ── 6. MATCHING (pair columns) ──────────────────────────────────────────
  {
    id: 'demo-6',
    title: 'Matching',
    prompt: 'Match the countries with their capitals:',
    matching: true,
    rows: ['France', 'Germany', 'Spain'],
    choices: ['Paris', 'Berlin', 'Madrid'],
    correctMap: [0, 1, 2],
    hint: 'Each country has one unique capital city.',
    explainHtml: '<ul><li><strong>France → Paris</strong></li><li><strong>Germany → Berlin</strong></li><li><strong>Spain → Madrid</strong></li></ul>',
  },

  // ── EXAM MODE ───────────────────────────────────────────────────────────
  {
    examMode: true,
    examDurationMinutes: 5,
    examAutoSubmit: true,
    examShowTimer: true,
  },
]
```
````
