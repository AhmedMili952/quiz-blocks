<div align="center">

# 🧩 Quiz Blocks for Obsidian

**Create fully interactive quizzes directly in Obsidian using simple JSON5 code blocks.**  
Perfect for studying, testing knowledge, or creating engaging educational content.

[![Version](https://img.shields.io/badge/version-1.3.0--beta-blue?style=flat-square)](https://github.com/AhmedMili952/quiz-blocks/releases)
[![Obsidian](https://img.shields.io/badge/Obsidian-1.5.0+-7C3AED?style=flat-square&logo=obsidian&logoColor=white)](https://obsidian.md)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/AhmedMili952/quiz-blocks?style=flat-square)](https://github.com/AhmedMili952/quiz-blocks/stargazers)

</div>

---

## ✨ Features

### 🎯 Question Types

| Type | Description |
|------|-------------|
| **Single Choice** | Classic multiple choice with one correct answer |
| **Multiple Choice** | Select all applicable answers |
| **Text Input** | Free text answers with validation |
| **Command Line** | CMD, PowerShell, and Bash terminal simulation |
| **Ordering** | Drag & drop to arrange items in correct sequence |
| **Matching** | Pair items from two columns |

### 🛠️ Quiz Editor
- **Visual Editor** — Build quizzes without writing a single line of code
- **Live Preview** — See exactly how your quiz looks while editing
- **Drag & Drop** — Reorder questions instantly
- **Auto-save** — Changes saved automatically to the source file
- **JSON5 Export** — Clean, readable code output

### ⏱️ Exam Mode
- **Timed Sessions** — Set duration limits for quizzes
- **Auto-submit** — Optional automatic submission when time runs out
- **Progress Timer** — Visual countdown display
- **Scoring** — Track performance across all questions

### 🧭 Navigation & UX
- **Hints** — Optional hints for each question
- **Explanations** — Detailed explanations shown after answering
- **Smooth Transitions** — Animated question navigation
- **Keyboard Shortcuts** — Full keyboard navigation support
- **Responsive Design** — Works seamlessly on desktop and mobile

---

## 📦 Installation

### Manual Installation

1. Go to the [Releases](https://github.com/AhmedMili952/quiz-blocks/releases) page and download the latest release
2. Extract the files into your vault's plugin folder:
   ```
   <your-vault>/.obsidian/plugins/quiz-blocks/
   ```
3. Open Obsidian → **Settings** → **Community Plugins** → enable **Quiz Blocks**

> ⚠️ Make sure **Safe Mode** is disabled in Community Plugins to allow third-party plugins.

---

## 🚀 Quick Start

### Creating Your First Quiz

Create a code block with the language identifier `quiz-blocks`:

````markdown
```quiz-blocks
[
  {
    title: "My First Question",
    prompt: "What is the capital of France?",
    options: ["London", "Berlin", "Paris", "Madrid"],
    correctIndex: 2
  }
]
```
````

### Using the Visual Editor

Press `Ctrl+Shift+E` (or click the 🎓 icon in the ribbon) to open the Quiz Editor.

- ➕ Add questions via the **"+"** button
- 🎨 Choose from different question types
- ✏️ Edit content visually without touching JSON
- ↕️ Reorder questions with drag & drop
- 💾 Auto-saves back to your note

### Opening Existing Quizzes

Press `Ctrl+Shift+Q` to open the quiz from the currently active note, or use the **Open** button in the Quiz Editor to browse all notes containing quiz blocks.

---

## 📖 Question Type Examples

<details>
<summary><strong>Single Choice</strong></summary>

```quiz-blocks
[
  {
    title: "Single Choice",
    prompt: "What is 2 + 2?",
    options: ["3", "4", "5", "6"],
    correctIndex: 1
  }
]
```
</details>

<details>
<summary><strong>Multiple Choice</strong></summary>

```quiz-blocks
[
  {
    title: "Multiple Choice",
    prompt: "Select all prime numbers:",
    options: ["2", "4", "5", "9", "11"],
    multiSelect: true,
    correctIndices: [0, 2, 4]
  }
]
```
</details>

<details>
<summary><strong>Text Input</strong></summary>

```quiz-blocks
[
  {
    title: "Text Answer",
    prompt: "What is the chemical symbol for water?",
    acceptedAnswers: ["H2O", "h2o"],
    caseSensitive: false,
    placeholder: "Enter your answer..."
  }
]
```
</details>

<details>
<summary><strong>Command Line (PowerShell / CMD / Bash)</strong></summary>

```quiz-blocks
[
  {
    title: "PowerShell Command",
    prompt: "Which cmdlet lists all running processes?",
    type: "text",
    textVariant: "powershell",
    commandPrefix: "PS>",
    acceptedAnswers: ["Get-Process", "gps"],
    caseSensitive: false
  }
]
```
</details>

<details>
<summary><strong>Ordering</strong></summary>

```quiz-blocks
[
  {
    title: "Order Steps",
    prompt: "Arrange these steps in the correct order:",
    ordering: true,
    slots: ["Step 1", "Step 2", "Step 3"],
    possibilities: ["Bake", "Mix ingredients", "Preheat oven"],
    correctOrder: [2, 1, 0]
  }
]
```
</details>

<details>
<summary><strong>Matching</strong></summary>

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
</details>

---

## ⏱️ Exam Mode

Add an exam configuration object to your quiz array to enable timed sessions:

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

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+E` | Open Quiz Editor |
| `Ctrl+Shift+Q` | Open quiz from active note |
| `↑` / `↓` | Navigate between questions |
| `Space` / `Enter` | Select highlighted answer |

---

## 💡 Tips & Best Practices

- 🔍 Use **hints** to guide users without giving away the answer
- 📚 Add **explanations** so users learn from their mistakes
- ⏱️ Enable **exam mode** for time-limited assessments or mock exams
- 💾 The Quiz Editor **auto-saves** all changes directly to the source file
- 🔢 Questions with default titles auto-update their numbering when reordered
- 🖥️ The **Command Line** type is great for IT/networking certification practice

---

## 🛠️ Development

### Prerequisites

- Node.js 18+
- npm

### Building from Source

```bash
# Clone the repository
git clone https://github.com/AhmedMili952/quiz-blocks.git
cd quiz-blocks

# Install dependencies
npm install

# Build for production
npm run build

# Build in watch mode (for development)
npm run dev
```

### Publishing a New Release

```bash
# Tag the new version — GitHub Actions handles the rest
git tag v1.4.0-beta
git push origin v1.4.0-beta
```

The CI/CD pipeline will automatically build and publish the release with all required assets (`main.js`, `manifest.json`, `styles.css`).

---

## 📄 License

This project is licensed under the **MIT License** — free to use for personal and commercial projects.

---

<div align="center">

Made with ❤️ by [Ahmed](https://github.com/AhmedMili952) · Powered by [Obsidian](https://obsidian.md)

</div>
