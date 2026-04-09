'use strict';

const obsidian = require("obsidian");
const { parseQuizSource, renderInteractiveQuiz } = require("./engine");
const { QuizBuilderView, VIEW_TYPE } = require("./editor");

const PLUGIN_ID = "quiz-blocks";
const PLUGIN_NAME = "Quiz Blocks";
const QUIZ_BLOCK_LANGUAGE = "quiz-blocks";

const DEFAULT_SETTINGS = {
	enableCodeHighlighting: true
};

function createLogger() {
	return {
		debug(...args) {
			console.debug(`[${PLUGIN_ID}]`, ...args);
		},
		info(...args) {
			console.log(`[${PLUGIN_ID}]`, ...args);
		},
		warn(...args) {
			console.warn(`[${PLUGIN_ID}]`, ...args);
		},
		error(...args) {
			console.error(`[${PLUGIN_ID}]`, ...args);
		}
	};
}

class QuizBlocksSettingTab extends obsidian.PluginSettingTab {
	constructor(app, plugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: PLUGIN_NAME });

		containerEl.createEl("p", {
			text: "Create interactive quizzes in Obsidian from quiz-blocks code blocks.",
			cls: "setting-item-description"
		});

		containerEl.createEl("h3", { text: "Supported question types" });

		const typesEl = containerEl.createEl("ul");
		typesEl.createEl("li", { text: "Single choice" });
		typesEl.createEl("li", { text: "Multiple choice" });
		typesEl.createEl("li", { text: "Text input" });
		typesEl.createEl("li", { text: "Ordering" });
		typesEl.createEl("li", { text: "Matching" });

		containerEl.createEl("h3", { text: "Quick example" });

		const exampleCode = `[
  {
    title: "Question 1",
    prompt: "What is 2 + 2?",
    options: ["3", "4", "5"],
    correctIndex: 1
  }
]`;

		const codeWrap = containerEl.createDiv({
			cls: "quiz-blocks-settings-code-block markdown-rendered"
		});

		const codeHeader = codeWrap.createDiv({
			cls: "quiz-blocks-settings-code-header"
		});

		codeHeader.createSpan({
			text: "quiz-blocks",
			cls: "quiz-blocks-settings-code-lang"
		});

		const copyBtn = codeHeader.createEl("button", {
			cls: "clickable-icon extra-setting-button quiz-blocks-settings-copy-btn"
		});

		copyBtn.setAttr("type", "button");
		copyBtn.setAttr("aria-label", "Copy code");
		copyBtn.setAttr("title", "Copy code");

		obsidian.setIcon(copyBtn, "copy");

		const pre = codeWrap.createEl("pre", {
			cls: "quiz-blocks-settings-code-pre"
		});

		pre.createEl("code", {
			text: exampleCode,
			cls: "language-quiz-blocks"
		});

		copyBtn.addEventListener("click", async () => {
			try {
				await navigator.clipboard.writeText(
					"```quiz-blocks\n" + exampleCode + "\n```"
				);

				obsidian.setIcon(copyBtn, "check");

				window.setTimeout(() => {
					obsidian.setIcon(copyBtn, "copy");
				}, 1200);
			} catch (error) {
				console.error("[quiz-blocks] copy failed", error);
				new obsidian.Notice("Unable to copy the example.");
			}
		});

		containerEl.createEl("h3", { text: "Notes" });

		const notesEl = containerEl.createEl("ul");
		notesEl.createEl("li", { text: "The code block content must be a valid JSON5 array." });
		notesEl.createEl("li", { text: "Hints, explanations, scoring, navigation, and transitions are supported." });
		notesEl.createEl("li", { text: "Interactive rendering happens directly inside the note preview." });

		// ─── Available Commands Section ───
		containerEl.createEl("h3", { text: "Commandes disponibles" });

		const commands = [
			{ id: "open-quiz-builder", name: "Ouvrir le Quiz Editor" },
			{ id: "import-quiz-from-active-note", name: "Importer le quiz de la note active" }
		];

		for (const cmd of commands) {
			new obsidian.Setting(containerEl)
				.setName(cmd.name)
				.setDesc(`(${cmd.id})`)
				.addButton(button => {
					button
						.setButtonText("Configurer le raccourci")
						.onClick(() => {
							this.app.setting.open();
							this.app.setting.openTabById('hotkeys');
							const tab = this.app.setting.activeTab;
							if (tab && tab.searchComponent) {
								tab.searchComponent.setValue('quiz blocks');
								if (tab.updateHotkeyVisibility) {
									tab.updateHotkeyVisibility();
								}
							}
						});
				});
		}

	}
}

module.exports = class InteractiveQuizPlugin extends obsidian.Plugin {
	async onload() {
		await this.loadSettings();
		this.log = createLogger();

		this.log.info("plugin chargé");

		this.addSettingTab(new QuizBlocksSettingTab(this.app, this));

		if (this.settings.enableCodeHighlighting) {
			this.registerQuizBlocksCodeHighlighting();
			this.register(() => this.unregisterQuizBlocksCodeHighlighting());
		}

		/* ─── Quiz Builder View ─── */
		this.registerView(VIEW_TYPE, (leaf) => new QuizBuilderView(leaf, this));

		this.addCommand({
			id: "open-quiz-builder",
			name: "Ouvrir le Quiz Editor",
			callback: async () => {
				const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE);
				if (existing.length > 0) {
					this.app.workspace.revealLeaf(existing[0]);
					return;
				}
				const leaf = this.app.workspace.getLeaf("tab");
				await leaf.setViewState({ type: VIEW_TYPE, active: true });
				this.app.workspace.revealLeaf(leaf);
			},
		});

		this.addCommand({
			id: "open-quiz-from-active-note",
			name: "Ouvrir le quiz de la note active",
			callback: async () => {
				// Check if there's an active file
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile || !activeFile.path.endsWith('.md')) {
					new obsidian.Notice("Aucune note active");
					return;
				}

				try {
					// Read file content
					const content = await this.app.vault.read(activeFile);
					// Find first quiz-blocks fence
					const match = content.match(/```quiz-blocks\n([\s\S]*?)\n```/);
					if (!match) {
						new obsidian.Notice("Aucun bloc quiz-blocks trouvé dans cette note");
						return;
					}

					// Open or get the Quiz Editor
					const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE);
					let leaf;
					if (existing.length > 0) {
						leaf = existing[0];
						this.app.workspace.revealLeaf(leaf);
					} else {
						leaf = this.app.workspace.getLeaf("tab");
						await leaf.setViewState({ type: VIEW_TYPE, active: true });
						this.app.workspace.revealLeaf(leaf);
					}

					// Open the quiz for editing
					const view = leaf.view;
					if (view && view.openQuizFile) {
						await view.openQuizFile(activeFile, match[1]);
						new obsidian.Notice(`Quiz ouvert : ${activeFile.name}`);
					}
				} catch (err) {
					console.error("Open error:", err);
					new obsidian.Notice("Erreur lors de l'ouverture");
				}
			},
		});

		/* ─── Ribbon Icon ─── */
		this.addRibbonIcon("graduation-cap", "Ouvrir le Quiz Editor", async () => {
			const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE);
			if (existing.length > 0) {
				this.app.workspace.revealLeaf(existing[0]);
				return;
			}
			const leaf = this.app.workspace.getLeaf("tab");
			await leaf.setViewState({ type: VIEW_TYPE, active: true });
			this.app.workspace.revealLeaf(leaf);
		});

		/* ─── Code Block Processor ─── */
		this.registerMarkdownCodeBlockProcessor(
			QUIZ_BLOCK_LANGUAGE,
			async (source, el, ctx) => {
				const host = el.createDiv({ cls: "quiz-blocks-host" });

				try {
					const quiz = parseQuizSource(source);

					await renderInteractiveQuiz({
						app: this.app,
						plugin: this,
						container: host,
						quiz,
						sourcePath: ctx.sourcePath,
						Notice: obsidian.Notice
					});
				} catch (error) {
					this.log.error("erreur pendant le rendu du bloc", error);

					host.empty();
					host.createEl("p", {
						text: `⚠️ Impossible de charger le quiz : ${error?.message || "erreur inconnue"}`
					});
				}
			}
		);
	}

	onunload() {
		this.log?.info("plugin déchargé");
	}

	async loadSettings() {
		const data = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data || {});

		if ("enableDebugLogs" in this.settings) {
			delete this.settings.enableDebugLogs;
			await this.saveSettings();
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	getCodeMirrorGlobal() {
		if (typeof window === "undefined") return null;
		const cm = window.CodeMirror;
		if (!cm || typeof cm.defineMode !== "function" || typeof cm.getMode !== "function") {
			return null;
		}
		return cm;
	}

	registerQuizBlocksCodeHighlighting() {
		const cm = this.getCodeMirrorGlobal();

		if (!cm) {
			this.log.warn("CodeMirror global introuvable : coloration désactivée.");
			return;
		}

		try {
			cm.defineMode(QUIZ_BLOCK_LANGUAGE, config => {
				return cm.getMode(
					{
						...config,
						json: true
					},
					"javascript"
				);
			});

			this.log.debug("mode de coloration enregistré pour quiz-blocks");
		} catch (error) {
			this.log.error("impossible d'enregistrer la coloration", error);
		}
	}

	unregisterQuizBlocksCodeHighlighting() {
		const cm = this.getCodeMirrorGlobal();
		if (!cm) return;

		try {
			cm.defineMode(QUIZ_BLOCK_LANGUAGE, config => cm.getMode(config, "null"));
			this.log.debug("mode de coloration désactivé");
		} catch (error) {
			this.log.error("impossible de retirer la coloration", error);
		}
	} 
};