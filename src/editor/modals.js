'use strict';

const obsidian = require("obsidian");
const { Q_TYPES, _setIcon, makeDefault } = require("./utils");
const { parseQuizSource } = require("../quiz-utils");

/**
 * Convert HTML to plain text using the DOM, preserving inner text of
 * structural elements like <pre>, <code>, <br> instead of stripping them.
 * This avoids data loss that a regex (/<[^>]+>/g) would cause.
 */
function _htmlToText(html) {
	const temp = document.createElement("div");
	temp.innerHTML = html;
	// Convert <br> to newlines before extracting text
	temp.querySelectorAll("br").forEach(br => br.replaceWith("\n"));
	// Convert block-level boundaries to newlines for readability
	temp.querySelectorAll("p, div, li, tr, h1, h2, h3, h4, h5, h6").forEach(el => {
		el.insertAdjacentText("beforeend", "\n");
	});
	return temp.textContent || "";
}

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
			if (this.builderView._ctx) this.builderView._ctx.activeIdx = 0;  // Sync ctx
			if (examOptions) {
				Object.assign(this.builderView.examOptions, examOptions);
				// Mettre à jour l'UI de l'examen si la fonction existe
				if (this.builderView.updateExamUIState) this.builderView.updateExamUIState();
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
		question._userModifiedTitle = !/^Question \d+$/.test(question.title);
		question.hint = q.hint || "";

		if (q.prompt) {
			question.prompt = q.prompt;
		} else if (q.promptHtml) {
			question.prompt = _htmlToText(q.promptHtml);
		}
		if (q.promptHtml) {
			question._promptHtml = q.promptHtml;
			// Si promptHtml existe, activer par défaut l'édition HTML
			question._useHtmlPrompt = true;
		}

		if (q.explain) question.explain = q.explain;
		else if (q.explainHtml) {
			question.explain = _htmlToText(q.explainHtml);
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
		// Ne pas fermer immédiatement - ouvre une autre modal directement
		// this.close();  // SUPPRIMÉ: causait des problèmes de race condition

		new QuizFileSuggestModal(this.app, async (file) => {
			try {
				const content = await this.app.vault.read(file);
				const match = content.match(/```quiz-blocks\n([\s\S]*?)\n```/);
				if (!match) {
					new obsidian.Notice("Aucun bloc quiz-blocks trouvé dans cette note");
					return;
				}

				await this.builderView.importQuizSource(match[1], file.name);
				new obsidian.Notice(`Quiz importé depuis ${file.name}`);
			} catch (err) {
				console.error("Import from note error:", err);
				new obsidian.Notice("Erreur lors de la lecture de la note");
			}
		}).open();
	}

	onClose() { this.contentEl.empty(); }
}

/* ════════════════════════════════════════════════════════
   OPEN QUIZ FROM NOTE MODAL
   ════════════════════════════════════════════════════════ */
class OpenQuizFromNoteModal extends obsidian.FuzzySuggestModal {
	constructor(app, builderView) {
		super(app);
		this.builderView = builderView;
		this.setPlaceholder("Choisir une note contenant un quiz...");
		this.openFiles = new Set();
		this.filesWithQuiz = [];
	}

	async getFilesWithQuiz() {
		const allMarkdownFiles = this.app.vault.getMarkdownFiles();
		const filesWithQuiz = [];
		const seenPaths = new Set();

		// D'abord les fichiers ouverts (priorité 1)
		this.app.workspace.getLeavesOfType('markdown').forEach(leaf => {
			if (leaf.view && leaf.view.file) {
				this.openFiles.add(leaf.view.file.path);
				// Vérifier si le fichier contient un quiz
				const content = leaf.view.data || "";
				if (content.match(/```quiz-blocks\n([\s\S]*?)\n```/)) {
					filesWithQuiz.push({
						file: leaf.view.file,
						isOpen: true,
						mtime: leaf.view.file.stat?.mtime || 0
					});
					seenPaths.add(leaf.view.file.path);
				}
			}
		});

		// Ensuite les autres fichiers récents contenant des quiz
		for (const file of allMarkdownFiles) {
			if (seenPaths.has(file.path)) continue;

			try {
				const content = await this.app.vault.read(file);
				if (content.match(/```quiz-blocks\n([\s\S]*?)\n```/)) {
					filesWithQuiz.push({
						file: file,
						isOpen: false,
						mtime: file.stat?.mtime || 0
					});
					seenPaths.add(file.path);
				}
			} catch (e) {
				// Ignorer les erreurs de lecture
			}
		}

		// Trier par : ouverts d'abord, puis par date de modification (plus récents)
		filesWithQuiz.sort((a, b) => {
			if (a.isOpen && !b.isOpen) return -1;
			if (!a.isOpen && b.isOpen) return 1;
			return b.mtime - a.mtime;
		});

		return filesWithQuiz.map(f => f.file);
	}

	async getItems() {
		if (this.filesWithQuiz.length === 0) {
			this.filesWithQuiz = await this.getFilesWithQuiz();
		}
		return this.filesWithQuiz;
	}

	getItemText(file) {
		return file.basename;
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
		try {
			const content = await this.app.vault.read(file);
			const match = content.match(/```quiz-blocks\n([\s\S]*?)\n```/);
			if (!match) {
				new obsidian.Notice("Aucun bloc quiz-blocks trouvé dans cette note");
				return;
			}

			// Ouvrir ou révéler le Quiz Editor
			const existing = this.app.workspace.getLeavesOfType("quiz-blocks-builder");
			let leaf;
			if (existing.length > 0) {
				leaf = existing[0];
				this.app.workspace.revealLeaf(leaf);
			} else {
				leaf = this.app.workspace.getLeaf("tab");
				await leaf.setViewState({ type: "quiz-blocks-builder", active: true });
				this.app.workspace.revealLeaf(leaf);
			}

			// Ouvrir le quiz pour édition
			const view = leaf.view;
			if (view && view.openQuizFile) {
				await view.openQuizFile(file, match[1]);
				new obsidian.Notice(`Quiz ouvert : ${file.name}`);
			}
		} catch (err) {
			console.error("Open quiz error:", err);
			new obsidian.Notice("Erreur lors de l'ouverture");
		}
	}
}

module.exports = { ConfirmModal, TypePickerModal, ImportQuizModal, QuizFileSuggestModal, ImportFromNoteModal, OpenQuizFromNoteModal, _htmlToText };
