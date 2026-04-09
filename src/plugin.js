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
		containerEl.createEl("h3", { text: "Commandes et raccourcis clavier" });

		const commandsInfo = [
			{
				id: "open-quiz-builder",
				name: "Ouvrir le Quiz Editor",
				desc: "Ouvre un nouvel onglet avec le Quiz Editor vide"
			},
			{
				id: "open-quiz-from-active-note",
				name: "Ouvrir le quiz de la note active",
				desc: "Ouvre l'éditeur et charge le quiz de la note active"
			}
		];

		// Fonction pour récupérer les raccourcis actuels d'une commande
		function getHotkeysForCommand(commandId) {
			const command = this.app.commands.commands[commandId];
			if (!command || !command.hotkeys || command.hotkeys.length === 0) {
				return "Non défini";
			}
			// Formater le premier raccourci
			const hk = command.hotkeys[0];
			const modifiers = hk.modifiers || [];
			const key = hk.key || "";
			// Remplacer les modificateurs par des symboles
			const modStr = modifiers.map(m => {
				if (m === "Ctrl") return "Ctrl";
				if (m === "Shift") return "Shift";
				if (m === "Alt") return "Alt";
				if (m === "Meta" || m === "Mod") return "Cmd";
				return m;
			}).join("+");
			return modStr ? `${modStr}+${key}` : key;
		}

		// Tableau des commandes
		const commandsTable = containerEl.createDiv({ cls: "qb-commands-table" });
		commandsTable.style.cssText = "margin: 1em 0; border: 1px solid var(--background-modifier-border); border-radius: 8px; overflow: hidden;";

		for (const cmd of commandsInfo) {
			const row = commandsTable.createDiv({ cls: "qb-command-row" });
			row.style.cssText = "display: flex; align-items: center; padding: 0.75em 1em; border-bottom: 1px solid var(--background-modifier-border); background: var(--background-secondary);";

			const infoDiv = row.createDiv({ cls: "qb-command-info" });
			infoDiv.style.cssText = "flex: 1; min-width: 0;";
			infoDiv.createDiv({ cls: "qb-command-name", text: cmd.name }).style.cssText = "font-weight: 600; color: var(--text-normal); margin-bottom: 0.25em;";
			infoDiv.createDiv({ cls: "qb-command-desc", text: cmd.desc }).style.cssText = "font-size: 0.85em; color: var(--text-muted);";

			const hotkeyDiv = row.createDiv({ cls: "qb-command-hotkey" });
			hotkeyDiv.style.cssText = "display: flex; align-items: center; gap: 0.5em; margin-left: 1em;";

			// Afficher la combinaison de touches (récupérée dynamiquement)
			const hotkeyText = getHotkeysForCommand.call(this, cmd.id);
			const hotkeyBadge = hotkeyDiv.createSpan({ cls: "qb-hotkey-badge", text: hotkeyText });
			hotkeyBadge.style.cssText = "font-family: var(--font-monospace); font-size: 0.75em; padding: 0.25em 0.5em; background: var(--interactive-accent); color: var(--text-on-accent); border-radius: 4px; white-space: nowrap;";
		}

		// Supprimer la dernière bordure
		const rows = commandsTable.querySelectorAll('.qb-command-row');
		if (rows.length > 0) {
			rows[rows.length - 1].style.borderBottom = 'none';
		}

		// Bouton unique en bas
		const buttonContainer = containerEl.createDiv({ cls: "qb-config-button-container" });
		buttonContainer.style.cssText = "margin-top: 1.5em; text-align: center;";

		const configButton = buttonContainer.createEl("button", { cls: "mod-cta" });
		configButton.textContent = "Configurer les raccourcis";
		configButton.style.cssText = "padding: 0.75em 1.5em; font-size: 1em;";
		configButton.addEventListener("click", () => {
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

		// Note explicative
		const noteEl = containerEl.createEl("p", { cls: "setting-item-description" });
		noteEl.textContent = "Cliquez sur le bouton ci-dessus pour personnaliser les raccourcis clavier dans les paramètres d'Obsidian.";
		noteEl.style.cssText = "text-align: center; margin-top: 0.75em; font-style: italic;";

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
			hotkeys: [{ modifiers: ["Ctrl", "Shift"], key: "e" }],
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
			hotkeys: [{ modifiers: ["Ctrl", "Shift"], key: "q" }],
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