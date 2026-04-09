# Quiz Blocks [![plugin](https://img.shields.io/github/v/release/AhmedMili952/quiz-blocks?label=plugin&display_name=tag&logo=obsidian&color=purple&logoColor=violet)](https://github.com/AhmedMili952/quiz-blocks/releases)

Render ` ```quiz-blocks ` code blocks into fully interactive quizzes directly inside Obsidian notes.

---

## How it works

You describe a quiz using a JSON5 code block. The plugin transforms it into a rich interactive form with multiple question types, a visual editor, exam mode, and more. There is a **Check** button that highlights right, wrong, and missed answers, with optional `hint` and `explanation` commentary. Great for self-education, certification prep, and learning notes.

---

## Supported question types

### Single Choice — one correct answer

<img src=".github/demo-single-choice.png" width="430" alt="Single choice demo" />

### Multiple Choice — several correct answers

<img src=".github/demo-multiple-choice.png" width="430" alt="Multiple choice demo" />

### Text Input — free text with validation

<img src=".github/demo-text-input.png" width="430" alt="Text input demo" />

### Command Line — terminal simulation

Three variants available: **CMD**, **PowerShell**, and **Bash**.

<img src=".github/demo-cmd.png" width="430" alt="CMD demo" />
<img src=".github/demo-powershell.png" width="430" alt="PowerShell demo" />
<img src=".github/demo-bash.png" width="430" alt="Bash demo" />

### Ordering — drag & drop to arrange items

<img src=".github/demo-ordering.png" width="430" alt="Ordering demo" />

### Matching — pair items from two columns

<img src=".github/demo-matching.png" width="430" alt="Matching demo" />

---

## Exam Mode

<img src=".github/demo-exam-mode.png" width="430" alt="Exam mode demo" />

Add an exam configuration object anywhere in your quiz array to enable timed sessions with a countdown timer and auto-submit.

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

The recommended way to install **Quiz Blocks** is via **BRAT** (Beta Reviewers Auto-update Tool), which handles installation and automatic updates directly from GitHub.

1. Install the [BRAT plugin](https://obsidian.md/plugins?id=obsidian42-brat) from the Obsidian Community Plugins.
2. Open BRAT settings and click **Add Beta Plugin**.
3. Paste the repository URL:
   ```
   https://github.com/AhmedMili952/quiz-blocks
   ```
4. Click **Add Plugin** — BRAT will install it automatically.
5. Go to **Settings → Community plugins** and enable **Quiz Blocks**.

BRAT will notify you whenever a new version is available and update with one click.

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
