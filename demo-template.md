# Quiz Blocks — Demo Template

Copy the block below into any Obsidian note to try all question types at once.

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
    hint: 'This planet is known for its Great Red Spot, a massive storm bigger than Earth.',
    explainHtml: '<p><strong>Jupiter</strong> is the largest planet in the solar system — its diameter is about 11 times that of Earth.</p><ul><li><em>Saturn</em> is the second largest and is famous for its rings.</li><li><em>Neptune</em> is the farthest planet from the Sun.</li><li><em>Earth</em> is the only planet known to support life.</li></ul>',
  },

  // ── 2. MULTIPLE CHOICE ────────────────────────────────────────────────────
  {
    id: 'demo-2',
    title: 'Multiple Choice',
    prompt: 'Which of the following are mammals? (Select all that apply)',
    options: [
      'Dolphin',
      'Salmon',
      'Bat',
      'Eagle',
      'Whale',
    ],
    multiSelect: true,
    correctIndices: [0, 2, 4],
    hint: 'Mammals are warm-blooded, breathe air, and nurse their young with milk — even if they live in water.',
    explainHtml: '<p>Mammals are warm-blooded vertebrates that breathe air and produce milk for their young.</p><ul><li><strong>Dolphin</strong> ✓ — lives in water but breathes air and is warm-blooded.</li><li><em>Salmon</em> ✗ — a fish, cold-blooded and breathes through gills.</li><li><strong>Bat</strong> ✓ — the only mammal capable of sustained flight.</li><li><em>Eagle</em> ✗ — a bird, not a mammal.</li><li><strong>Whale</strong> ✓ — fully aquatic but 100% mammal.</li></ul>',
  },

  // ── 3. TEXT INPUT ─────────────────────────────────────────────────────────
  {
    id: 'demo-3',
    title: 'Text Answer',
    prompt: 'What is the name of the longest river in the world?',
    type: 'text',
    placeholder: 'Enter the river name...',
    acceptedAnswers: ['Nile', 'the Nile', 'nile'],
    caseSensitive: false,
    hint: 'It flows through northeastern Africa and empties into the Mediterranean Sea.',
    explainHtml: '<p>The <strong>Nile</strong> is generally recognized as the longest river in the world at approximately 6,650 km (4,130 miles), flowing through 11 countries in northeastern Africa.</p><p>Note: Some recent studies suggest the Amazon may be slightly longer depending on how the source is measured.</p>',
  },

  // ── 4. CMD COMMAND LINE ───────────────────────────────────────────────────
  {
    id: 'demo-4',
    title: 'Windows CMD',
    prompt: 'Your PC cannot reach any website. Type the Windows CMD command to test if you can reach Google\'s public DNS server at 8.8.8.8.',
    type: 'text',
    terminalVariant: 'cmd',
    commandPrefix: 'C:\\>',
    placeholder: 'Enter command here',
    acceptedAnswers: ['ping 8.8.8.8'],
    caseSensitive: false,
    hint: 'Use the most basic network reachability tool followed by the IP address.',
    explainHtml: '<p><code>ping 8.8.8.8</code> sends ICMP packets to Google\'s public DNS server and waits for a reply.</p><ul><li>Replies come back → your PC has internet access at the IP level.</li><li>Request timed out → the issue is the ISP, router, or a firewall blocking ICMP.</li></ul>',
  },

  // ── 5. POWERSHELL COMMAND LINE ────────────────────────────────────────────
  {
    id: 'demo-5',
    title: 'PowerShell',
    prompt: 'Type the PowerShell cmdlet used to list all currently running processes on a Windows machine.',
    type: 'text',
    terminalVariant: 'powershell',
    commandPrefix: 'PS>',
    placeholder: 'Enter cmdlet here',
    acceptedAnswers: [
      'Get-Process',
      'get-process',
      'gps',
    ],
    caseSensitive: false,
    hint: 'PowerShell cmdlets follow the Verb-Noun pattern. The verb here is "Get".',
    explainHtml: '<p><code>Get-Process</code> (alias: <code>gps</code>) retrieves all currently active processes, showing their name, ID, CPU, and memory usage.</p><p>The equivalent on Linux is <code>ps aux</code>.</p>',
  },

  // ── 6. BASH COMMAND LINE ──────────────────────────────────────────────────
  {
    id: 'demo-6',
    title: 'Linux Bash',
    prompt: 'Type the Linux command to display the full path of the directory you are currently in.',
    type: 'text',
    terminalVariant: 'bash',
    placeholder: 'Enter command here',
    acceptedAnswers: ['pwd'],
    caseSensitive: false,
    hint: 'It stands for three words: Print Working Directory.',
    explainHtml: '<p><code>pwd</code> (Print Working Directory) outputs the absolute path of your current location in the filesystem.</p><p>Example output: <code>/home/ahmed/documents</code></p>',
  },

  // ── 7. ORDERING (drag & drop) ─────────────────────────────────────────────
  {
    id: 'demo-7',
    title: 'Ordering',
    prompt: 'Sort these four planets from closest to farthest from the Sun.',
    ordering: true,
    slots: ['1st', '2nd', '3rd', '4th'],
    possibilities: [
      'Earth',
      'Mars',
      'Mercury',
      'Venus',
    ],
    correctOrder: [2, 3, 0, 1],
    hint: 'Mercury is the closest. Earth is the third planet.',
    explainHtml: '<p>Correct order from closest to farthest from the Sun:</p><ol><li><strong>Mercury</strong> — ~58 million km</li><li><strong>Venus</strong> — ~108 million km</li><li><strong>Earth</strong> — ~150 million km</li><li><strong>Mars</strong> — ~228 million km</li></ol>',
  },

  // ── 8. MATCHING (pair columns) ────────────────────────────────────────────
  {
    id: 'demo-8',
    title: 'Matching',
    prompt: 'Match each country with its capital city.',
    matching: true,
    rows: ['Japan', 'Brazil', 'Australia', 'Egypt'],
    choices: ['Brasília', 'Cairo', 'Canberra', 'Tokyo'],
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
