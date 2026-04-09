# Quiz Blocks — Demo Template

Copy the entire block below (including the ` ```quiz-blocks ` and closing ` ``` `) into any Obsidian note to run the full demo.

````md
```quiz-blocks
[
  // ── 1. SINGLE CHOICE ──────────────────────────────────────────────────────
  {
    id: 'demo-1',
    title: 'Single Choice',
    prompt: 'Which planet is the largest in our solar system?',
    options: [
      'Earth',
      'Saturn',
      'Jupiter',
      'Neptune',
    ],
    correctIndex: 2,
    hint: 'This planet is known for its Great Red Spot, a massive storm.',
    explainHtml: '<p><strong>Jupiter</strong> is the largest planet in the solar system. Its diameter is about 11 times that of Earth.</p><ul><li>Saturn is the second largest but is famous for its rings.</li><li>Neptune is the farthest planet from the Sun.</li><li>Earth is the third planet and the only one known to support life.</li></ul>',
  },

  // ── 2. MULTIPLE CHOICE ────────────────────────────────────────────────────
  {
    id: 'demo-2',
    title: 'Multiple Choice',
    prompt: 'Which of the following are official languages of the United Nations? (Select all that apply)',
    options: [
      'English',
      'Portuguese',
      'French',
      'German',
      'Arabic',
    ],
    multiSelect: true,
    correctIndices: [0, 2, 4],
    hint: 'The UN has 6 official languages. Portuguese and German are not among them.',
    explainHtml: '<p>The <strong>6 official languages of the UN</strong> are: English, French, Spanish, Russian, Arabic, and Chinese (Mandarin).</p><ul><li><strong>English</strong> ✓ — official UN language.</li><li><em>Portuguese</em> ✗ — widely spoken but not an official UN language.</li><li><strong>French</strong> ✓ — official UN language.</li><li><em>German</em> ✗ — not an official UN language.</li><li><strong>Arabic</strong> ✓ — added as an official language in 1973.</li></ul>',
  },

  // ── 3. TEXT INPUT ─────────────────────────────────────────────────────────
  {
    id: 'demo-3',
    title: 'Text Answer',
    prompt: 'What is the chemical symbol for gold?',
    type: 'text',
    placeholder: 'Enter the symbol (1-2 letters)',
    acceptedAnswers: ['Au', 'au', 'AU'],
    caseSensitive: false,
    hint: 'The symbol comes from the Latin word "Aurum".',
    explainHtml: '<p>The chemical symbol for gold is <strong>Au</strong>, derived from the Latin word <em>Aurum</em>.</p><p>Gold has atomic number 79 and is one of the least reactive chemical elements, which is why it does not tarnish or rust.</p>',
  },

  // ── 4. CMD COMMAND LINE ───────────────────────────────────────────────────
  {
    id: 'demo-4',
    title: 'Windows CMD',
    prompt: 'Type the Windows command to list all files and folders in the current directory.',
    type: 'text',
    terminalVariant: 'cmd',
    commandPrefix: 'C:\\>',
    placeholder: 'Enter command here',
    acceptedAnswers: ['dir'],
    caseSensitive: false,
    hint: 'This is the Windows equivalent of the Linux "ls" command.',
    explainHtml: '<p><code>dir</code> lists all files and folders in the current directory, along with their size and last modified date.</p><p>On Linux/macOS, the equivalent command is <code>ls</code>.</p>',
  },

  // ── 5. POWERSHELL COMMAND LINE ────────────────────────────────────────────
  {
    id: 'demo-5',
    title: 'PowerShell Cmdlet',
    prompt: 'Type the PowerShell cmdlet to list all running processes on the machine.',
    type: 'text',
    terminalVariant: 'powershell',
    commandPrefix: 'PS>',
    placeholder: 'Enter cmdlet here',
    acceptedAnswers: ['Get-Process', 'get-process', 'gps'],
    caseSensitive: false,
    hint: 'PowerShell cmdlets follow the Verb-Noun pattern. The verb here is "Get".',
    explainHtml: '<p><code>Get-Process</code> retrieves the list of all currently running processes, showing their name, ID, CPU usage, and memory consumption.</p><p>Its alias is <code>gps</code>. The equivalent on Linux is <code>ps aux</code>.</p>',
  },

  // ── 6. BASH COMMAND LINE ──────────────────────────────────────────────────
  {
    id: 'demo-6',
    title: 'Linux Bash',
    prompt: 'Type the Linux command to display the current working directory.',
    type: 'text',
    terminalVariant: 'bash',
    placeholder: 'Enter command here',
    acceptedAnswers: ['pwd'],
    caseSensitive: false,
    hint: 'It stands for "Print Working Directory".',
    explainHtml: '<p><code>pwd</code> (Print Working Directory) outputs the full path of the directory you are currently in.</p><p>Example output: <code>/home/ahmed/documents</code></p>',
  },

  // ── 7. ORDERING (drag & drop) ─────────────────────────────────────────────
  {
    id: 'demo-7',
    title: 'Ordering',
    prompt: 'Sort these planets from closest to farthest from the Sun.',
    ordering: true,
    slots: ['1st', '2nd', '3rd', '4th'],
    possibilities: [
      'Earth',
      'Mars',
      'Mercury',
      'Venus',
    ],
    correctOrder: [2, 3, 0, 1],
    hint: 'Think about which planets are in the inner solar system. Mercury is the closest.',
    explainHtml: '<p>The correct order from closest to farthest from the Sun:</p><ol><li><strong>Mercury</strong> — ~58 million km</li><li><strong>Venus</strong> — ~108 million km</li><li><strong>Earth</strong> — ~150 million km</li><li><strong>Mars</strong> — ~228 million km</li></ol>',
  },

  // ── 8. MATCHING (pair columns) ────────────────────────────────────────────
  {
    id: 'demo-8',
    title: 'Matching',
    prompt: 'Match each country with its capital city.',
    matching: true,
    rows: ['Japan', 'Brazil', 'Australia', 'Egypt'],
    choices: ['Brasilia', 'Cairo', 'Canberra', 'Tokyo'],
    correctMap: [3, 0, 2, 1],
    hint: 'Be careful — the capital of Australia is not Sydney, and the capital of Brazil is not Rio de Janeiro.',
    explainHtml: '<ul><li><strong>Japan → Tokyo</strong>: the most populous metropolitan area in the world.</li><li><strong>Brazil → Brasília</strong>: built from scratch in the 1950s to serve as the new capital.</li><li><strong>Australia → Canberra</strong>: chosen as a compromise between Sydney and Melbourne.</li><li><strong>Egypt → Cairo</strong>: the largest city in Africa and the Arab world.</li></ul>',
  },

  // ── EXAM MODE ─────────────────────────────────────────────────────────────
  {
    examMode: true,
    examDurationMinutes: 8,
    examAutoSubmit: true,
    examShowTimer: true,
  },
]
```
````
