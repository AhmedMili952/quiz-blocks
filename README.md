# Quiz Blocks [![plugin](https://img.shields.io/github/v/release/AhmedMili952/quiz-blocks?label=plugin&display_name=tag&logo=obsidian&color=purple&logoColor=violet)](https://github.com/AhmedMili952/quiz-blocks/releases)

Render ` ```quiz-blocks ` code blocks into fully interactive quizzes directly inside Obsidian notes.

---

## How it works

You describe a quiz using a JSON5 code block. The plugin transforms it into a rich interactive form with multiple question types, a visual editor, exam mode, and more. There is a **Check** button that highlights right, wrong, and missed answers, with optional `hint` and `explanation` commentary. Great for self-education, certification prep, and learning notes.

---

## Supported question types

### Single Choice — one correct answer

<img src=".github/demo-single-choice.png" width="430" alt="Single choice demo" />

> **`demo-single-choice.png`** — Screenshot of a rendered single choice question in Obsidian with one option selected and the Check button visible.

<details><summary>show code</summary>

````
```quiz-blocks
[
  {
    title: "Single Choice",
    prompt: "What is the capital of France?",
    options: ["London", "Berlin", "Paris", "Madrid"],
    correctIndex: 2,
    explanation: "Paris has been the capital of France since the 10th century."
  }
]
```
````

</details>

---

### Multiple Choice — several correct answers

<img src=".github/demo-multiple-choice.png" width="430" alt="Multiple choice demo" />

> **`demo-multiple-choice.png`** — Screenshot showing a multiple choice question with checkboxes, some correct and some wrong answers highlighted after clicking Check.

<details><summary>show code</summary>

````
```quiz-blocks
[
  {
    title: "Multiple Choice",
    prompt: "Select all prime numbers:",
    options: ["2", "4", "5", "9", "11"],
    multiSelect: true,
    correctIndices: [0, 2, 4],
    explanation: "Prime numbers are only divisible by 1 and themselves."
  }
]
```
````

</details>

---

### Text Input — free text with validation

<img src=".github/demo-text-input.png" width="430" alt="Text input demo" />

> **`demo-text-input.png`** — Screenshot of a text input question with a text field, showing a correct answer highlighted in green after validation.

<details><summary>show code</summary>

````
```quiz-blocks
[
  {
    title: "Text Answer",
    prompt: "What is the chemical symbol for water?",
    acceptedAnswers: ["H2O", "h2o"],
    caseSensitive: false,
    placeholder: "Enter your answer...",
    explanation: "Water is composed of 2 hydrogen atoms and 1 oxygen atom."
  }
]
```
````

</details>

---

### Command Line — terminal simulation (CMD / PowerShell / Bash)

<img src=".github/demo-command-line.png" width="430" alt="Command line demo" />

> **`demo-command-line.png`** — Screenshot of a PowerShell-style terminal input question with the `PS>` prefix, showing a correct command typed and validated.

<details><summary>show code</summary>

````
```quiz-blocks
[
  {
    title: "PowerShell Command",
    prompt: "Which cmdlet lists all running processes?",
    type: "text",
    textVariant: "powershell",
    commandPrefix: "PS>",
    acceptedAnswers: ["Get-Process", "gps"],
    caseSensitive: false,
    explanation: "Get-Process (alias: gps) retrieves all active processes."
  }
]
```
````

</details>

---

### Ordering — drag & drop to arrange items

<img src=".github/demo-ordering.png" width="430" alt="Ordering demo" />

> **`demo-ordering.png`** — Screenshot of an ordering question with draggable items being reordered into the correct sequence.

<details><summary>show code</summary>

````
```quiz-blocks
[
  {
    title: "Order Steps",
    prompt: "Arrange these steps in the correct order to bake a cake:",
    ordering: true,
    slots: ["Step 1", "Step 2", "Step 3"],
    possibilities: ["Bake", "Mix ingredients", "Preheat oven"],
    correctOrder: [2, 1, 0]
  }
]
```
````

</details>

---

### Matching — pair items from two columns

<img src=".github/demo-matching.png" width="430" alt="Matching demo" />

> **`demo-matching.png`** — Screenshot of a matching question with two columns of items connected by lines, showing correct and incorrect pairings highlighted.

<details><summary>show code</summary>

````
```quiz-blocks
[
  {
    title: "Match Pairs",
    prompt: "Match the countries with their capitals:",
    matching: true,
    rows: ["France", "Germany", "Spain"],
    choices: ["Paris", "Berlin", "Madrid"],
    correctMap: [0, 1, 2]
  }
]
```
````

</details>

---

## Exam Mode

<img src=".github/demo-exam-mode.png" width="430" alt="Exam mode demo" />

> **`demo-exam-mode.png`** — Screenshot of a quiz running in exam mode with a visible countdown timer in the top right corner and an auto-submit warning.

Add an exam configuration object anywhere in your quiz array to enable timed sessions:

<details><summary>show code</summary>

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

</details>

---

## Visual Editor

<img src=".github/demo-editor.png" width="430" alt="Visual editor demo" />

> **`demo-editor.png`** — Screenshot of the Quiz Editor panel open in Obsidian, showing a list of questions on the left and the edit form on the right with a live preview.

Press `Ctrl+Shift+E` (or click the 🎓 icon in the ribbon) to open the **Quiz Editor** — build and edit quizzes without writing any code.

- ➕ Add questions via the **"+"** button
- 🎨 Choose from all supported question types
- ✏️ Edit content visually
- ↕️ Reorder questions with drag & drop
- 💾 Auto-saves changes directly to your note

---

## Installation

**Quiz Blocks** can be installed manually from GitHub.

#### Install manually

<details><summary>show steps</summary>

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

If you find this plugin useful, please consider starring the repository ⭐️

<br>
<br>
