'use strict';

const obsidian = require("obsidian");
const { Q_TYPES, _setIcon, makeDefault } = require("./utils");
const { parseQuizSource } = require("../quiz-utils");

/* ════════════════════════════════════════════════════════
   CONFIRM MODAL
   ════════════════════════════════════════════════════════ */
class ConfirmModal extends obsidian.Modal {
	constructor(app, title, message, confirmText, cancelText, callback) {
		super(app);
		this.modalTitle = title;
		this.message = message;
		this.confirmText = confirmText;
		this.cancelText = cancelText;
		this.callback = callback;
		this.confirmed = false;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("qb-confirm-modal");

		contentEl.createEl("h2", { text: this.modalTitle, cls: "qb-confirm-title" });
		contentEl.createEl("p", { text: this.message, cls: "qb-confirm-message" });

		const btnRow = contentEl.createDiv({ cls: "qb-confirm-buttons" });

		const cancelBtn = btnRow.createEl("button", {
			cls: "qb-btn",
			text: this.cancelText
		});
		cancelBtn.addEventListener("click", () => {
			this.confirmed = false;
			this.close();
		});

		const confirmBtn = btnRow.createEl("button", {
			cls: "qb-btn qb-btn-danger",
			text: this.confirmText
		});
		confirmBtn.addEventListener("click", () => {
			this.confirmed = true;
			this.close();
		});
	}

	onClose() {
		this.callback(this.confirmed);
		this.contentEl.empty();
	}
}

/* ════════════════════════════════════════════════════════
   TYPE PICKER MODAL
   ════════════════════════════════════════════════════════ */
class TypePickerModal extends obsidian.Modal {
	constructor(app, onPick) {
		super(app);
		this.onPick = onPick;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("qb-type-modal");
		contentEl.createEl("h2", { text: "Ajouter une question" });
		contentEl.createEl("p", { text: "Choisissez le type de question", cls: "qb-type-modal-sub" });

		const grid = contentEl.createDiv({ cls: "qb-type-grid" });
		for (const t of Q_TYPES) {
			const card = grid.createDiv({ cls: "qb-type-card" });
			const cardIcon = card.createDiv({ cls: "qb-type-card-icon" }); _setIcon(cardIcon, t.lucide);
			const text = card.createDiv();
			text.createDiv({ cls: "qb-type-card-name", text: t.label });
			text.createDiv({ cls: "qb-type-card-desc", text: t.desc });
			card.addEventListener("click", () => { this.onPick(t.key); this.close(); });
		}
	}

	onClose() { this.contentEl.empty(); }
}

/* ════════════════════════════════════════════════════════
   IMPORT QUIZ MODAL
   ════════════════════════════════════════════════════════ */
class ImportQuizModal extends obsidian.Modal {
	constructor(app, builderView) {
		super(app);
		this.builderView = builderView;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("qb-import-modal");
		contentEl.createEl("h2", { text: "Importer un quiz" });

		const textarea = contentEl.createEl("textarea", {
			cls: "qb-import-textarea",
			placeholder: "Collez ici le contenu d'un bloc quiz-blocks ou le code JSON5 du quiz..."
		});

		const loadBtn = contentEl.createEl("button", { cls: "qb-import-btn", text: "Charger" });
		loadBtn.addEventListener("click", async () => {
			const text = textarea.value.trim();
			if (!text) return;

			await this.loadQuiz(text);
		});

		const fromNoteBtn = contentEl.createEl("button", { cls: "qb-import-from-note", text: "Importer depuis une note" });
		fromNoteBtn.addEventListener("click", () => {
			this.close();
			new ImportFromNoteModal(this.app, this.builderView).open();
		});
	}

	async loadQuiz(text) {
		try {
			let jsonText = text;
			const fenceMatch = text.match(/```quiz-blocks\n([\s\S]*?)\n```/);
			if (fenceMatch) {
				jsonText = fenceMatch[1];
			}

			const parsed = parseQuizSource(jsonText);
			if (!Array.isArray(parsed) || parsed.length === 0) {
				new obsidian.Notice("Aucune question trouvée dans le contenu");
				return;
			}

			const questions = [];
			let examOptions = null;

			for (const q of parsed) {
				if (q.examMode) {
					examOptions = {
						enabled: true,
						durationMinutes: q.examDurationMinutes || 10,
						autoSubmit: q.examAutoSubmit ?? false,
						showTimer: q.examShowTimer ?? true
					};
					continue;
				}

				const question = this.convertToInternalFormat(q);
				if (question) questions.push(question);
			}

			if (questions.length === 0) {
				new obsidian.Notice("Aucune question valide trouvée");
				return;
			}

			// Mettre à jour le tableau en place pour que ctx.questions reste synchronisé
			this.builderView.questions.length = 0;
			questions.forEach(q => this.builderView.questions.push(q));
			this.builderView.activeIdx = 0;
			if (examOptions) {
				this.builderView.examOptions = examOptions;
			}

			this.builderView.render();
			new obsidian.Notice(`${questions.length} question(s) importée(s)`);
			this.close();
		} catch (err) {
			console.error("Import error:", err);
			new obsidian.Notice("Erreur lors de l'import: " + err.message);
		}
	}

	convertToInternalFormat(q) {
		let type = "single";
		if (q.ordering) type = "ordering";
		else if (q.matching) type = "matching";
		else if (q.multiSelect) type = "multi";
		else if (q.type === "text") {
			if (q.terminalVariant === "cmd") type = "cmd";
			else if (q.textVariant === "powershell") type = "powershell";
			else if (q.textVariant === "bash") type = "bash";
			else type = "text";
		}

		const question = makeDefault(type);
		question._id = q.id || Math.random().toString(36).slice(2, 10);
		question.title = q.title || "";
		question.hint = q.hint || "";

		if (q.prompt) {
			question.prompt = q.prompt;
		} else if (q.promptHtml) {
			question.prompt = q.promptHtml.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
		}
		if (q.promptHtml) {
			question._promptHtml = q.promptHtml;
		}

		if (q.explain) question.explain = q.explain;
		else if (q.explainHtml) {
			question.explain = q.explainHtml.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
		}
		if (q.explainHtml) {
			question._explainHtml = q.explainHtml;
		}

		if (q.resourceButton) {
			question.resourceButton = { ...q.resourceButton };
		}

		if (type === "single" || type === "multi") {
			question.options = q.options || ["", ""];
			if (type === "single") {
				question.correctIndex = q.correctIndex ?? 0;
			} else {
				question.correctIndices = q.correctIndices || [];
			}
		}

		if (type === "ordering") {
			question.slots = q.slots || ["Étape 1", "Étape 2"];
			question.possibilities = q.possibilities || ["", ""];
			question.correctOrder = q.correctOrder || [0, 1];
		}

		if (type === "matching") {
			question.rows = q.rows || ["", ""];
			question.choices = q.choices || ["", ""];
			question.correctMap = q.correctMap || [0, 0];
		}

		if (["text", "cmd", "powershell", "bash"].includes(type)) {
			question.acceptedAnswers = q.acceptedAnswers || q.acceptableAnswers || [""];
			if (question.acceptedAnswers.length === 1 && question.acceptedAnswers[0] === "" && q.correctText) {
				question.acceptedAnswers = [q.correctText];
			}
			question.caseSensitive = q.caseSensitive || false;
			question.placeholder = q.placeholder || "";
			if (type === "cmd" || type === "powershell") {
				question.commandPrefix = q.commandPrefix || (type === "cmd" ? "C:\\>" : "PS>");
			}
		}

		const knownKeys = new Set(['id','title','prompt','promptHtml','options','correctIndex','multiSelect','correctIndices','ordering','slots','possibilities','correctOrder','matching','rows','choices','correctMap','type','terminalVariant','textVariant','commandPrefix','placeholder','caseSensitive','acceptedAnswers','acceptableAnswers','correctText','hint','explain','explainHtml','resourceButton','examMode','examDurationMinutes','examAutoSubmit','examShowTimer']);
		question._extraFields = {};
		for (const key of Object.keys(q)) {
			if (!knownKeys.has(key)) question._extraFields[key] = q[key];
		}

		return question;
	}

	onClose() { this.contentEl.empty(); }
}

/* ════════════════════════════════════════════════════════
   QUIZ FILE SUGGEST MODAL
   ════════════════════════════════════════════════════════ */
class QuizFileSuggestModal extends obsidian.FuzzySuggestModal {
	constructor(app, onChoose) {
		super(app);
		this.onChooseCallback = onChoose;
		this.setPlaceholder("Choisir une note contenant un quiz...");
		this.openFiles = new Set();
	}

	getItems() {
		const result = [];
		const seenPaths = new Set();

		this.app.workspace.getLeavesOfType('markdown').forEach(leaf => {
			if (leaf.view && leaf.view.file) {
				result.push(leaf.view.file);
				seenPaths.add(leaf.view.file.path);
				this.openFiles.add(leaf.view.file.path);
			}
		});

		this.app.vault.getMarkdownFiles().forEach(file => {
			if (!seenPaths.has(file.path)) {
				result.push(file);
				seenPaths.add(file.path);
			}
		});

		return result;
	}

	getItemText(file) {
		return file.path;
	}

	renderSuggestion(file, el) {
		el.createDiv({ cls: "qb-suggest-item" }, div => {
			const isOpen = this.openFiles.has(file.path);

			div.createDiv({ cls: "qb-suggest-main" }, main => {
				main.createEl("span", { cls: "qb-suggest-name", text: file.basename });
				if (isOpen) {
					main.createEl("span", { cls: "qb-suggest-badge", text: "Ouvert" });
				}
			});

			div.createEl("span", { cls: "qb-suggest-path", text: file.path });
		});
	}

	async onChooseItem(file) {
		this.onChooseCallback(file);
	}
}

/* ════════════════════════════════════════════════════════
   IMPORT FROM NOTE MODAL
   ════════════════════════════════════════════════════════ */
class ImportFromNoteModal extends obsidian.Modal {
	constructor(app, builderView) {
		super(app);
		this.builderView = builderView;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		this.close();

		new QuizFileSuggestModal(this.app, async (file) => {
			try {
				const content = await this.app.vault.read(file);
				const match = content.match(/```quiz-blocks\n([\s\S]*?)\n```/);
				if (!match) {
					new obsidian.Notice("Aucun bloc quiz-blocks trouvé dans cette note");
					return;
				}

				await this.builderView.importQuizSource(match[1]);
				new obsidian.Notice(`Quiz importé depuis ${file.basename}`);
			} catch (err) {
				console.error("Import from note error:", err);
				new obsidian.Notice("Erreur lors de la lecture de la note");
			}
		}).open();
	}

	onClose() { this.contentEl.empty(); }
}

module.exports = { ConfirmModal, TypePickerModal, ImportQuizModal, QuizFileSuggestModal, ImportFromNoteModal };
