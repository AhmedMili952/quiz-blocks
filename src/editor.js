'use strict';

const obsidian = require("obsidian");
const { parseQuizSource } = require("./quiz-utils");
const { Q_TYPES, loadReact, _setIcon, _iconSpan, makeDefault, md2html, escHtml, esc5 } = require("./editor/utils");
const { exportQuestion, exportAll, exportAllWithFence } = require("./editor/export");
const { ConfirmModal, TypePickerModal, ImportQuizModal, QuizFileSuggestModal, ImportFromNoteModal } = require("./editor/modals");

const createEditorUIHandlers = require("./editor/ui");
const createResizeHandlers = require("./editor/resize");
const createSidebarHandlers = require("./editor/sidebar");
const createEditorFormHandlers = require("./editor/editor-form");
const createPreviewHandlers = require("./editor/preview");
const createHintHandlers = require("./editor/hint");

const VIEW_TYPE = "quiz-blocks-builder";

/* ════════════════════════════════════════════════════════
   QUIZ BUILDER VIEW
   ════════════════════════════════════════════════════════ */
class QuizBuilderView extends obsidian.ItemView {
	constructor(leaf, plugin) {
		super(leaf);
		this.plugin = plugin;
		this.questions = [Object.assign(makeDefault("single"), { title: "Question 1" })];
		this.activeIdx = 0;
		this.panels = { sidebar: true, editor: true, preview: true, code: false };
		this._previewDebounce = 0;
		this.examOptions = {
			enabled: false,
			durationMinutes: 10,
			autoSubmit: true,
			showTimer: true
		};
		this.activeEditorTab = 'content';
		this.sourceFile = null; // Fichier source ouvert en mode édition directe
		this._saveDebounce = 0; // Timer pour sauvegarde automatique

		this._savedWidths = {
			sidebar: 320,
			editor: 352,
			preview: 304,
			code: 288
		};
		this._minPanelWidth = 50;
		this._hideThreshold = 10;

		// Créer le contexte partagé (ctx) pour injection de dépendances
		const ctx = {
			view: this,
			app: this.app,
			plugin: plugin,
			container: this.contentEl,

			questions: this.questions,
			activeIdx: this.activeIdx,
			panels: this.panels,
			examOptions: this.examOptions,
			activeEditorTab: this.activeEditorTab,
			_savedWidths: this._savedWidths,
			_minPanelWidth: this._minPanelWidth,
			_hideThreshold: this._hideThreshold,
			_previewDebounce: this._previewDebounce,

			get activeQuestion() { return ctx.questions[ctx.activeIdx]; },
			set activeQuestion(v) { ctx.questions[ctx.activeIdx] = v; },

			Q_TYPES,
			loadReact,
			_setIcon,
			_iconSpan,
			makeDefault,
			md2html,
			escHtml,
			esc5,
			exportQuestion,
			exportAll,
			exportAllWithFence,
			parseQuizSource,
			ConfirmModal,
			TypePickerModal,
			ImportQuizModal,
			QuizFileSuggestModal,
			ImportFromNoteModal,
			VIEW_TYPE
		};

		// Initialiser les handlers
		const ui = createEditorUIHandlers(ctx);
		const resize = createResizeHandlers(ctx);
		const sidebar = createSidebarHandlers(ctx);
		const editorForm = createEditorFormHandlers(ctx);
		const preview = createPreviewHandlers(ctx);
		const hint = createHintHandlers(ctx);

		// Attacher les modules au ctx
		Object.assign(ctx, {
			ui,
			resize,
			sidebar,
			editorForm,
			preview,
			hint
		});

		// Exposer les méthodes sur l'instance
		this.buildUI = ui.buildUI.bind(ui);
		this.syncPanels = ui.syncPanels.bind(ui);
		this.render = ui.render.bind(ui);
		this.showTypeModal = ui.showTypeModal.bind(ui);

		this._setupResizer = resize._setupResizer.bind(resize);
		this._closeLeftPanel = resize._closeLeftPanel.bind(resize);
		this._closeRightPanel = resize._closeRightPanel.bind(resize);
		this._resizePanels = resize._resizePanels.bind(resize);

		this.renderSidebar = sidebar.renderSidebar.bind(sidebar);
		this.moveQuestion = sidebar.moveQuestion.bind(sidebar);
		this.deleteQuestion = sidebar.deleteQuestion.bind(sidebar);

		this.renderEditor = editorForm.renderEditor.bind(editorForm);
		this._field = editorForm._field.bind(editorForm);
		this._resourceSection = editorForm._resourceSection.bind(editorForm);
		this._renderTypeFields = editorForm._renderTypeFields.bind(editorForm);
		this._arrayEditor = editorForm._arrayEditor.bind(editorForm);

		this.schedulePreview = preview.schedulePreview.bind(preview);
		this.renderPreview = preview.renderPreview.bind(preview);
		this._resolveImagesInHtml = preview._resolveImagesInHtml.bind(preview);
		this.renderCode = preview.renderCode.bind(preview);

		this._ensureHintOverlay = hint._ensureHintOverlay.bind(hint);
		this._applyHintTheme = hint._applyHintTheme.bind(hint);
		this._openHint = hint._openHint.bind(hint);
		this._closeHint = hint._closeHint.bind(hint);

		// Sauvegarder ctx sur l'instance
		this._ctx = ctx;
	}

	getViewType() { return VIEW_TYPE; }
	getDisplayText() { return "Quiz Editor"; }
	getIcon() { return "graduation-cap"; }

	async onOpen() {
		this.contentEl.empty();
		this.contentEl.addClass("qb-root");
		this.buildUI();
		this.render();
	}

	onClose() {
		this._closeHint();
		const overlay = document.getElementById("qb-hint-overlay");
		if (overlay) overlay.remove();
		if (this._hintEscHandler) {
			document.removeEventListener("keydown", this._hintEscHandler);
			this._hintEscHandler = null;
		}
		// Cleanup any resize overlays that might be stuck
		const resizeOverlays = document.querySelectorAll('div[style*="cursor:ew-resize"]');
		resizeOverlays.forEach(el => el.remove());
		this.contentEl.empty();
	}

	async importQuizSource(source, fileName = null) {
		try {
			const parsed = parseQuizSource(source);
			if (!Array.isArray(parsed) || parsed.length === 0) {
				new obsidian.Notice("Aucune question trouvée");
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

				const question = this.convertParsedToInternal(q);
				if (question) questions.push(question);
			}

			if (questions.length === 0) {
				new obsidian.Notice("Aucune question valide trouvée");
				return;
			}

			// Stocker le nom du fichier importé
			this.importedFileName = fileName;

			// Mettre à jour le tableau en place pour que ctx.questions reste synchronisé
			this.questions.length = 0;
			questions.forEach(q => this.questions.push(q));
			this.activeIdx = 0;
			if (this._ctx) this._ctx.activeIdx = 0;  // Sync ctx.activeIdx
			if (examOptions) {
				Object.assign(this.examOptions, examOptions);
				// Mettre à jour l'UI de l'examen si la fonction existe
				if (this.updateExamUIState) this.updateExamUIState();
			}

			// Mettre à jour le nom du fichier affiché dans l'UI
			if (this._fileNameEl) {
				this._fileNameEl.textContent = fileName || "quiz-blocks";
				this._fileNameEl.classList.toggle("has-file", !!fileName);
			}

			this.render();
			new obsidian.Notice(`${questions.length} question(s) importée(s)${fileName ? " depuis " + fileName : ""}`);
		} catch (err) {
			console.error("Import error:", err);
			new obsidian.Notice("Erreur lors de l'import: " + err.message);
		}
	}

	async openQuizFile(file, source) {
		// Stocker le fichier source pour sauvegarde automatique
		this.sourceFile = file;
		await this.importQuizSource(source, file.name);
	}

	async saveToSourceFile() {
		console.log("[Quiz Blocks] saveToSourceFile v2 - FIX JSON5");  // VERSION CHECK
		if (!this.sourceFile) return;

		try {
			// Lire le contenu actuel du fichier
			const content = await this.app.vault.read(this.sourceFile);

			// Générer le nouveau contenu du quiz (SANS les fences)
			const { exportAll } = require("./editor/export");
			const newQuizJson = exportAll(this.questions, this.examOptions);

			// Valider que le JSON5 généré est correct avant de sauvegarder
			try {
				const { parseQuizSource } = require("./quiz-utils");
				parseQuizSource(newQuizJson);
			} catch (parseErr) {
				console.error("[Quiz Blocks] JSON5 invalide généré:", parseErr);
				console.error("[Quiz Blocks] Contenu (début):", newQuizJson.substring(0, 500));
				console.error("[Quiz Blocks] Contenu (fin):", newQuizJson.substring(newQuizJson.length - 500));
				// Show lines around line 48
				const lines = newQuizJson.split('\n');
				console.error("[Quiz Blocks] Lignes 45-52:", lines.slice(44, 52).map((l, i) => `${i+45}: ${l}`).join('\n'));
				console.error("[Quiz Blocks] Longueur totale:", newQuizJson.length);
				new obsidian.Notice("Erreur: le quiz généré n'est pas valide.");
				return;
			}

			// Reconstruire le bloc complet avec les fences
			const newQuizBlock = "```quiz-blocks\n" + newQuizJson + "\n```";

			// Remplacer le bloc quiz-blocks dans le fichier
			const quizBlockRegex = /```quiz-blocks[\s\S]*?```/;
			if (!quizBlockRegex.test(content)) {
				console.error("[Quiz Blocks] Aucun bloc quiz-blocks trouvé dans le fichier");
				new obsidian.Notice("Erreur: bloc quiz-blocks introuvable");
				return;
			}

			const updatedContent = content.replace(quizBlockRegex, newQuizBlock);

			// Sauvegarder si le contenu a changé
			if (updatedContent !== content) {
				await this.app.vault.modify(this.sourceFile, updatedContent);
				this.updateSaveIndicator?.(true);
				console.log("[Quiz Blocks] Quiz sauvegardé");
			}
		} catch (err) {
			console.error("[Quiz Blocks] Save error:", err);
			new obsidian.Notice("Erreur lors de la sauvegarde: " + err.message);
		}
	}

	scheduleSave() {
		if (!this.sourceFile) return;
		if (this._saveDebounce) clearTimeout(this._saveDebounce);
		this._saveDebounce = setTimeout(() => this.saveToSourceFile(), 1000);
		// Mettre à jour l'indicateur de sauvegarde
		this.updateSaveIndicator?.(false);
	}

	convertParsedToInternal(q) {
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
}

module.exports = { QuizBuilderView, VIEW_TYPE, QuizFileSuggestModal };
