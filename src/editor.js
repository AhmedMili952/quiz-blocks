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

		// Saved widths for restoring panels
		this._savedWidths = {
			sidebar: 224,
			editor: 352,
			preview: 400,
			code: 288
		};
		// Minimum width for any panel
		this._minPanelWidth = 50;
		// Threshold to hide panel
		this._hideThreshold = 10;

		// Créer le contexte partagé (ctx) pour injection de dépendances
		const ctx = {
			// Références principales
			view: this,
			app: this.app,
			plugin: plugin,
			container: this.contentEl,

			// État
			questions: this.questions,
			activeIdx: this.activeIdx,
			panels: this.panels,
			examOptions: this.examOptions,
			activeEditorTab: this.activeEditorTab,
			_savedWidths: this._savedWidths,
			_minPanelWidth: this._minPanelWidth,
			_hideThreshold: this._hideThreshold,
			_previewDebounce: this._previewDebounce,

			// Accesseurs
			get activeQuestion() { return ctx.questions[ctx.activeIdx]; },
			set activeQuestion(v) { ctx.questions[ctx.activeIdx] = v; },

			// Utilitaires
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
		this.renderPreview = ui.renderPreview.bind(ui);

		this._setupResizer = resize._setupResizer.bind(resize);
		this._closeLeftPanel = resize._closeLeftPanel.bind(resize);
		this._closeRightPanel = resize._closeRightPanel.bind(resize);

		this._renderSidebar = sidebar._renderSidebar.bind(sidebar);
		this.showTypeModal = sidebar.showTypeModal.bind(sidebar);
		this.addQuestion = sidebar.addQuestion.bind(sidebar);
		this.duplicateQuestion = sidebar.duplicateQuestion.bind(sidebar);
		this.deleteQuestion = sidebar.deleteQuestion.bind(sidebar);
		this.moveQuestion = sidebar.moveQuestion.bind(sidebar);

		this._renderEditor = editorForm._renderEditor.bind(editorForm);
		this._bindBasicField = editorForm._bindBasicField.bind(editorForm);
		this._bindOptionsEditor = editorForm._bindOptionsEditor.bind(editorForm);
		this._bindOrderingEditor = editorForm._bindOrderingEditor.bind(editorForm);
		this._bindMatchingEditor = editorForm._bindMatchingEditor.bind(editorForm);
		this._bindTextEditor = editorForm._bindTextEditor.bind(editorForm);
		this._bindMultiSelectEditor = editorForm._bindMultiSelectEditor.bind(editorForm);

		this.renderCode = preview.renderCode.bind(preview);
		this._resolveImagesInHtml = preview._resolveImagesInHtml.bind(preview);

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
		this.contentEl.empty();
	}
}

module.exports = { QuizBuilderView, VIEW_TYPE };
