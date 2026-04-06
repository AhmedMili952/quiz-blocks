'use strict';

module.exports = function createEditorUIHandlers(ctx) {
	const { _setIcon, _iconSpan, exportAllWithFence, ImportQuizModal } = ctx;
	const view = ctx.view;

	function buildUI() {
		const root = view.contentEl;
		const header = root.createDiv({ cls: "qb-header" });

		const brand = header.createDiv({ cls: "qb-brand" });
		const logo = brand.createDiv({ cls: "qb-logo" });
		_setIcon(logo, "graduation-cap");
		const brandText = brand.createDiv({ cls: "qb-title-group" });
		brandText.createDiv({ cls: "qb-title", text: "Quiz Editor" });
		brandText.createDiv({ cls: "qb-sub", text: "quiz-blocks" });

		const toggles = header.createDiv({ cls: "qb-toggles" });
		for (const [key, label, lucide] of [["sidebar", "Questions", "list"], ["editor", "Éditeur", "pencil"], ["preview", "Aperçu", "eye"], ["code", "Code", "code"]]) {
			const btn = toggles.createEl("button", { cls: `qb-toggle ${ctx.panels[key] ? "active" : ""}` });
			btn.dataset.panel = key;
			_iconSpan(btn, lucide, "qb-toggle-icon");
			btn.createSpan({ cls: "qb-toggle-label", text: label });
			btn.addEventListener("click", () => {
				const wasVisible = ctx.panels[key];
				ctx.panels[key] = !ctx.panels[key];
				if (!Object.values(ctx.panels).some(Boolean)) ctx.panels[key] = true;

				if (!wasVisible && ctx.panels[key]) {
					const mainEl = view.contentEl.querySelector('.qb-main');
					if (mainEl) {
						mainEl.style.setProperty('--qb-sidebar-w', '224px');
						mainEl.style.setProperty('--qb-editor-w', '352px');
						mainEl.style.setProperty('--qb-code-w', '288px');
					}
				}

				syncPanels();
			});
		}

		const actions = header.createDiv({ cls: "qb-actions" });

		const importBtn = actions.createEl("button", { cls: "qb-btn" });
		_iconSpan(importBtn, "download", "qb-btn-leading-icon");
		importBtn.createSpan({ text: "Importer" });
		importBtn.addEventListener("click", () => {
			new ImportQuizModal(view.app, view).open();
		});

		view._exportBtn = actions.createEl("button", { cls: "qb-btn qb-btn-accent" });
		_iconSpan(view._exportBtn, "share", "qb-btn-leading-icon");
		view._exportBtn.createSpan({ text: "Exporter" });
		view._exportBtn.addEventListener("click", () => {
			navigator.clipboard.writeText(exportAllWithFence(ctx.questions, ctx.examOptions)).then(() => {
				view._exportBtn.empty();
				_iconSpan(view._exportBtn, "check", "qb-btn-leading-icon");
				view._exportBtn.createSpan({ text: "Copié !" });
				view._exportBtn.classList.add("qb-btn-ok");
				setTimeout(() => {
					view._exportBtn.empty();
					_iconSpan(view._exportBtn, "share", "qb-btn-leading-icon");
					view._exportBtn.createSpan({ text: "Exporter" });
					view._exportBtn.classList.remove("qb-btn-ok");
				}, 2000);
			});
		});

		const main = root.createDiv({ cls: "qb-main" });

		if (!main.style.getPropertyValue('--qb-sidebar-w')) {
			main.style.setProperty('--qb-sidebar-w', '224px');
			main.style.setProperty('--qb-editor-w', '352px');
			main.style.setProperty('--qb-code-w', '288px');
		}

		view.sidebarEl = main.createDiv({ cls: "qb-panel qb-sidebar" });
		view.resizerSidebarEditor = main.createDiv({ cls: "qb-resizer" });
		view.resizerSidebarEditor.dataset.resizer = "sidebar-editor";

		view.editorEl = main.createDiv({ cls: "qb-panel qb-editor" });

		view.resizerEditorPreview = main.createDiv({ cls: "qb-resizer" });
		view.resizerEditorPreview.dataset.resizer = "editor-preview";

		view.previewEl = main.createDiv({ cls: "qb-panel qb-preview" });

		view.resizerPreviewCode = main.createDiv({ cls: "qb-resizer" });
		view.resizerPreviewCode.dataset.resizer = "preview-code";

		view.codeEl = main.createDiv({ cls: "qb-panel qb-code" });

		view._setupResizer(view.resizerSidebarEditor, view.sidebarEl, view.editorEl, 'sidebar-editor');
		view._setupResizer(view.resizerEditorPreview, view.editorEl, view.previewEl, 'editor-preview');
		view._setupResizer(view.resizerPreviewCode, view.previewEl, view.codeEl, 'preview-code');

		const sHead = view.sidebarEl.createDiv({ cls: "qb-sidebar-head" });
		view.qCountEl = sHead.createSpan({ text: "Questions (1)" });
		const addBtn = sHead.createEl("button", { cls: "qb-btn-icon" });
		_setIcon(addBtn, "plus");
		addBtn.addEventListener("click", () => view.showTypeModal());
		view.sidebarListEl = view.sidebarEl.createDiv({ cls: "qb-sidebar-list" });

		const examSection = view.sidebarEl.createDiv({ cls: "qb-collapsible qb-exam-section" });
		const examSummary = examSection.createEl("summary", { cls: "qb-exam-summary" });
		_iconSpan(examSummary, "graduation-cap", "qb-exam-summary-icon");
		examSummary.createSpan({ text: " Mode Examen" });
		const examBody = examSection.createDiv({ cls: "qb-exam-body" });

		const examOptionsContainer = examBody.createDiv({ cls: "qb-exam-options" });

		const examToggleWrap = examOptionsContainer.createDiv({ cls: "qb-toggle-wrap" });
		const examTrack = examToggleWrap.createDiv({ cls: `qb-toggle-track ${ctx.examOptions.enabled ? "on" : ""}` });
		examTrack.createDiv({ cls: "qb-toggle-thumb" });
		examToggleWrap.createSpan({ text: "Activer le mode examen" });
		examToggleWrap.addEventListener("click", () => {
			ctx.examOptions.enabled = !ctx.examOptions.enabled;
			examTrack.classList.toggle("on", ctx.examOptions.enabled);
			examOptionsContainer.classList.toggle("qb-exam-disabled", !ctx.examOptions.enabled);
			view.renderCode();
		});

		const durationWrap = examOptionsContainer.createDiv({ cls: "qb-field" });
		durationWrap.createEl("label", { cls: "qb-field-label", text: "Durée (minutes)" });
		const durationInput = durationWrap.createEl("input", {
			cls: "qb-field-input",
			type: "number",
			min: "1",
			max: "180",
			value: String(ctx.examOptions.durationMinutes)
		});
		durationInput.addEventListener("change", () => {
			const val = parseInt(durationInput.value, 10);
			ctx.examOptions.durationMinutes = Number.isFinite(val) && val > 0 ? val : 10;
			view.renderCode();
		});

		const autoSubmitWrap = examOptionsContainer.createDiv({ cls: "qb-toggle-wrap" });
		const autoSubmitTrack = autoSubmitWrap.createDiv({ cls: `qb-toggle-track ${ctx.examOptions.autoSubmit ? "on" : ""}` });
		autoSubmitTrack.createDiv({ cls: "qb-toggle-thumb" });
		autoSubmitWrap.createSpan({ text: "Soumission auto" });
		autoSubmitWrap.addEventListener("click", () => {
			ctx.examOptions.autoSubmit = !ctx.examOptions.autoSubmit;
			autoSubmitTrack.classList.toggle("on", ctx.examOptions.autoSubmit);
			view.renderCode();
		});

		const showTimerWrap = examOptionsContainer.createDiv({ cls: "qb-toggle-wrap" });
		const showTimerTrack = showTimerWrap.createDiv({ cls: `qb-toggle-track ${ctx.examOptions.showTimer ? "on" : ""}` });
		showTimerTrack.createDiv({ cls: "qb-toggle-thumb" });
		showTimerWrap.createSpan({ text: "Afficher le timer" });
		showTimerWrap.addEventListener("click", () => {
			ctx.examOptions.showTimer = !ctx.examOptions.showTimer;
			showTimerTrack.classList.toggle("on", ctx.examOptions.showTimer);
			view.renderCode();
		});

		if (!ctx.examOptions.enabled) {
			examOptionsContainer.classList.add("qb-exam-disabled");
		}

		view._renderSidebar();

		const eHead = view.editorEl.createDiv({ cls: "qb-panel-head" });
		eHead.createSpan({ cls: "qb-panel-title", text: "Éditeur" });

		const pHead = view.previewEl.createDiv({ cls: "qb-panel-head" });
		_iconSpan(pHead, "eye", "qb-panel-head-icon");
		pHead.createSpan({ cls: "qb-panel-title", text: "Aperçu" });

		const cHead = view.codeEl.createDiv({ cls: "qb-panel-head" });
		_iconSpan(cHead, "code", "qb-panel-head-icon");
		cHead.createSpan({ cls: "qb-panel-title", text: "Code" });
		const copyBtn = cHead.createEl("button", { cls: "qb-btn qb-btn-small" });
		_iconSpan(copyBtn, "clipboard-copy", "qb-btn-leading-icon");
		copyBtn.addEventListener("click", () => {
			navigator.clipboard.writeText(exportAllWithFence(ctx.questions, ctx.examOptions));
		});

		view.codeOutputEl = view.codeEl.createEl("pre", { cls: "qb-code-output" });
		syncPanels();
	}

	function syncPanels() {
		const root = view.contentEl;
		if (!root) return;
		const panels = ['sidebar', 'editor', 'preview', 'code'];
		panels.forEach(key => {
			const el = root.querySelector(`.qb-${key === 'sidebar' ? 'sidebar' : key === 'editor' ? 'editor' : key === 'preview' ? 'preview' : 'code'}`);
			if (el) el.style.display = ctx.panels[key] ? '' : 'none';
		});
		const resizers = root.querySelectorAll('.qb-resizer');
		resizers.forEach(r => {
			const type = r.dataset.resizer;
			if (type === 'sidebar-editor') r.style.display = (ctx.panels.sidebar && ctx.panels.editor) ? '' : 'none';
			if (type === 'editor-preview') r.style.display = (ctx.panels.editor && ctx.panels.preview) ? '' : 'none';
			if (type === 'preview-code') r.style.display = (ctx.panels.preview && ctx.panels.code) ? '' : 'none';
		});
		view._renderSidebar();
		view._renderEditor();
		render();
	}

	function render() {
		view._renderSidebar();
		view._renderEditor();
		renderPreview();
		view.renderCode();
	}

	function renderPreview() {
		view.previewEl.empty();
		const card = view.previewEl.createDiv({ cls: "quiz-card quiz-card-preview" });
		const q = ctx.activeQuestion;
		if (!q) {
			card.createEl("p", { text: "Sélectionnez une question" });
			return;
		}

		const typeLabel = { single: "Single", multi: "Multi", text: "Texte", ordering: "Ordre", matching: "Appariement" }[q.type] || q.type;
		card.createEl("div", { cls: "quiz-kind", text: typeLabel });

		if (q.title) {
			const titleEl = card.createEl("h3", { cls: "quiz-question-title" });
			titleEl.innerHTML = view._resolveImagesInHtml(ctx.md2html(q.title));
		}

		if (q.code) {
			const pre = card.createEl("pre", { cls: "quiz-code" });
			const code = pre.createEl("code");
			code.textContent = q.code;
		}

		const opts = card.createDiv({ cls: "quiz-options" });

		if (q.type === "single" || q.type === "multi") {
			for (const opt of q.options || []) {
				const row = opts.createDiv({ cls: `quiz-option ${q.type === "multi" ? "quiz-multi" : ""}` });
				row.createEl("span", { cls: "quiz-marker", text: q.type === "single" ? "○" : "□" });
				const label = row.createDiv({ cls: "quiz-opt-text" });
				label.innerHTML = view._resolveImagesInHtml(ctx.md2html(opt.label));
				if (q.type === "single" && q.answer === opt.id) {
					row.classList.add("is-correct");
				} else if (q.type === "multi" && (q.answers || []).includes(opt.id)) {
					row.classList.add("is-correct");
				}
			}
		}

		if (q.type === "ordering") {
			for (const item of q.items || []) {
				const row = opts.createDiv({ cls: "quiz-ordering-item" });
				row.createEl("span", { cls: "quiz-order-handle", text: "⋮⋮" });
				const label = row.createDiv({ cls: "quiz-opt-text" });
				label.innerHTML = view._resolveImagesInHtml(ctx.md2html(item.label));
			}
		}

		if (q.type === "matching") {
			const leftCol = opts.createDiv({ cls: "quiz-matching-col" });
			const rightCol = opts.createDiv({ cls: "quiz-matching-col" });
			for (const pair of q.pairs || []) {
				const lrow = leftCol.createDiv({ cls: "quiz-matching-item" });
				lrow.textContent = pair.left;
				const rrow = rightCol.createDiv({ cls: "quiz-matching-item" });
				rrow.textContent = pair.right;
			}
		}

		if (q.type === "text") {
			const ta = opts.createEl("textarea", { cls: "quiz-textarea", attrs: { readonly: true } });
			ta.value = (q.acceptedAnswers || [])[0] || "";
		}

		if (q.hint && q.hint.trim()) {
			const hintBtn = card.createEl("button", { cls: "quiz-hint-btn", text: "Indice", type: "button" });
			hintBtn.addEventListener("click", () => view._openHint(q.hint));
		}

		if (q.explain && q.explain.trim()) {
			const explainEl = card.createDiv({ cls: "quiz-explain good" });
			explainEl.innerHTML = view._resolveImagesInHtml(ctx.md2html(q.explain));
		}
	}

	return {
		buildUI,
		syncPanels,
		render,
		renderPreview
	};
};
