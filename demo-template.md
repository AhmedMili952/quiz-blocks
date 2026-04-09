# Quiz Blocks — Demo Template

Copy the entire block below (including the ` ```quiz-blocks ` and closing ` ``` `) into any Obsidian note to run the full demo.

````md
```quiz-blocks
[
  // ── 1. SINGLE CHOICE ──────────────────────────────────────────────────────
  {
    id: 'demo-1',
    title: 'Single Choice',
    prompt: 'You open a website and it loads instantly even though the server is thousands of kilometres away. Which technology makes this possible by caching content closer to users?',
    options: [
      'VPN (Virtual Private Network)',
      'CDN (Content Delivery Network)',
      'DNS (Domain Name System)',
      'DHCP (Dynamic Host Configuration Protocol)',
    ],
    correctIndex: 1,
    hint: 'Think about a network of servers distributed globally, each holding a copy of the content.',
    explainHtml: '<p>A <strong>CDN (Content Delivery Network)</strong> is a geographically distributed network of servers that cache and deliver web content from a location close to the user.</p><ul><li><em>VPN</em> encrypts your traffic and masks your IP — it does not speed up content delivery.</li><li><em>DNS</em> translates domain names to IP addresses but does not cache web content.</li><li><em>DHCP</em> automatically assigns IP addresses to devices on a network.</li></ul><p>When you stream a video on YouTube or load a page on Wikipedia, a CDN is almost certainly involved.</p>',
  },

  // ── 2. MULTIPLE CHOICE ────────────────────────────────────────────────────
  {
    id: 'demo-2',
    title: 'Multiple Choice',
    prompt: 'Your password was leaked in a data breach. Which of the following actions actually protect you? (Select all that apply)',
    options: [
      'Change the leaked password immediately on every site where you reused it',
      'Enable two-factor authentication (2FA) on your accounts',
      'Use a longer and more complex password next time',
      'Clear your browser cookies',
      'Check if your email appears on HaveIBeenPwned',
    ],
    multiSelect: true,
    correctIndices: [0, 1, 2, 4],
    hint: 'Clearing cookies does nothing against a server-side breach. The real actions target account takeover and future exposure.',
    explainHtml: '<p>When credentials are leaked, the risk is <strong>account takeover</strong> and <strong>credential stuffing</strong> (attackers trying your password on other sites).</p><ul><li><strong>Change the password everywhere</strong> ✓ — essential if you reused it.</li><li><strong>Enable 2FA</strong> ✓ — even with the correct password, attackers cannot log in without the second factor.</li><li><strong>Use a stronger password</strong> ✓ — harder to crack in future breaches.</li><li><em>Clear browser cookies</em> ✗ — cookies are stored on your machine, not the breached server. This does nothing.</li><li><strong>Check HaveIBeenPwned</strong> ✓ — lets you know which of your accounts are compromised and in which breaches.</li></ul>',
  },

  // ── 3. TEXT INPUT ─────────────────────────────────────────────────────────
  {
    id: 'demo-3',
    title: 'Text Answer',
    prompt: 'Git is used to track changes in code. What is the name of the command used to save a snapshot of your changes to the local repository?',
    type: 'text',
    placeholder: 'git ___',
    acceptedAnswers: ['commit', 'git commit'],
    caseSensitive: false,
    hint: 'It is not "save" or "push". It creates a permanent record in your local history.',
    explainHtml: '<p><code>git commit</code> saves a snapshot of the staged changes to your local repository history.</p><p>Think of it like a checkpoint in a game — you can always go back to it.</p><ul><li><code>git add</code> — stages the changes (selects what to include).</li><li><code>git commit</code> — saves the snapshot locally.</li><li><code>git push</code> — uploads commits to a remote repository like GitHub.</li></ul>',
  },

  // ── 4. CMD COMMAND LINE ───────────────────────────────────────────────────
  {
    id: 'demo-4',
    title: 'Windows CMD',
    prompt: 'Your colleague says their PC cannot reach any website, but local network drives still work. You want to test if they can reach Google\'s public DNS server (8.8.8.8). Type the command.',
    type: 'text',
    terminalVariant: 'cmd',
    commandPrefix: 'C:\\>',
    placeholder: 'Enter command here',
    acceptedAnswers: ['ping 8.8.8.8'],
    caseSensitive: false,
    hint: 'Use the most basic network reachability tool followed by the IP address.',
    explainHtml: '<p><code>ping 8.8.8.8</code> sends ICMP Echo Request packets to Google\'s public DNS server and waits for a reply.</p><ul><li>If replies come back → the PC has internet access at the IP level.</li><li>If it times out → the issue is either the ISP, the router, or a firewall blocking ICMP.</li></ul><p>This helps distinguish between a DNS problem (can\'t resolve names) and a full connectivity problem (can\'t reach IPs at all).</p>',
  },

  // ── 5. POWERSHELL COMMAND LINE ────────────────────────────────────────────
  {
    id: 'demo-5',
    title: 'PowerShell',
    prompt: 'You suspect a process called "malware.exe" is running on a Windows machine. Type the PowerShell command to search for it by name.',
    type: 'text',
    terminalVariant: 'powershell',
    commandPrefix: 'PS>',
    placeholder: 'Enter command here',
    acceptedAnswers: [
      'Get-Process malware',
      'Get-Process -Name malware',
      'get-process malware',
      'get-process -name malware',
    ],
    caseSensitive: false,
    hint: 'Use Get-Process and filter by name — you do not need the .exe extension.',
    explainHtml: '<p><code>Get-Process malware</code> searches for any running process whose name matches "malware".</p><p>If it returns results, the process is running and you can stop it with:</p><pre>Stop-Process -Name malware -Force</pre><p>This is a common first step in Windows incident response.</p>',
  },

  // ── 6. BASH COMMAND LINE ──────────────────────────────────────────────────
  {
    id: 'demo-6',
    title: 'Linux Bash',
    prompt: 'You want to find all files named "config.json" anywhere on the system starting from the root. Type the command.',
    type: 'text',
    terminalVariant: 'bash',
    placeholder: 'Enter command here',
    acceptedAnswers: [
      'find / -name config.json',
      'find / -name "config.json"',
    ],
    caseSensitive: false,
    hint: 'The command starts with "find", takes a starting path, and uses a flag to match by filename.',
    explainHtml: '<p><code>find / -name config.json</code> recursively searches the entire filesystem for files named exactly "config.json".</p><ul><li><code>/</code> — start from the root (entire system).</li><li><code>-name</code> — match by filename (case-sensitive).</li><li>Use <code>-iname</code> instead for case-insensitive search.</li></ul><p>Tip: add <code>2>/dev/null</code> at the end to hide permission errors.</p>',
  },

  // ── 7. ORDERING (drag & drop) ─────────────────────────────────────────────
  {
    id: 'demo-7',
    title: 'Ordering',
    prompt: 'You type "google.com" in your browser and press Enter. Put the following events in the correct order.',
    ordering: true,
    slots: ['1st', '2nd', '3rd', '4th'],
    possibilities: [
      'The browser sends an HTTP/S request to the server',
      'The browser checks its DNS cache or queries a DNS resolver',
      'The server returns the HTML page',
      'A TCP connection is established with the web server',
    ],
    correctOrder: [1, 3, 0, 2],
    hint: 'Before anything can happen, the browser needs to know the IP address of google.com.',
    explainHtml: '<p>Here is what happens behind the scenes when you visit a website:</p><ol><li><strong>DNS resolution</strong> — the browser looks up the IP address for google.com.</li><li><strong>TCP connection</strong> — a connection is established with the web server (+ TLS handshake for HTTPS).</li><li><strong>HTTP/S request</strong> — the browser asks the server for the page.</li><li><strong>Server response</strong> — the server sends back the HTML, CSS, and JavaScript.</li></ol>',
  },

  // ── 8. MATCHING (pair columns) ────────────────────────────────────────────
  {
    id: 'demo-8',
    title: 'Matching',
    prompt: 'Match each attack type with what it actually does.',
    matching: true,
    rows: [
      'Phishing',
      'Ransomware',
      'SQL Injection',
      'Man-in-the-Middle',
    ],
    choices: [
      'Intercepts communication between two parties',
      'Tricks users into revealing credentials via fake pages',
      'Encrypts victim files and demands payment',
      'Injects malicious code into a database query',
    ],
    correctMap: [1, 2, 3, 0],
    hint: 'Think about the target: users (social engineering), files (encryption), databases (code injection), or the network (interception).',
    explainHtml: '<ul><li><strong>Phishing → fake pages</strong>: attackers impersonate a trusted entity (bank, Google) to steal credentials.</li><li><strong>Ransomware → encrypts files</strong>: malware locks your data and demands a ransom to restore access.</li><li><strong>SQL Injection → database query</strong>: malicious SQL code is inserted into an input field to manipulate the database.</li><li><strong>Man-in-the-Middle → intercepts communication</strong>: the attacker secretly relays and possibly alters messages between two parties.</li></ul>',
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
