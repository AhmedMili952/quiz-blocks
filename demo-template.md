# Quiz Blocks — Demo Template

Copy the entire block below (including the ` ```quiz-blocks ` and closing ` ``` `) into any Obsidian note to run the full demo.

````md
```quiz-blocks
[
  // ── 1. SINGLE CHOICE ──────────────────────────────────────────────────────
  {
    id: 'demo-1',
    title: 'Single Choice',
    prompt: 'Which OSI layer is responsible for logical addressing and routing?',
    options: [
      'Layer 1 — Physical',
      'Layer 2 — Data Link',
      'Layer 3 — Network',
      'Layer 4 — Transport',
    ],
    correctIndex: 2,
    hint: 'This layer uses IP addresses to determine the best path to a destination.',
    explainHtml: '<p><strong>Layer 3 — Network</strong> handles logical addressing (IP) and routes packets between networks.</p><ul><li>Layer 1 carries raw bits on the wire.</li><li>Layer 2 uses MAC addresses and frames.</li><li>Layer 4 manages end-to-end communication between applications.</li></ul>',
  },

  // ── 2. MULTIPLE CHOICE ────────────────────────────────────────────────────
  {
    id: 'demo-2',
    title: 'Multiple Choice',
    prompt: 'Which of the following are characteristics of TCP? (Select all that apply)',
    options: [
      'Connection-oriented',
      'Provides reliable delivery',
      'Uses a three-way handshake',
      'Does not guarantee delivery',
      'Lower overhead than UDP',
    ],
    multiSelect: true,
    correctIndices: [0, 1, 2],
    hint: 'TCP is designed for reliability — think about what makes it different from UDP.',
    explainHtml: '<p><strong>TCP</strong> guarantees ordered, reliable delivery.</p><ul><li><strong>Connection-oriented</strong> ✓ — establishes a connection first.</li><li><strong>Reliable delivery</strong> ✓ — uses ACKs and retransmission.</li><li><strong>Three-way handshake</strong> ✓ — SYN → SYN-ACK → ACK.</li><li><em>Does not guarantee delivery</em> ✗ — that describes UDP.</li><li><em>Lower overhead than UDP</em> ✗ — TCP has more overhead, not less.</li></ul>',
  },

  // ── 3. TEXT INPUT ─────────────────────────────────────────────────────────
  {
    id: 'demo-3',
    title: 'Text Answer',
    prompt: 'What is the default subnet mask for a Class C IP address?',
    type: 'text',
    placeholder: 'Enter your answer (e.g. 255.x.x.x)',
    acceptedAnswers: ['255.255.255.0', '/24'],
    caseSensitive: false,
    hint: 'A Class C address uses 24 bits for the network portion.',
    explainHtml: '<p>The default subnet mask for a <strong>Class C</strong> network is <code>255.255.255.0</code> (also written as <code>/24</code>).</p><p>The first 24 bits identify the network and the last 8 bits identify the host, allowing up to 254 usable hosts per subnet.</p>',
  },

  // ── 4. CMD COMMAND LINE ───────────────────────────────────────────────────
  {
    id: 'demo-4',
    title: 'Windows CMD',
    prompt: 'Type the Windows CMD command to display the full IP configuration of all network interfaces.',
    type: 'text',
    terminalVariant: 'cmd',
    commandPrefix: 'C:\\>',
    placeholder: 'Enter command here',
    acceptedAnswers: ['ipconfig /all'],
    caseSensitive: false,
    hint: 'It extends the basic ipconfig command with a flag that means "all details".',
    explainHtml: '<p><code>ipconfig /all</code> displays the full IP configuration: MAC address, DNS servers, DHCP status, IPv4 and IPv6 addresses.</p><p>Without <code>/all</code>, only the basic IP, mask, and gateway are shown.</p>',
  },

  // ── 5. POWERSHELL COMMAND LINE ────────────────────────────────────────────
  {
    id: 'demo-5',
    title: 'PowerShell Cmdlet',
    prompt: 'Type the PowerShell cmdlet used to test network connectivity to a remote host (the modern equivalent of ping).',
    type: 'text',
    terminalVariant: 'powershell',
    commandPrefix: 'PS>',
    placeholder: 'Enter cmdlet here',
    acceptedAnswers: ['Test-Connection', 'test-connection'],
    caseSensitive: false,
    hint: 'PowerShell cmdlets follow the Verb-Noun pattern. The verb here is "Test".',
    explainHtml: '<p><code>Test-Connection</code> sends ICMP echo requests to a target host and returns response statistics — it is the PowerShell equivalent of <code>ping</code>.</p><p>Example: <code>Test-Connection 8.8.8.8</code></p>',
  },

  // ── 6. BASH COMMAND LINE ──────────────────────────────────────────────────
  {
    id: 'demo-6',
    title: 'Linux Bash',
    prompt: 'Type the Linux command to display all network interfaces and their IP addresses.',
    type: 'text',
    terminalVariant: 'bash',
    placeholder: 'Enter command here',
    acceptedAnswers: ['ip addr', 'ip a', 'ip addr show'],
    caseSensitive: false,
    hint: 'This command is part of the iproute2 suite and replaces the older ifconfig.',
    explainHtml: '<p><code>ip addr</code> (or <code>ip a</code>) shows all network interfaces with their IPv4/IPv6 addresses, state, and MAC addresses.</p><p>It is the modern replacement for <code>ifconfig</code>, which is no longer installed by default on most distributions.</p>',
  },

  // ── 7. ORDERING (drag & drop) ─────────────────────────────────────────────
  {
    id: 'demo-7',
    title: 'Ordering',
    prompt: 'Place the steps of the TCP three-way handshake in the correct chronological order.',
    ordering: true,
    slots: ['Step 1', 'Step 2', 'Step 3'],
    possibilities: [
      'Client sends SYN',
      'Server sends SYN-ACK',
      'Client sends ACK',
    ],
    correctOrder: [0, 1, 2],
    hint: 'The client always initiates. The server responds. The client confirms.',
    explainHtml: '<p>The <strong>TCP three-way handshake</strong> opens a reliable connection in three steps:</p><ol><li><strong>SYN</strong> — client requests a connection.</li><li><strong>SYN-ACK</strong> — server acknowledges and sends its own SYN.</li><li><strong>ACK</strong> — client confirms. Connection is now established.</li></ol>',
  },

  // ── 8. MATCHING (pair columns) ────────────────────────────────────────────
  {
    id: 'demo-8',
    title: 'Matching',
    prompt: 'Match each protocol with its default port number.',
    matching: true,
    rows: ['HTTP', 'HTTPS', 'DNS', 'SSH'],
    choices: ['Port 22', 'Port 53', 'Port 80', 'Port 443'],
    correctMap: [2, 3, 1, 0],
    hint: 'HTTP is unencrypted web. HTTPS adds TLS. DNS resolves names. SSH is secure remote access.',
    explainHtml: '<ul><li><strong>HTTP → Port 80</strong>: standard unencrypted web traffic.</li><li><strong>HTTPS → Port 443</strong>: encrypted web traffic (HTTP + TLS).</li><li><strong>DNS → Port 53</strong>: domain name to IP resolution.</li><li><strong>SSH → Port 22</strong>: secure remote shell access.</li></ul>',
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
