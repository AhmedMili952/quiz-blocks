# Quiz Blocks [![plugin](https://img.shields.io/github/v/release/AhmedMili952/quiz-blocks?label=plugin&display_name=tag&logo=obsidian&color=purple&logoColor=violet)](https://github.com/AhmedMili952/quiz-blocks/releases)

Render ` ```quiz-blocks ` code blocks into fully interactive quizzes directly inside Obsidian notes.

---

## How it works

You describe a quiz using a JSON5 code block. The plugin transforms it into a rich interactive form with multiple question types, a visual editor, exam mode, and more. There is a **Check** button that highlights right, wrong, and missed answers, with optional `hint` and `explanation` commentary. Great for self-education, certification prep, and learning notes.

---

## Supported question types

### Single Choice — one correct answer

<img src=".github/demo-single-choice.png" width="430" alt="Single choice demo" />

````
```quiz-blocks
[
  {
    title: "Single Choice",
    prompt: "You receive an email from your bank asking you to click a link and confirm your password urgently. What should you do?",
    options: [
      "Click the link and enter your credentials quickly before it expires",
      "Reply to the email asking if it is legitimate",
      "Go directly to your bank website by typing the URL yourself",
      "Forward the email to friends to warn them"
    ],
    correctIndex: 2,
    hint: "Legitimate banks never ask for your password by email.",
    explanation: "This is a classic phishing attack. Always type the URL yourself and never click links in suspicious emails."
  }
]
```
````

---

### Multiple Choice — several correct answers

<img src=".github/demo-multiple-choice.png" width="430" alt="Multiple choice demo" />

````
```quiz-blocks
[
  {
    title: "Multiple Choice",
    prompt: "Which of the following are good habits for a strong password? (Select all that apply)",
    options: [
      "Use a different password for every account",
      "Include your date of birth for easy recall",
      "Use a mix of uppercase, lowercase, numbers, and symbols",
      "Use a password manager to store them",
      "Reuse your strongest password on all important sites"
    ],
    multiSelect: true,
    correctIndices: [0, 2, 3],
    explanation: "Personal info and password reuse are the two biggest weaknesses. A password manager removes the need to remember them all."
  }
]
```
````

---

### Text Input — free text with validation

<img src=".github/demo-text-input.png" width="430" alt="Text input demo" />

````
```quiz-blocks
[
  {
    title: "Text Answer",
    prompt: "In a URL like 'https://bank.example.com', what is the part that guarantees the connection is encrypted?",
    type: "text",
    placeholder: "Enter the protocol prefix...",
    acceptedAnswers: ["https", "HTTPS"],
    caseSensitive: false,
    explanation: "HTTPS means the connection is encrypted with TLS. Never enter passwords on a plain http:// site."
  }
]
```
````

---

### Command Line — terminal simulation (CMD / PowerShell / Bash)

<img src=".github/demo-command-line.png" width="430" alt="Command line demo" />

````
```quiz-blocks
[
  {
    title: "Windows CMD",
    prompt: "Your internet is slow. Type the command to test if your PC can reach Google by IP (8.8.8.8) to rule out a DNS issue.",
    type: "text",
    terminalVariant: "cmd",
    commandPrefix: "C:\\>",
    acceptedAnswers: ["ping 8.8.8.8"],
    caseSensitive: false,
    explanation: "ping 8.8.8.8 bypasses DNS. If it works, your connection is fine and the problem is DNS resolution."
  }
]
```
````

---

### Ordering — drag & drop to arrange items

<img src=".github/demo-ordering.png" width="430" alt="Ordering demo" />

````
```quiz-blocks
[
  {
    title: "Ordering",
    prompt: "You want to push code to GitHub. Put these Git steps in the correct order.",
    ordering: true,
    slots: ["1st", "2nd", "3rd", "4th"],
    possibilities: [
      "git push",
      "git add .",
      "git commit -m \"message\"",
      "Make changes to your files"
    ],
    correctOrder: [3, 1, 2, 0],
    explanation: "Make changes → git add → git commit → git push."
  }
]
```
````

---

### Matching — pair items from two columns

<img src=".github/demo-matching.png" width="430" alt="Matching demo" />

````
```quiz-blocks
[
  {
    title: "Matching",
    prompt: "Match each HTTP status code with what it means.",
    matching: true,
    rows: ["200", "404", "403", "500"],
    choices: [
      "Forbidden — you do not have permission",
      "Internal Server Error — something broke on the server",
      "Not Found — the page does not exist",
      "OK — the request succeeded"
    ],
    correctMap: [3, 2, 0, 1],
    explanation: "2xx = success, 4xx = client error, 5xx = server error."
  }
]
```
````

---

## Exam Mode

<img src=".github/demo-exam-mode.png" width="430" alt="Exam mode demo" />

Add an exam configuration object anywhere in your quiz array to enable timed sessions:

````
```quiz-blocks
[
  {
    title: "Sample Question",
    prompt: "This is a timed question",
    options: ["A", "B", "C"],
    correctIndex: 0
  },
  {
    examMode: true,
    examDurationMinutes: 10,
    examAutoSubmit: true,
    examShowTimer: true
  }
]
```
````

---

## Visual Editor

<img src=".github/demo-editor.png" width="430" alt="Visual editor demo" />

Press `Ctrl+Shift+E` (or click the 🎓 icon in the ribbon) to open the **Quiz Editor** — build and edit quizzes without writing any code.

- ➕ Add questions via the **"+"** button
- 🎨 Choose from all supported question types
- ✏️ Edit content visually
- ↕️ Reorder questions with drag & drop
- 💾 Auto-saves changes directly to your note

---

## Installation

**Quiz Blocks** can be installed manually from GitHub.

<details><summary>Show steps</summary>

1. Go to the [Releases](https://github.com/AhmedMili952/quiz-blocks/releases) page and download the latest release.
2. Extract the ZIP file.
3. Copy the extracted folder into your vault's plugin directory:
   ```
   YOUR_VAULT/.obsidian/plugins/quiz-blocks/
   ```
4. Restart Obsidian or go to **Settings → Community plugins** and click **Reload plugins**.
5. Enable **Quiz Blocks** from the list.

</details>

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+E` | Open Quiz Editor |
| `Ctrl+Shift+Q` | Open quiz from active note |
| `↑` / `↓` | Navigate between questions |
| `Space` / `Enter` | Select highlighted answer |

---

## Notes & limitations

This plugin is in active beta development — bugs are possible. Feel free to [open an issue](https://github.com/AhmedMili952/quiz-blocks/issues/new) and share feedback.

- Answers are not persisted between sessions
- The visual editor requires the note to be in edit mode
- The `esbuild.config.mjs` build path is configured for a local Obsidian vault — adjust it for your setup

---

## Try it yourself

Want to test all question types at once in your vault?

👉 **[Copy the full demo template](https://github.com/AhmedMili952/quiz-blocks/blob/main/demo-template.md)** — open the file, click the **Copy** button, paste it into a new Obsidian note, and the quiz is ready to run.

---

If you find this plugin useful, please consider starring the repository ⭐️

<br>
<br>
