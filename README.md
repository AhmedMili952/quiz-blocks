# Quiz Blocks for Obsidian

Create fully interactive quizzes directly in Obsidian using simple JSON5 code blocks. Perfect for studying, testing knowledge, or creating engaging educational content.

![Version](https://img.shields.io/badge/version-1.3.0--beta-blue)
![Obsidian](https://img.shields.io/badge/Obsidian-1.5.0+-purple)

## Features

### Question Types
- **Single Choice** - Classic multiple choice with one correct answer
- **Multiple Choice** - Select all applicable answers
- **Text Input** - Free text answers with validation
- **Command Line** - CMD, PowerShell, and Bash terminal simulation
- **Ordering** - Drag & drop to arrange items in correct sequence
- **Matching** - Pair items from two columns

### Quiz Editor
- **Visual Editor** - Build quizzes without writing code
- **Live Preview** - See how your quiz looks while editing
- **Drag & Drop** - Reorder questions easily
- **Auto-save** - Changes saved automatically to the source file
- **JSON5 Export** - Generated clean, readable code

### Exam Mode
- **Timed Sessions** - Set duration limits for quizzes
- **Auto-submit** - Optional automatic submission when time runs out
- **Progress Timer** - Visual countdown display
- **Scoring** - Track performance across questions

### Navigation & UX
- **Hints** - Optional hints for each question
- **Explanations** - Show detailed explanations after answering
- **Smooth Transitions** - Animated question navigation
- **Keyboard Shortcuts** - Navigate quizzes without mouse
- **Responsive Design** - Works on desktop and mobile

## Installation

1. Download the latest release from the [Releases](https://github.com/yourusername/quiz-blocks/releases) page
2. Extract to your vault's `.obsidian/plugins/` folder
3. Enable the plugin in Obsidian's Community Plugins settings

## Quick Start

### Creating a Quiz

Create a code block with language `quiz-blocks`:

```quiz-blocks
[
  {
    title: "Question 1",
    prompt: "What is the capital of France?",
    options: ["London", "Berlin", "Paris", "Madrid"],
    correctIndex: 2
  }
]
```

### Using the Quiz Editor

Press `Ctrl+Shift+E` (or click the graduation cap icon in the ribbon) to open the Quiz Editor.

From there you can:
- Add questions via the "+" button
- Choose from different question types
- Edit content visually
- Reorder questions with arrow buttons
- Export the JSON5 code

### Opening Existing Quizzes

Press `Ctrl+Shift+Q` to open the quiz from the currently active note in the Quiz Editor.

Or use the "Open" button in the Quiz Editor to browse all notes containing quiz blocks.

## Question Type Examples

### Single Choice
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

### Multiple Choice
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

### Text Input
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

### Command Line
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

### Ordering
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

### Matching
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

## Exam Mode

Add exam configuration to your quiz:

```quiz-blocks
[
  {
    title: "Sample Question",
    prompt: "This is a sample question",
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

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+E` | Open Quiz Editor |
| `Ctrl+Shift+Q` | Open quiz from active note |
| `↑/↓` | Navigate questions (in quiz) |
| `Space/Enter` | Select answer |

## Tips

- Use **hints** to help users without giving away the answer
- Add **explanations** to help users learn from their mistakes
- Enable **exam mode** for time-limited assessments
- The Quiz Editor auto-saves changes back to the source file
- Questions with default titles ("Question 1", "Question 2", etc.) auto-update their numbering when reordered

## Development

### Building from Source

```bash
npm install
npm run build
```

The plugin will be built to `../../.obsidian/plugins/quiz-blocks/` (relative to the project directory).

## License

MIT License - feel free to use this plugin for personal or commercial projects.

## Credits

Created by Ahmed | Powered by Obsidian
