# Quiz Blocks — Demo Template

This note showcases all supported question types of the **quiz-blocks** plugin.
Copy any block into your own notes to get started.

---

## 1. Single Choice (radio)

```quiz-blocks
[
  {
    id: 'demo-single-1',
    title: 'Single Choice',
    prompt: 'Which layer of the OSI model is responsible for logical addressing and routing?',
    options: [
      'Layer 1 — Physical',
      'Layer 2 — Data Link',
      'Layer 3 — Network',
      'Layer 4 — Transport',
    ],
    correctIndex: 2,
    hint: 'This layer uses IP addresses to determine the best path to a destination.',
    explainHtml: '<p><strong>Layer 3 — Network</strong> is responsible for logical addressing (IP) and routing packets between different networks.</p><ul><li>Layer 1 handles bits on the wire.</li><li>Layer 2 handles MAC addresses and framing.</li><li>Layer 4 handles end-to-end communication between applications.</li></ul>'
  }
]
```

---

## 2. Multiple Choice (checkbox)

```quiz-blocks
[
  {
    id: 'demo-multi-1',
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
    hint: 'TCP is designed for reliability. Think about what makes it different from UDP.',
    explainHtml: '<p><strong>TCP</strong> is a connection-oriented protocol that ensures reliable, ordered delivery of data.</p><ul><li><strong>Connection-oriented</strong> ✓ — TCP establishes a connection before transmitting.</li><li><strong>Reliable delivery</strong> ✓ — TCP uses acknowledgements and retransmission.</li><li><strong>Three-way handshake</strong> ✓ — SYN → SYN-ACK → ACK.</li><li><em>Does not guarantee delivery</em> ✗ — That describes UDP, not TCP.</li><li><em>Lower overhead than UDP</em> ✗ — TCP has more overhead due to its reliability mechanisms.</li></ul>'
  }
]
```

---

## 3. Text Input (free answer)

```quiz-blocks
[
  {
    id: 'demo-text-1',
    title: 'Text Answer',
    prompt: 'What is the default subnet mask for a Class C IP address?',
    type: 'text',
    placeholder: 'Enter your answer (e.g. 255.x.x.x)',
    acceptedAnswers: [
      '255.255.255.0',
      '/24',
    ],
    caseSensitive: false,
    hint: 'A Class C address uses 24 bits for the network portion.',
    explainHtml: '<p>The default subnet mask for a <strong>Class C</strong> network is <code>255.255.255.0</code>, also written as <code>/24</code> in CIDR notation.</p><p>It means the first 24 bits identify the network and the last 8 bits identify the host.</p>'
  }
]
```

---

## 4. Command Line — CMD

```quiz-blocks
[
  {
    id: 'demo-cmd-1',
    title: 'Windows CMD',
    prompt: 'Type the Windows command to display the full IP configuration of all network interfaces.',
    type: 'text',
    terminalVariant: 'cmd',
    commandPrefix: 'C:\\>',
    placeholder: 'Enter command here',
    acceptedAnswers: [
      'ipconfig /all',
    ],
    caseSensitive: false,
    hint: 'It extends the basic ipconfig command with a flag that means "all details".',
    explainHtml: '<p><code>ipconfig /all</code> displays the full IP configuration including MAC address, DNS servers, DHCP status, and IPv6 addresses.</p><p>Without <code>/all</code>, only basic IP/mask/gateway info is shown.</p>'
  }
]
```

---

## 5. Command Line — PowerShell

```quiz-blocks
[
  {
    id: 'demo-ps-1',
    title: 'PowerShell Cmdlet',
    prompt: 'Type the PowerShell cmdlet used to test network connectivity to a remote host (equivalent of ping).',
    type: 'text',
    terminalVariant: 'powershell',
    commandPrefix: 'PS>',
    placeholder: 'Enter cmdlet here',
    acceptedAnswers: [
      'Test-Connection',
      'test-connection',
    ],
    caseSensitive: false,
    hint: 'PowerShell cmdlets follow the Verb-Noun pattern. The verb here is "Test".',
    explainHtml: '<p><code>Test-Connection</code> is the PowerShell equivalent of <code>ping</code>. It sends ICMP echo requests to a target host and returns response statistics.</p><p>Example: <code>Test-Connection 8.8.8.8</code></p>'
  }
]
```

---

## 6. Command Line — Bash

```quiz-blocks
[
  {
    id: 'demo-bash-1',
    title: 'Linux Bash',
    prompt: 'Type the Linux command to display all network interfaces and their IP addresses.',
    type: 'text',
    terminalVariant: 'bash',
    placeholder: 'Enter command here',
    acceptedAnswers: [
      'ip addr',
      'ip a',
      'ip addr show',
    ],
    caseSensitive: false,
    hint: 'This command is part of the iproute2 suite and replaces the older ifconfig.',
    explainHtml: '<p><code>ip addr</code> (or <code>ip a</code>) displays all network interfaces along with their IPv4 and IPv6 addresses, state, and MAC addresses.</p><p>It is the modern replacement for <code>ifconfig</code>, which is no longer installed by default on many distributions.</p>'
  }
]
```

---

## 7. Ordering (drag & drop)

```quiz-blocks
[
  {
    id: 'demo-ordering-1',
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
    hint: 'The client always initiates the handshake. The server responds, then the client confirms.',
    explainHtml: '<p>The <strong>TCP three-way handshake</strong> establishes a connection in three steps:</p><ol><li><strong>SYN</strong> — The client sends a synchronization segment to initiate the connection.</li><li><strong>SYN-ACK</strong> — The server acknowledges and sends its own SYN back.</li><li><strong>ACK</strong> — The client acknowledges the server SYN. The connection is now established.</li></ol>'
  }
]
```

---

## 8. Matching (pair columns)

```quiz-blocks
[
  {
    id: 'demo-matching-1',
    title: 'Matching',
    prompt: 'Match each protocol with its default port number.',
    matching: true,
    rows: [
      'HTTP',
      'HTTPS',
      'DNS',
      'SSH',
    ],
    choices: [
      'Port 22',
      'Port 53',
      'Port 80',
      'Port 443',
    ],
    correctMap: [2, 3, 1, 0],
    hint: 'HTTP is the unencrypted web protocol. HTTPS adds TLS. DNS resolves names to IPs. SSH is secure remote access.',
    explainHtml: '<ul><li><strong>HTTP → Port 80</strong>: unencrypted web traffic.</li><li><strong>HTTPS → Port 443</strong>: encrypted web traffic (HTTP + TLS).</li><li><strong>DNS → Port 53</strong>: domain name resolution.</li><li><strong>SSH → Port 22</strong>: secure remote shell access.</li></ul>'
  }
]
```

---

## 9. Full Demo Quiz (all types + exam mode)

This block combines all question types in a single timed session.

```quiz-blocks
[
  {
    id: 'q1',
    title: 'Question 1 — Single Choice',
    prompt: 'Which protocol resolves an IPv4 address to a MAC address on a local network?',
    options: ['DNS', 'DHCP', 'ARP', 'ICMP'],
    correctIndex: 2,
    hint: 'This protocol sends a broadcast asking: "Who has IP x.x.x.x? Tell me your MAC."',
    explainHtml: '<p><strong>ARP</strong> (Address Resolution Protocol) maps a known IPv4 address to its corresponding MAC address on the local network segment.</p>'
  },
  {
    id: 'q2',
    title: 'Question 2 — Multiple Choice',
    prompt: 'Which of the following are connection-oriented protocols? (Select all that apply)',
    options: ['TCP', 'UDP', 'HTTP', 'FTP', 'DNS'],
    multiSelect: true,
    correctIndices: [0, 2, 3],
    hint: 'Think about which protocols require a connection to be established before transferring data.',
    explainHtml: '<ul><li><strong>TCP</strong> ✓ — connection-oriented at the transport layer.</li><li><em>UDP</em> ✗ — connectionless.</li><li><strong>HTTP</strong> ✓ — runs over TCP, so connection-oriented.</li><li><strong>FTP</strong> ✓ — also runs over TCP.</li><li><em>DNS</em> ✗ — typically uses UDP (though TCP for large transfers).</li></ul>'
  },
  {
    id: 'q3',
    title: 'Question 3 — Text Input',
    prompt: 'What command-line tool sends ICMP echo requests to test network reachability?',
    type: 'text',
    placeholder: 'Type the command name',
    acceptedAnswers: ['ping'],
    caseSensitive: false,
    hint: 'It is one of the most basic network troubleshooting tools, available on Windows, Linux, and macOS.',
    explainHtml: '<p><code>ping</code> sends ICMP Echo Request packets to a target host and listens for Echo Reply packets. It is used to verify basic connectivity and measure round-trip time.</p>'
  },
  {
    id: 'q4',
    title: 'Question 4 — CMD',
    prompt: 'Type the Windows CMD command to display the routing table.',
    type: 'text',
    terminalVariant: 'cmd',
    commandPrefix: 'C:\\>',
    placeholder: 'Enter command',
    acceptedAnswers: ['route print', 'netstat -r'],
    caseSensitive: false,
    hint: 'The command starts with the word "route" followed by an action keyword.',
    explainHtml: '<p><code>route print</code> displays the IPv4 and IPv6 routing tables on a Windows machine. It shows network destinations, netmasks, gateways, and interface indices.</p>'
  },
  {
    id: 'q5',
    title: 'Question 5 — Ordering',
    prompt: 'Place the OSI model layers in order from Layer 7 (top) to Layer 4 (bottom).',
    ordering: true,
    slots: ['Layer 7', 'Layer 6', 'Layer 5', 'Layer 4'],
    possibilities: [
      'Application',
      'Presentation',
      'Session',
      'Transport',
    ],
    correctOrder: [0, 1, 2, 3],
    hint: 'Remember: All People Seem To Need Data Processing.',
    explainHtml: '<p>The top four OSI layers (highest to lowest):</p><ol><li><strong>Layer 7 — Application</strong>: user-facing protocols (HTTP, DNS, FTP).</li><li><strong>Layer 6 — Presentation</strong>: data formatting, encryption, compression.</li><li><strong>Layer 5 — Session</strong>: manages sessions between applications.</li><li><strong>Layer 4 — Transport</strong>: end-to-end communication (TCP, UDP).</li></ol>'
  },
  {
    id: 'q6',
    title: 'Question 6 — Matching',
    prompt: 'Match each network device with its primary function.',
    matching: true,
    rows: ['Switch', 'Router', 'Hub', 'Firewall'],
    choices: [
      'Filters traffic based on security rules',
      'Forwards frames using MAC addresses',
      'Routes packets between different networks',
      'Broadcasts all traffic to every port',
    ],
    correctMap: [1, 2, 3, 0],
    hint: 'A switch is smarter than a hub. A router works at Layer 3. A firewall enforces security policies.',
    explainHtml: '<ul><li><strong>Switch → MAC-based forwarding</strong>: learns MAC addresses and forwards frames only to the correct port.</li><li><strong>Router → inter-network routing</strong>: forwards packets between different IP networks using routing tables.</li><li><strong>Hub → broadcasts everything</strong>: repeats all received signals to every connected port (no intelligence).</li><li><strong>Firewall → security filtering</strong>: inspects and allows or denies traffic based on rules.</li></ul>'
  },
  {
    examMode: true,
    examDurationMinutes: 5,
    examAutoSubmit: true,
    examShowTimer: true
  }
]
```
