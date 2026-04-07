'use strict';

const obsidian = require("obsidian");
const { ConfirmModal, TypePickerModal, ImportQuizModal } = require('./modals');

module.exports = function createEditorUIHandlers(ctx) {
	const { _setIcon, _iconSpan, exportAllWithFence } = ctx;
	const view = ctx.view;

	function buildUI() {
		const root = view.contentEl;
		const header = root.createDiv({ cls: "qb-header" });

		const brand = header.createDiv({ cls: "qb-brand" });
		const logo = brand.createDiv({ cls: "qb-logo" });
		_setIcon(logo, "graduation-cap");
		const brandText = brand.createDiv({ cls: "qb-title-group" });
		brandText.createDiv({ cls: "qb-title", text: "Quiz Editor" });
		view._fileNameEl = brandText.createDiv({ cls: "qb-sub qb-file-name" });
		if (view.importedFileName) {
			view._fileNameEl.textContent = view.importedFileName;
			view._fileNameEl.classList.add("has-file");
		} else {
			view._fileNameEl.textContent = "quiz-blocks";
		}

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
						mainEl.style.setProperty('--qb-sidebar-w', '320px');
						mainEl.style.setProperty('--qb-editor-w', '480px');
						mainEl.style.setProperty('--qb-code-w', '288px');
					}
				}

				syncPanels();
			});
		}

		const actions = header.createDiv({ cls: "qb-actions" });

		// Bouton Sauvegarder - toujours visible mais grisé par défaut
		view._saveBtn = actions.createEl("button", { cls: "qb-btn qb-btn-primary qb-save-btn" });
		view._saveBtn.disabled = true;
		view._saveBtn.title = "Aucune modification à sauvegarder";
		_iconSpan(view._saveBtn, "save", "qb-btn-leading-icon");
		view._saveBtn.createSpan({ text: "Sauvegarder" });
		view._saveBtn.addEventListener("click", () => {
			if (!view._saveBtn.disabled) {
				view.saveToSourceFile?.();
			}
		});


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
			main.style.setProperty('--qb-sidebar-w', '320px');
			main.style.setProperty('--qb-editor-w', '480px');
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
		addBtn.addEventListener("click", () => showTypeModal());
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

		// Fonction pour mettre à jour l'état visuel de l'examen
		function updateExamUIState() {
			examTrack.classList.toggle("on", ctx.examOptions.enabled);
			examSection.classList.toggle("qb-exam-active", ctx.examOptions.enabled);
			examOptionsContainer.classList.toggle("qb-exam-disabled", !ctx.examOptions.enabled);
			durationInput.disabled = !ctx.examOptions.enabled;
			autoSubmitCb.disabled = !ctx.examOptions.enabled;
			showTimerCb.disabled = !ctx.examOptions.enabled;
			// Mettre à jour les valeurs aussi
			durationInput.value = String(ctx.examOptions.durationMinutes);
			autoSubmitCb.checked = ctx.examOptions.autoSubmit;
			showTimerCb.checked = ctx.examOptions.showTimer;
		}

		// Stocker la référence pour pouvoir l'appeler depuis l'import
		view.updateExamUIState = updateExamUIState;

		examToggleWrap.addEventListener("click", () => {
			ctx.examOptions.enabled = !ctx.examOptions.enabled;
			updateExamUIState();
			view.renderCode();
		});

		const durationWrap = examOptionsContainer.createDiv({ cls: "qb-field" });
		durationWrap.createEl("label", { cls: "qb-field-label", text: "Durée (minutes)" });
		const durationInput = durationWrap.createEl("input", {
			cls: "qb-field-input",
			type: "number",
			min: "1",
			max: "180",
			value: String(ctx.examOptions.durationMinutes),
			disabled: !ctx.examOptions.enabled
		});
		durationInput.addEventListener("input", () => {
			ctx.examOptions.durationMinutes = Math.max(1, Math.min(180, parseInt(durationInput.value) || 10));
			view.renderCode();
		});

		const autoSubmitWrap = examOptionsContainer.createDiv({ cls: "qb-checkbox-wrap" });
		const autoSubmitCb = autoSubmitWrap.createEl("input", {
			type: "checkbox",
			checked: ctx.examOptions.autoSubmit,
			disabled: !ctx.examOptions.enabled
		});
		autoSubmitWrap.createSpan({ text: " Soumettre auto à la fin" });
		autoSubmitCb.addEventListener("change", () => {
			ctx.examOptions.autoSubmit = autoSubmitCb.checked;
			view.renderCode();
		});

		const showTimerWrap = examOptionsContainer.createDiv({ cls: "qb-checkbox-wrap" });
		const showTimerCb = showTimerWrap.createEl("input", {
			type: "checkbox",
			checked: ctx.examOptions.showTimer,
			disabled: !ctx.examOptions.enabled
		});
		showTimerWrap.createSpan({ text: " Afficher le timer" });
		showTimerCb.addEventListener("change", () => {
			ctx.examOptions.showTimer = showTimerCb.checked;
			view.renderCode();
		});

		examOptionsContainer.classList.toggle("qb-exam-disabled", !ctx.examOptions.enabled);

		view.renderSidebar();

		const pHead = view.previewEl.createDiv({ cls: "qb-panel-head" });
		_iconSpan(pHead, "eye", "qb-panel-head-icon");
		view.previewTitleEl = pHead.createSpan({ text: "Aperçu" });
		view.previewBodyEl = view.previewEl.createDiv({ cls: "qb-preview-body" });

		const cHead = view.codeEl.createDiv({ cls: "qb-panel-head" });
		_iconSpan(cHead, "code", "qb-panel-head-icon");
		cHead.createSpan({ text: "JSON5 généré" });
		const copyBtn = cHead.createEl("button", { cls: "qb-btn qb-btn-accent qb-btn-sm" });
		_iconSpan(copyBtn, "clipboard-copy", "qb-btn-leading-icon");
		copyBtn.createSpan({ text: "Copier" });
		copyBtn.addEventListener("click", () => navigator.clipboard.writeText(exportAllWithFence(ctx.questions, ctx.examOptions)));
		view.codeOutputEl = view.codeEl.createDiv({ cls: "qb-code-output" });

		view.editorInnerEl = view.editorEl.createDiv({ cls: "qb-editor-inner" });

		// Fonction pour mettre à jour le bouton de sauvegarde et afficher notifications
		view.updateSaveIndicator = (saved) => {
			if (!view.sourceFile) {
				// Pas de fichier source - bouton grisé
				view._saveBtn.disabled = true;
				view._saveBtn.title = "Ouvrez un fichier pour sauvegarder";
				return;
			}

			if (saved) {
				// Sauvegardé - bouton grisé, notification de confirmation
				view._saveBtn.disabled = true;
				view._saveBtn.title = "Toutes les modifications sont sauvegardées";
				// Notification professionnelle
				new obsidian.Notice("✓ Sauvegardé", 2000);
			} else {
				// Modifications en attente - bouton actif
				view._saveBtn.disabled = false;
				view._saveBtn.title = "Cliquez pour sauvegarder les modifications";
			}
		};

		syncPanels();
	}

	function syncPanels() {
		const mainEl = view.contentEl.querySelector('.qb-main');
		const map = { sidebar: view.sidebarEl, editor: view.editorEl, preview: view.previewEl, code: view.codeEl };

		const defaultWidths = { sidebar: '320px', editor: '352px', code: '288px' };

		if (ctx.panels.preview && mainEl) {
			const editorWidth = mainEl.style.getPropertyValue('--qb-editor-w');
			if (editorWidth === 'auto') {
				mainEl.style.setProperty('--qb-editor-w', defaultWidths.editor);
			}
			const codeWidth = mainEl.style.getPropertyValue('--qb-code-w');
			if (codeWidth === 'auto') {
				mainEl.style.setProperty('--qb-code-w', defaultWidths.code);
			}
		}

		for (const [k, el] of Object.entries(map)) {
			if (!el) continue;
			el.toggleClass("qb-hidden", !ctx.panels[k]);
		}

		if (mainEl) {
			const mainRect = mainEl.getBoundingClientRect();
			let fixedWidthSum = 0;
			if (ctx.panels.sidebar) {
				const sidebarWidth = parseFloat(mainEl.style.getPropertyValue('--qb-sidebar-w') || '320');
				fixedWidthSum += sidebarWidth;
			}
			if (ctx.panels.editor) {
				const editorWidth = parseFloat(mainEl.style.getPropertyValue('--qb-editor-w') || '480');
				fixedWidthSum += editorWidth;
			}
			if (ctx.panels.code) {
				const codeWidth = parseFloat(mainEl.style.getPropertyValue('--qb-code-w') || '288');
				fixedWidthSum += codeWidth;
			}
			if (fixedWidthSum > mainRect.width * 0.7) {
				mainEl.style.setProperty('--qb-sidebar-w', '320px');
				mainEl.style.setProperty('--qb-editor-w', '480px');
				mainEl.style.setProperty('--qb-code-w', '288px');
			}
		}

		view.contentEl.querySelectorAll(".qb-toggle").forEach(btn => btn.toggleClass("active", !!ctx.panels[btn.dataset.panel]));

		if (view.resizerSidebarEditor) {
			const showSidebarEditor = ctx.panels.sidebar && ctx.panels.editor;
			view.resizerSidebarEditor.toggleClass("qb-hidden", !showSidebarEditor);
		}
		if (view.resizerEditorPreview) {
			const showEditorPreview = ctx.panels.editor && ctx.panels.preview;
			view.resizerEditorPreview.toggleClass("qb-hidden", !showEditorPreview);
		}
		if (view.resizerPreviewCode) {
			const showPreviewCode = ctx.panels.preview && ctx.panels.code;
			view.resizerPreviewCode.toggleClass("qb-hidden", !showPreviewCode);
		}
	}

	function render() {
		view.renderSidebar();
		view.renderEditor();
		view.schedulePreview();
		view.renderCode();
		syncPanels();
	}

	function showTypeModal() {
		const modal = new TypePickerModal(view.app, type => {
			const { makeDefault } = require('./utils');
			const nq = makeDefault(type);
			nq.title = `Question ${ctx.questions.length + 1}`;
			ctx.questions.push(nq);
			ctx.activeIdx = ctx.questions.length - 1;
			view.render();
		});
		modal.open();
	}

	return {
		buildUI,
		syncPanels,
		render,
		showTypeModal
	};
};
