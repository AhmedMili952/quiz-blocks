'use strict';

const obsidian = require("obsidian");
const { parseQuizSource } = require("../quiz-utils");
const { Q_TYPES, loadReact, _setIcon, _iconSpan, makeDefault, md2html, escHtml, esc5 } = require("./utils");
const { exportQuestion, exportAll, exportAllWithFence } = require("./export");
const { ConfirmModal, TypePickerModal, ImportQuizModal, QuizFileSuggestModal, ImportFromNoteModal } = require("./modals");

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

	/* ═══════════ BUILD SHELL ═══════════ */
	buildUI() {
		const root = this.contentEl;
		const header = root.createDiv({ cls: "qb-header" });

		const brand = header.createDiv({ cls: "qb-brand" });
		const logo = brand.createDiv({ cls: "qb-logo" });
		_setIcon(logo, "graduation-cap");
		const brandText = brand.createDiv({ cls: "qb-title-group" });
		brandText.createDiv({ cls: "qb-title", text: "Quiz Editor" });
		brandText.createDiv({ cls: "qb-sub", text: "quiz-blocks" });

		const toggles = header.createDiv({ cls: "qb-toggles" });
		for (const [key, label, lucide] of [["sidebar", "Questions", "list"], ["editor", "Éditeur", "pencil"], ["preview", "Aperçu", "eye"], ["code", "Code", "code"]]) {
			const btn = toggles.createEl("button", { cls: `qb-toggle ${this.panels[key] ? "active" : ""}` });
			btn.dataset.panel = key;
			_iconSpan(btn, lucide, "qb-toggle-icon");
			btn.createSpan({ cls: "qb-toggle-label", text: label });
			btn.addEventListener("click", () => {
				const wasVisible = this.panels[key];
				this.panels[key] = !this.panels[key];
				if (!Object.values(this.panels).some(Boolean)) this.panels[key] = true;

				// If showing a panel, reset ALL panel widths to default
				if (!wasVisible && this.panels[key]) {
					const mainEl = this.contentEl.querySelector('.qb-main');
					if (mainEl) {
						mainEl.style.setProperty('--qb-sidebar-w', '224px');
						mainEl.style.setProperty('--qb-editor-w', '352px');
						mainEl.style.setProperty('--qb-code-w', '288px');
					}
				}

				this.syncPanels();
			});
		}

		const actions = header.createDiv({ cls: "qb-actions" });

		// Import button
		const importBtn = actions.createEl("button", { cls: "qb-btn" });
		_iconSpan(importBtn, "download", "qb-btn-leading-icon");
		importBtn.createSpan({ text: "Importer" });
		importBtn.addEventListener("click", () => {
			new ImportQuizModal(this.app, this).open();
		});

		this._exportBtn = actions.createEl("button", { cls: "qb-btn qb-btn-accent" });
		_iconSpan(this._exportBtn, "share", "qb-btn-leading-icon");
		this._exportBtn.createSpan({ text: "Exporter" });
		this._exportBtn.addEventListener("click", () => {
			navigator.clipboard.writeText(exportAllWithFence(this.questions, this.examOptions)).then(() => {
				this._exportBtn.empty();
				_iconSpan(this._exportBtn, "check", "qb-btn-leading-icon");
				this._exportBtn.createSpan({ text: "Copié !" });
				this._exportBtn.classList.add("qb-btn-ok");
				setTimeout(() => {
					this._exportBtn.empty();
					_iconSpan(this._exportBtn, "share", "qb-btn-leading-icon");
					this._exportBtn.createSpan({ text: "Exporter" });
					this._exportBtn.classList.remove("qb-btn-ok");
				}, 2000);
			});
		});

		const main = root.createDiv({ cls: "qb-main" });

		// Initialize CSS custom properties for panel widths on this container
		if (!main.style.getPropertyValue('--qb-sidebar-w')) {
			main.style.setProperty('--qb-sidebar-w', '224px'); // 14em default
			main.style.setProperty('--qb-editor-w', '352px'); // 22em default
			main.style.setProperty('--qb-code-w', '288px'); // 18em default
		}

		this.sidebarEl = main.createDiv({ cls: "qb-panel qb-sidebar" });

		// Resizer between sidebar and editor
		this.resizerSidebarEditor = main.createDiv({ cls: "qb-resizer" });
		this.resizerSidebarEditor.dataset.resizer = "sidebar-editor";

		this.editorEl = main.createDiv({ cls: "qb-panel qb-editor" });

		// Resizer between editor and preview
		this.resizerEditorPreview = main.createDiv({ cls: "qb-resizer" });
		this.resizerEditorPreview.dataset.resizer = "editor-preview";

		this.previewEl = main.createDiv({ cls: "qb-panel qb-preview" });

		// Resizer between preview and code
		this.resizerPreviewCode = main.createDiv({ cls: "qb-resizer" });
		this.resizerPreviewCode.dataset.resizer = "preview-code";

		this.codeEl = main.createDiv({ cls: "qb-panel qb-code" });

		// Setup drag-resize handlers
		this._setupResizer(this.resizerSidebarEditor, this.sidebarEl, this.editorEl, 'sidebar-editor');
		this._setupResizer(this.resizerEditorPreview, this.editorEl, this.previewEl, 'editor-preview');
		this._setupResizer(this.resizerPreviewCode, this.previewEl, this.codeEl, 'preview-code');

		const sHead = this.sidebarEl.createDiv({ cls: "qb-sidebar-head" });
		this.qCountEl = sHead.createSpan({ text: "Questions (1)" });
		const addBtn = sHead.createEl("button", { cls: "qb-btn-icon" });
		_setIcon(addBtn, "plus");
		addBtn.addEventListener("click", () => this.showTypeModal());
		this.sidebarListEl = this.sidebarEl.createDiv({ cls: "qb-sidebar-list" });

		// Section Mode Examen
		const examSection = this.sidebarEl.createDiv({ cls: "qb-collapsible qb-exam-section" });
		const examSummary = examSection.createEl("summary", { cls: "qb-exam-summary" });
		_iconSpan(examSummary, "graduation-cap", "qb-exam-summary-icon");
		examSummary.createSpan({ text: " Mode Examen" });
		const examBody = examSection.createDiv({ cls: "qb-exam-body" });

		// Options container - disabled when exam mode is off
		const examOptionsContainer = examBody.createDiv({ cls: "qb-exam-options" });

		// Toggle exam mode
		const examToggleWrap = examOptionsContainer.createDiv({ cls: "qb-toggle-wrap" });
		const examTrack = examToggleWrap.createDiv({ cls: `qb-toggle-track ${this.examOptions.enabled ? "on" : ""}` });
		examTrack.createDiv({ cls: "qb-toggle-thumb" });
		examToggleWrap.createSpan({ text: "Activer le mode examen" });
		examToggleWrap.addEventListener("click", () => {
			this.examOptions.enabled = !this.examOptions.enabled;
			examTrack.classList.toggle("on", this.examOptions.enabled);
			examOptionsContainer.classList.toggle("qb-exam-disabled", !this.examOptions.enabled);
			this.renderCode();
		});

		// Durée
		const durationWrap = examOptionsContainer.createDiv({ cls: "qb-field" });
		durationWrap.createEl("label", { cls: "qb-field-label", text: "Durée (minutes)" });
		const durationInput = durationWrap.createEl("input", {
			cls: "qb-field-input",
			type: "number",
			min: "1",
			max: "180",
			value: String(this.examOptions.durationMinutes),
			disabled: !this.examOptions.enabled
		});
		durationInput.addEventListener("input", () => {
			this.examOptions.durationMinutes = Math.max(1, Math.min(180, parseInt(durationInput.value) || 10));
			this.renderCode();
		});

		// Options
		const autoSubmitWrap = examOptionsContainer.createDiv({ cls: "qb-checkbox-wrap" });
		const autoSubmitCb = autoSubmitWrap.createEl("input", {
			type: "checkbox",
			checked: this.examOptions.autoSubmit,
			disabled: !this.examOptions.enabled
		});
		autoSubmitWrap.createSpan({ text: " Soumettre auto à la fin" });
		autoSubmitCb.addEventListener("change", () => {
			this.examOptions.autoSubmit = autoSubmitCb.checked;
			this.renderCode();
		});

		const showTimerWrap = examOptionsContainer.createDiv({ cls: "qb-checkbox-wrap" });
		const showTimerCb = showTimerWrap.createEl("input", {
			type: "checkbox",
			checked: this.examOptions.showTimer,
			disabled: !this.examOptions.enabled
		});
		showTimerWrap.createSpan({ text: " Afficher le timer" });
		showTimerCb.addEventListener("change", () => {
			this.examOptions.showTimer = showTimerCb.checked;
			this.renderCode();
		});

		// Initial state
		examOptionsContainer.classList.toggle("qb-exam-disabled", !this.examOptions.enabled);

		const pHead = this.previewEl.createDiv({ cls: "qb-panel-head" });
		_iconSpan(pHead, "eye", "qb-panel-head-icon");
		this.previewTitleEl = pHead.createSpan({ text: "Aperçu" });
		this.previewBodyEl = this.previewEl.createDiv({ cls: "qb-preview-body" });

		const cHead = this.codeEl.createDiv({ cls: "qb-panel-head" });
		_iconSpan(cHead, "code", "qb-panel-head-icon");
		cHead.createSpan({ text: "JSON5 généré" });
		const copyBtn = cHead.createEl("button", { cls: "qb-btn qb-btn-accent qb-btn-sm" });
		_iconSpan(copyBtn, "clipboard-copy", "qb-btn-leading-icon");
		copyBtn.createSpan({ text: "Copier" });
		copyBtn.addEventListener("click", () => navigator.clipboard.writeText(exportAllWithFence(this.questions, this.examOptions)));
		this.codeOutputEl = this.codeEl.createDiv({ cls: "qb-code-output" });

		this.editorInnerEl = this.editorEl.createDiv({ cls: "qb-editor-inner" });
	}

	/* ═══════════ RESIZE HANDLERS ═══════════ */
	_setupResizer(resizerEl, leftPanel, rightPanel, type) {
		let startX = 0;
		let startWidthLeft = 0;
		let startWidthRight = 0;
		let isDragging = false;
		let overlay = null;
		let rafId = null;

		// State for RAF - using a simple object to avoid closures in loop
		const dragState = {
			delta: 0,
			mainEl: null,
			needsUpdate: false
		};

		const updatePanels = () => {
			if (!dragState.needsUpdate || !dragState.mainEl) return;

			const delta = dragState.delta;
			const mainEl = dragState.mainEl;

			// Calculate new widths
			const newLeftWidth = startWidthLeft + delta;
			const newRightWidth = startWidthRight - delta;

			// Get main container width to calculate preview available space
			const mainRect = mainEl.getBoundingClientRect();
			const minPreviewWidth = 100;

			// Handle resizers involving preview (flex panel) differently
			if (type === 'editor-preview') {
				// Only editor has fixed width, preview flexes to fill
				// Check close left (editor)
				if (newLeftWidth <= this._hideThreshold && delta < 0) {
					this._closeLeftPanel(type, mainEl);
					this.syncPanels();
					dragState.needsUpdate = false;
					return;
				}
				// Check close right (preview) - preview closing means dragging right past threshold
				if (newRightWidth <= this._hideThreshold && delta > 0) {
					this._closeRightPanel(type, mainEl);
					this.syncPanels();
					dragState.needsUpdate = false;
					return;
				}
				// Normal resize: editor must be >= min, and preview must have >= 100px remaining
				const previewWidth = mainRect.width - newLeftWidth;
				if (newLeftWidth >= this._minPanelWidth && previewWidth >= minPreviewWidth) {
					this._resizePanels(type, mainEl, newLeftWidth, newRightWidth);
				}
			} else if (type === 'preview-code') {
				// Only code has fixed width, preview flexes to fill
				// Standard calculation: newRightWidth = startWidthRight - delta
				const newCodeWidth = startWidthRight - delta;

				// Check close right (code) - dragging right past threshold
				if (newCodeWidth <= this._hideThreshold && delta > 0) {
					this._closeRightPanel(type, mainEl);
					this.syncPanels();
					dragState.needsUpdate = false;
					return;
				}
				// Check close left (preview) - dragging left past threshold
				const previewWidth = mainRect.width - newCodeWidth;
				if (previewWidth <= this._hideThreshold && delta < 0) {
					this._closeLeftPanel(type, mainEl);
					this.syncPanels();
					dragState.needsUpdate = false;
					return;
				}
				// Normal resize: code must be >= min, and preview must have >= 100px remaining
				if (newCodeWidth >= this._minPanelWidth && previewWidth >= minPreviewWidth) {
					this._resizePanels(type, mainEl, 0, newCodeWidth);
				}
			} else {
				// Standard resizer (sidebar-editor): both panels have fixed widths
				// Check close left
				if (newLeftWidth <= this._hideThreshold && delta < 0) {
					this._closeLeftPanel(type, mainEl);
					this.syncPanels();
					dragState.needsUpdate = false;
					return;
				}
				// Check close right
				if (newRightWidth <= this._hideThreshold && delta > 0) {
					this._closeRightPanel(type, mainEl);
					this.syncPanels();
					dragState.needsUpdate = false;
					return;
				}
				// Normal resize - ensure minimum width for both fixed panels
				if (newLeftWidth >= this._minPanelWidth && newRightWidth >= this._minPanelWidth) {
					this._resizePanels(type, mainEl, newLeftWidth, newRightWidth);
				}
			}

			dragState.needsUpdate = false;
		};

		const scheduleUpdate = () => {
			if (!dragState.needsUpdate) {
				dragState.needsUpdate = true;
				rafId = requestAnimationFrame(() => {
					updatePanels();
				});
			}
		};

		const onMouseDown = (e) => {
			if (e.button !== 0) return;
			e.preventDefault();
			e.stopPropagation();
			isDragging = true;
			startX = e.clientX;

			// Get main element once
			dragState.mainEl = this.contentEl.querySelector('.qb-main');
			if (!dragState.mainEl) return;

			// Store current widths for both panels
			const leftRect = leftPanel.getBoundingClientRect();
			const rightRect = rightPanel.getBoundingClientRect();
			startWidthLeft = leftRect.width;
			startWidthRight = rightRect.width;

			// Save current widths before any changes
			if (type === 'sidebar-editor') {
				this._savedWidths.sidebar = startWidthLeft;
				this._savedWidths.editor = startWidthRight;
			} else if (type === 'editor-preview') {
				this._savedWidths.editor = startWidthLeft;
				this._savedWidths.preview = startWidthRight;
			} else if (type === 'preview-code') {
				this._savedWidths.preview = startWidthLeft;
				this._savedWidths.code = startWidthRight;
			}

			// Create overlay to capture mouse events outside the resizer
			overlay = document.createElement('div');
			overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;cursor:ew-resize;';
			document.body.appendChild(overlay);

			resizerEl.classList.add('resizing');
			document.body.style.userSelect = 'none';

			// Add is-resizing class to disable transitions during drag (performance optimization)
			const mainEl = dragState.mainEl;
			if (mainEl) mainEl.classList.add('is-resizing');

			const onMouseMove = (e) => {
				if (!isDragging) return;

				// Schedule panel resize via RAF for performance
				dragState.delta = e.clientX - startX;
				scheduleUpdate();
			};

			const onMouseUp = (e) => {
				if (!isDragging) return;
				isDragging = false;

				// Cancel any pending RAF
				if (rafId) {
					cancelAnimationFrame(rafId);
					rafId = null;
				}

				// Apply final update if pending
				if (dragState.needsUpdate) {
					updatePanels();
				}

				resizerEl.classList.remove('resizing');
				document.body.style.userSelect = '';

				// Remove is-resizing class to re-enable transitions
				if (mainEl) mainEl.classList.remove('is-resizing');

				if (overlay) {
					overlay.remove();
					overlay = null;
				}

				dragState.needsUpdate = false;
				dragState.mainEl = null;

				document.removeEventListener('mousemove', onMouseMove);
				document.removeEventListener('mouseup', onMouseUp);
			};

			document.addEventListener('mousemove', onMouseMove, { passive: true });
			document.addEventListener('mouseup', onMouseUp);
		};

		resizerEl.addEventListener('mousedown', onMouseDown);
	}

	_closeLeftPanel(type, mainEl) {
		const panelNames = {
			'sidebar-editor': 'sidebar',
			'editor-preview': 'editor',
			'preview-code': 'preview'
		};
		const panel = panelNames[type];

		if (!panel) return;

		this.panels[panel] = false;
		if (panel !== 'preview') {
			mainEl.style.setProperty(`--qb-${panel}-w`, '0px');
		}

		// Prevent hiding all panels
		if (!Object.values(this.panels).some(Boolean)) {
			this.panels[panel] = true;
			if (panel !== 'preview') {
				mainEl.style.setProperty(`--qb-${panel}-w`, `${this._savedWidths[panel]}px`);
			}
		}
	}

	_closeRightPanel(type, mainEl) {
		const panelNames = {
			'sidebar-editor': 'editor',
			'editor-preview': 'preview',
			'preview-code': 'code'
		};
		const panel = panelNames[type];

		if (!panel) return;

		this.panels[panel] = false;
		if (panel !== 'preview') {
			mainEl.style.setProperty(`--qb-${panel}-w`, '0px');
		}

		// When closing code, preview should expand (preview is left of code)
		if (type === 'preview-code') {
			// Preview uses flex:1, it will naturally expand when code width goes to 0
			// No special handling needed, but we track it
		}

		// Prevent hiding all panels
		if (!Object.values(this.panels).some(Boolean)) {
			this.panels[panel] = true;
			if (panel !== 'preview') {
				mainEl.style.setProperty(`--qb-${panel}-w`, `${this._savedWidths[panel]}px`);
			}
		}
	}

	_resizePanels(type, mainEl, leftWidth, rightWidth) {
		// Activate both panels
		const [leftPanel, rightPanel] = type.split('-');
		this.panels[leftPanel] = true;
		this.panels[rightPanel] = true;

		// Update CSS variable for panels that have fixed widths
		// preview uses flex:1, all others use fixed width
		if (leftPanel !== 'preview') {
			mainEl.style.setProperty(`--qb-${leftPanel}-w`, `${leftWidth}px`);
		}
		if (rightPanel !== 'preview') {
			mainEl.style.setProperty(`--qb-${rightPanel}-w`, `${rightWidth}px`);
		}
	}

	syncPanels() {
		const mainEl = this.contentEl.querySelector('.qb-main');
		const map = { sidebar: this.sidebarEl, editor: this.editorEl, preview: this.previewEl, code: this.codeEl };

		// Restore default width when showing a panel that was collapsed
		const defaultWidths = { sidebar: '224px', editor: '352px', code: '288px' };

		// Special case: if preview was hidden and is now shown, reset editor/code width from 'auto' to default
		if (this.panels.preview && mainEl) {
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
			// Toggle visibility class - width is managed by resize handlers or toggle button
			el.toggleClass("qb-hidden", !this.panels[k]);
		}

		// Check if total fixed panel widths exceed 70% of container - if so, reset to defaults
		if (mainEl) {
			const mainRect = mainEl.getBoundingClientRect();
			let fixedWidthSum = 0;
			if (this.panels.sidebar) {
				const sidebarWidth = parseFloat(mainEl.style.getPropertyValue('--qb-sidebar-w') || '224');
				fixedWidthSum += sidebarWidth;
			}
			if (this.panels.editor) {
				const editorWidth = parseFloat(mainEl.style.getPropertyValue('--qb-editor-w') || '352');
				fixedWidthSum += editorWidth;
			}
			if (this.panels.code) {
				const codeWidth = parseFloat(mainEl.style.getPropertyValue('--qb-code-w') || '288');
				fixedWidthSum += codeWidth;
			}
			if (fixedWidthSum > mainRect.width * 0.7) {
				mainEl.style.setProperty('--qb-sidebar-w', '224px');
				mainEl.style.setProperty('--qb-editor-w', '352px');
				mainEl.style.setProperty('--qb-code-w', '288px');
			}
		}

		this.contentEl.querySelectorAll(".qb-toggle").forEach(btn => btn.toggleClass("active", !!this.panels[btn.dataset.panel]));

		// Update resizer visibility based on adjacent panels
		if (this.resizerSidebarEditor) {
			const showSidebarEditor = this.panels.sidebar && this.panels.editor;
			this.resizerSidebarEditor.toggleClass("qb-hidden", !showSidebarEditor);
		}
		if (this.resizerEditorPreview) {
			const showEditorPreview = this.panels.editor && this.panels.preview;
			this.resizerEditorPreview.toggleClass("qb-hidden", !showEditorPreview);
		}
		if (this.resizerPreviewCode) {
			const showPreviewCode = this.panels.preview && this.panels.code;
			this.resizerPreviewCode.toggleClass("qb-hidden", !showPreviewCode);
		}
	}

	render() {
		this.renderSidebar();
		this.renderEditor();
		this.schedulePreview();
		this.renderCode();
		this.syncPanels();
	}

	/* ═══════════ SIDEBAR ═══════════ */
	renderSidebar() {
		const list = this.sidebarListEl;
		list.empty();
		this.qCountEl.textContent = `Questions (${this.questions.length})`;

		this.questions.forEach((q, i) => {
			const ti = Q_TYPES.find(t => t.key === q._type) || Q_TYPES[0];
			const item = list.createDiv({ cls: `qb-q-item ${i === this.activeIdx ? "active" : ""}` });
			const qIcon = item.createDiv({ cls: "qb-q-icon" });
			_setIcon(qIcon, ti.lucide);
			const text = item.createDiv({ cls: "qb-q-text" });
			text.createDiv({ cls: "qb-q-title", text: q.title || `Question ${i + 1}` });
			text.createDiv({ cls: "qb-q-type", text: ti.label });

			// Aperçu de la réponse correcte (max 50 caractères)
			let previewText = "";
			if (q._type === "single" && q.options && q.options[q.correctIndex]) {
				previewText = q.options[q.correctIndex];
			} else if (q._type === "multi" && q.options && q.correctIndices && q.correctIndices.length > 0) {
				previewText = q.options[q.correctIndices[0]];
			} else if (["text", "cmd", "powershell", "bash"].includes(q._type) && q.acceptedAnswers && q.acceptedAnswers.length > 0) {
				previewText = q.acceptedAnswers[0];
			} else if (q._type === "ordering" && q.possibilities && q.possibilities.length > 0) {
				previewText = q.possibilities[0];
			} else if (q._type === "matching" && q.rows && q.rows.length > 0) {
				previewText = typeof q.rows[0] === "string" ? q.rows[0] : (q.rows[0]?.left || "");
			}
			if (previewText) {
				if (previewText.length > 50) previewText = previewText.substring(0, 50) + "...";
				text.createDiv({ cls: "qb-q-preview", text: previewText });
			}

			const acts = item.createDiv({ cls: "qb-q-actions" });
			const up = acts.createEl("button", { cls: "qb-btn-icon qb-btn-sm" }); _setIcon(up, "chevron-up");
			const down = acts.createEl("button", { cls: "qb-btn-icon qb-btn-sm" }); _setIcon(down, "chevron-down");
			const del = acts.createEl("button", { cls: "qb-btn-icon qb-btn-sm qb-btn-danger" }); _setIcon(del, "x");

			item.addEventListener("click", e => {
				if (e.target.closest(".qb-q-actions")) return;
				this.activeIdx = i;
				this.render();
			});
			up.addEventListener("click", () => this.moveQuestion(i, -1));
			down.addEventListener("click", () => this.moveQuestion(i, 1));
			del.addEventListener("click", () => this.deleteQuestion(i));
		});
	}

	moveQuestion(i, dir) {
		const ni = i + dir;
		if (ni < 0 || ni >= this.questions.length) return;
		[this.questions[i], this.questions[ni]] = [this.questions[ni], this.questions[i]];
		if (this.activeIdx === i) this.activeIdx = ni;
		else if (this.activeIdx === ni) this.activeIdx = i;
		this.questions.forEach((qq, idx) => { if (/^Question \d+$/.test(qq.title)) qq.title = `Question ${idx + 1}`; });
		this.render();
	}

	deleteQuestion(i) {
		if (this.questions.length <= 1) {
			new obsidian.Notice("Impossible de supprimer la dernière question");
			return;
		}

		const q = this.questions[i];
		const title = q.title || `Question ${i + 1}`;

		// Show confirmation modal
		const modal = new obsidian.ConfirmModal(this.app,
			`Supprimer "${title}" ?`,
			`Cette action est irréversible. La question sera définitivement supprimée.`,
			"Supprimer",
			"Annuler",
			(confirmed) => {
				if (confirmed) {
					this.questions.splice(i, 1);
					this.activeIdx = Math.min(this.activeIdx, this.questions.length - 1);
					this.questions.forEach((qq, idx) => { if (/^Question \d+$/.test(qq.title)) qq.title = `Question ${idx + 1}`; });
					this.render();
					new obsidian.Notice(`Question "${title}" supprimée`);
				}
			}
		);
		modal.open();
	}

	/* ═══════════ EDITOR ═══════════ */
	renderEditor() {
		const q = this.questions[this.activeIdx];
		if (!q) return;
		const ti = Q_TYPES.find(t => t.key === q._type) || Q_TYPES[0];
		const wrap = this.editorInnerEl;
		wrap.empty();

		const badge = wrap.createDiv({ cls: "qb-type-badge" });
		const badgeIcon = badge.createDiv({ cls: "qb-type-icon" }); _setIcon(badgeIcon, ti.lucide);
		const badgeText = badge.createDiv();
		badgeText.createDiv({ cls: "qb-type-label", text: ti.label });
		badgeText.createDiv({ cls: "qb-type-desc", text: ti.desc });

		this._field(wrap, "Énoncé", q.prompt, "Votre question...", true, v => { q.prompt = v; this.renderCode(); this.schedulePreview(); }, { imagePaste: true });
		this._resourceSection(wrap, q);

		const box = wrap.createDiv({ cls: "qb-section-box" });
		this._renderTypeFields(box, q);

		this._field(wrap, "Indice", q.hint, "Un indice pour aider...", true, v => { q.hint = v; this.renderCode(); this.schedulePreview(); }, { imagePaste: true });
		this._field(wrap, "Explication (Markdown)", q.explain, "### Rappels\n- **Terme** — Définition", true, v => { q.explain = v; this.renderCode(); this.schedulePreview(); }, { imagePaste: true });
	}

	_field(parent, label, value, placeholder, multiline, onChange, opts = {}) {
		const wrap = parent.createDiv();
		wrap.createEl("label", { cls: "qb-field-label", text: label });
		if (multiline) {
			const ta = wrap.createEl("textarea", { cls: "qb-field-textarea", placeholder, text: value ?? "" });
			ta.addEventListener("input", () => onChange(ta.value));
			if (opts.imagePaste) {
				ta.addEventListener("paste", async (e) => {
					const items = e.clipboardData?.items;
					if (!items) return;
					for (const item of items) {
						if (item.type.startsWith("image/")) {
							e.preventDefault();
							const file = item.getAsFile();
							if (!file) continue;
							const now = new Date();
							const ts = now.getFullYear().toString() +
								String(now.getMonth() + 1).padStart(2, "0") +
								String(now.getDate()).padStart(2, "0") +
								String(now.getHours()).padStart(2, "0") +
								String(now.getMinutes()).padStart(2, "0") +
								String(now.getSeconds()).padStart(2, "0");
							const ext = item.type.split("/")[1] || "png";
							const fileName = `Pasted image ${ts}.${ext}`;
							const attachFolder = this.plugin.app.vault.getConfig("attachmentFolderPath") || "";
							const filePath = attachFolder ? attachFolder + "/" + fileName : fileName;
							const buffer = await file.arrayBuffer();
							await this.plugin.app.vault.adapter.writeBinary(filePath, new Uint8Array(buffer));
							const before = ta.value.slice(0, ta.selectionStart);
							const after = ta.value.slice(ta.selectionEnd);
							ta.value = before + `![[${fileName}]]` + after;
							ta.selectionStart = ta.selectionEnd = before.length + `![[${fileName}]]`.length;
							onChange(ta.value);
							this.schedulePreview();
							break;
						}
					}
				});
			}
		} else {
			const inp = wrap.createEl("input", { cls: "qb-field-input", placeholder, value: value ?? "" });
			inp.addEventListener("input", () => onChange(inp.value));
		}
		return wrap;
	}

	_resourceSection(parent, q) {
		const details = parent.createEl("details", { cls: "qb-collapsible" });
		const summary = details.createEl("summary");
		_iconSpan(summary, "paperclip", "qb-summary-icon");
		summary.createSpan({ text: " Bouton ressource (optionnel)" });
		const body = details.createDiv({ cls: "qb-collapsible-body" });
		const renderInner = () => {
			body.empty();
			const has = !!q.resourceButton;
			const toggleWrap = body.createDiv({ cls: "qb-toggle-wrap" });
			const track = toggleWrap.createDiv({ cls: `qb-toggle-track ${has ? "on" : ""}` });
			track.createDiv({ cls: "qb-toggle-thumb" });
			toggleWrap.createSpan({ text: "Activer le bouton ressource" });
			toggleWrap.addEventListener("click", () => { q.resourceButton = q.resourceButton ? null : { label: "Activité PT", fileName: "" }; renderInner(); this.renderCode(); this.schedulePreview(); });
			if (has) {
				this._field(body, "Label", q.resourceButton.label, "Activité PT", false, v => { q.resourceButton.label = v; this.renderCode(); this.schedulePreview(); });
				this._field(body, "Nom du fichier", q.resourceButton.fileName, "fichier.pka", false, v => { q.resourceButton.fileName = v; this.renderCode(); this.schedulePreview(); });
			}
		};
		renderInner();
	}

	_renderTypeFields(box, q) {
		const t = q._type;
		const rerender = () => { this.renderCode(); this.schedulePreview(); };

		if (t === "single" || t === "multi") {
			const renderCards = () => {
				// Remove existing cards container if any
				const existingContainer = box.querySelector('.qb-answer-cards');
				if (existingContainer) existingContainer.remove();

				const cardsContainer = box.createDiv({ cls: "qb-answer-cards" });

				q.options.forEach((o, i) => {
					const isCorrect = t === "single" ? i === q.correctIndex : (q.correctIndices || []).includes(i);
					const card = cardsContainer.createDiv({ cls: `qb-answer-card ${isCorrect ? "qb-answer-correct" : "qb-answer-wrong"}` });

					// StudySmarter-style toggle
					const toggleRow = card.createDiv({ cls: "qb-answer-toggle-row" });
					toggleRow.createSpan({ cls: "qb-answer-toggle-label", text: isCorrect ? "Bonne réponse" : "Mauvaise réponse" });

					const toggle = toggleRow.createDiv({ cls: "qb-answer-toggle" });
					const track = toggle.createDiv({ cls: "qb-answer-toggle-track" });
					const thumb = track.createDiv({ cls: "qb-answer-toggle-thumb" });
					_setIcon(thumb, isCorrect ? "check" : "x");

					// Flash animation on state change
					const triggerFlash = (toCorrect) => {
						card.classList.remove("qb-answer-flash-green", "qb-answer-flash-red");
						void card.offsetWidth; // Force reflow
						card.classList.add(toCorrect ? "qb-answer-flash-green" : "qb-answer-flash-red");
						setTimeout(() => {
							card.classList.remove("qb-answer-flash-green", "qb-answer-flash-red");
						}, 500);
					};

					toggle.addEventListener("click", () => {
						if (t === "single") {
							if (!isCorrect) {
								triggerFlash(true);
								q.correctIndex = i;
								this.render();
							}
						} else {
							const a = q.correctIndices || [];
							if (a.includes(i)) {
								if (a.length > 1) {
									triggerFlash(false);
									q.correctIndices = a.filter(x => x !== i);
									this.render();
								}
							} else {
								triggerFlash(true);
								q.correctIndices = [...a, i].sort((a, b) => a - b);
								this.render();
							}
						}
					});

					// Simple text input for option
					const input = card.createEl("input", {
						cls: "qb-answer-input",
						type: "text",
						value: o || "",
						placeholder: "Saisir la réponse"
					});

					input.addEventListener("input", () => {
						q.options[i] = input.value;
						rerender();
					});

					// Paste handler for images - insert ![[filename.png]]
					input.addEventListener("paste", async (e) => {
						const items = e.clipboardData?.items;
						if (!items) return;

						for (const item of items) {
							if (item.type.startsWith("image/")) {
								e.preventDefault();
								const file = item.getAsFile();
								if (!file) continue;

								try {
									const now = new Date();
									const ts = now.getFullYear().toString() +
										String(now.getMonth() + 1).padStart(2, "0") +
										String(now.getDate()).padStart(2, "0") +
										String(now.getHours()).padStart(2, "0") +
										String(now.getMinutes()).padStart(2, "0") +
										String(now.getSeconds()).padStart(2, "0");
									const ext = file.type?.split("/")[1] || "png";
									const fileName = `Pasted image ${ts}.${ext}`;

									const folder = this.plugin.app.vault.getConfig('attachmentFolderPath') || '';
									const path = folder ? folder + '/' + fileName : fileName;

									const buf = await file.arrayBuffer();
									await this.plugin.app.vault.adapter.writeBinary(path, new Uint8Array(buf));

									// Insert ![[filename]] at cursor position
									const before = input.value.slice(0, input.selectionStart);
									const after = input.value.slice(input.selectionEnd);
									const wikiLink = `![[${fileName}]]`;
									input.value = before + wikiLink + after;
									input.selectionStart = input.selectionEnd = before.length + wikiLink.length;

									q.options[i] = input.value;
									this.schedulePreview();
									this.renderCode();
								} catch (err) {
									console.error("Failed to paste image:", err);
								}
								break;
							}
						}
					});

					// Bouton supprimer (uniquement pour mauvaises réponses et si plus de 2 options)
					if (!isCorrect && q.options.length > 2) {
						const delBtn = card.createEl("button", { cls: "qb-answer-delete" });
						_setIcon(delBtn, "x");
						delBtn.addEventListener("click", () => {
							q.options.splice(i, 1);
							// Adjust correct indices
							if (t === "single") {
								if (q.correctIndex === i) q.correctIndex = 0;
								else if (q.correctIndex > i) q.correctIndex--;
							} else {
								q.correctIndices = (q.correctIndices || []).filter(idx => idx !== i).map(idx => idx > i ? idx - 1 : idx);
							}
							this.render();
						});
					}
				});

				// Bouton Ajouter
				const addBtn = box.createEl("button", { cls: "qb-answer-add" });
				addBtn.createSpan({ text: "Ajouter une réponse" });
				addBtn.addEventListener("click", () => {
					q.options.push("");
					if (t === "multi" && q.options.length === 1) {
						q.correctIndices = [0];
					}
					this.render();
				});
			};

			renderCards();
		}

		if (t === "ordering") {
			this._arrayEditor(box, "Possibilités", q.possibilities, () => {
				while (q.correctOrder.length < q.possibilities.length) q.correctOrder.push(q.correctOrder.length);
				q.correctOrder = q.correctOrder.slice(0, q.possibilities.length);
				while (q.slots.length < q.possibilities.length) q.slots.push(`Étape ${q.slots.length + 1}`);
				q.slots = q.slots.slice(0, q.possibilities.length);
				rerender();
			}, "Élément", "Ajouter");
			this._arrayEditor(box, "Labels des slots", q.slots, rerender, "Slot", "Ajouter");

			box.createEl("label", { cls: "qb-field-label", text: "Ordre correct (index → slot)" });
			(q.correctOrder || []).forEach((val, i) => {
				const row = box.createDiv({ cls: "qb-arr-row" });
				row.createSpan({ cls: "qb-arr-idx", text: (q.slots?.[i] || `S${i}`) + " →" });
				const inp = row.createEl("input", { cls: "qb-field-input qb-field-sm", type: "number", value: val });
				inp.min = 0; inp.max = q.possibilities.length - 1; inp.style.width = "55px";
				inp.addEventListener("input", () => { q.correctOrder[i] = parseInt(inp.value) || 0; rerender(); });
			});
		}

		if (t === "matching") {
			this._arrayEditor(box, "Lignes (situations)", q.rows, () => {
				while (q.correctMap.length < q.rows.length) q.correctMap.push(0);
				q.correctMap = q.correctMap.slice(0, q.rows.length);
				rerender();
			}, "Situation", "Ajouter");
			this._arrayEditor(box, "Choix (supports)", q.choices, () => {
				q.correctMap = q.correctMap.map(v => Math.min(v, q.choices.length - 1));
				rerender();
			}, "Choix", "Ajouter");

			box.createEl("label", { cls: "qb-field-label", text: "Associations" });
			(q.rows || []).forEach((row, i) => {
				const r = box.createDiv({ cls: "qb-match-row" });
				r.createSpan({ cls: "qb-match-label", text: row || `Ligne ${i}` });
				_iconSpan(r, "arrow-right", "qb-match-arrow");
				const sel = r.createEl("select", { cls: "qb-field-select" });
				(q.choices || []).forEach((c, ci) => {
					const opt = sel.createEl("option", { text: c || "...", value: ci });
					if ((q.correctMap?.[i] ?? 0) === ci) opt.selected = true;
				});
				sel.addEventListener("change", () => { q.correctMap[i] = parseInt(sel.value) || 0; rerender(); });
			});
		}

		if (["text", "cmd", "powershell", "bash"].includes(t)) {
			if (t === "cmd" || t === "powershell")
				this._field(box, "Prefix du prompt", q.commandPrefix, t === "cmd" ? "C:\\>" : "PS>", false, v => { q.commandPrefix = v; rerender(); });
			this._field(box, "Placeholder", q.placeholder, "Texte indicatif...", false, v => { q.placeholder = v; rerender(); });
			this._arrayEditor(box, "Réponses acceptées", q.acceptedAnswers, rerender, "Réponse", "Ajouter");
			const toggleWrap = box.createDiv({ cls: "qb-toggle-wrap" });
			const track = toggleWrap.createDiv({ cls: `qb-toggle-track ${q.caseSensitive ? "on" : ""}` });
			track.createDiv({ cls: "qb-toggle-thumb" });
			toggleWrap.createSpan({ text: "Sensible à la casse" });
			toggleWrap.addEventListener("click", () => { q.caseSensitive = !q.caseSensitive; this.render(); });
		}
	}

	_arrayEditor(parent, label, items, onChange, placeholder, addLabel) {
		parent.createEl("label", { cls: "qb-field-label", text: label });
		const container = parent.createDiv();
		const renderItems = () => {
			container.empty();
			items.forEach((item, i) => {
				const row = container.createDiv({ cls: "qb-arr-row" });
				const inp = row.createEl("input", { cls: "qb-field-input", placeholder: `${placeholder} ${i + 1}`, value: item ?? "" });
				inp.addEventListener("input", () => { items[i] = inp.value; onChange(); });
				const del = row.createEl("button", { cls: "qb-btn-icon qb-btn-sm qb-btn-danger" }); _setIcon(del, "x");
				if (items.length <= 1) del.disabled = true;
				del.addEventListener("click", () => { if (items.length <= 1) return; items.splice(i, 1); onChange(); renderItems(); });
			});
			const addBtn = container.createEl("button", { cls: "qb-arr-add" });
			_iconSpan(addBtn, "plus", "qb-arr-add-icon");
			addBtn.createSpan({ text: addLabel });
			addBtn.addEventListener("click", () => { items.push(""); onChange(); renderItems(); });
		};
		renderItems();
	}

	/* ═══════════════════════════════════════════════════
	   STATIC PREVIEW — uses engine CSS classes
	   Shows active question in "locked + correct" state
	   No nav, no carousel, no submit, no results
	   ═══════════════════════════════════════════════════ */
	schedulePreview() {
		if (this._previewDebounce) clearTimeout(this._previewDebounce);
		this._previewDebounce = setTimeout(() => this.renderPreview(), 150);
	}

	renderPreview() {
		const body = this.previewBodyEl;
		body.empty();

		const q = this.questions[this.activeIdx];
		if (!q) return;

		const t = q._type;
		const ti = Q_TYPES.find(x => x.key === t) || Q_TYPES[0];

		// Update header
		this.previewTitleEl.textContent = `Aperçu — ${q.title || `Question ${this.activeIdx + 1}`}`;

		// Host container (same class as real engine)
		const host = body.createDiv({ cls: "quiz-blocks-host" });

		// Card (same structure as engine)
		const card = host.createEl("section", { cls: "quiz-card" });

		// Title
		card.createEl("h2", { text: q.title || `Question ${this.activeIdx + 1}` });

		// Resource button
		if (q.resourceButton && q.resourceButton.fileName) {
			const rbtn = card.createEl("button", { cls: "quiz-resource-btn" });
			rbtn.createSpan({ cls: "quiz-resource-btn-icon", text: "📎" });
			rbtn.createSpan({ cls: "quiz-resource-btn-label", text: q.resourceButton.label || "Ressource" });
		}

		// Prompt
		if (q.prompt) {
			const promptEl = card.createDiv({ cls: "quiz-question" });
			promptEl.innerHTML = md2html(q.prompt);
			// Resolve image paths to resource URLs
			promptEl.querySelectorAll("img.qb-md-img").forEach(img => {
				const fileName = img.getAttribute("src");
				if (fileName) {
					const attachFolder = this.app.vault.getConfig("attachmentFolderPath") || "";
					const folderPath = attachFolder.replace("${file}", "").replace(/\/$/, "") || ".";
					const filePath = folderPath === "." ? fileName : `${folderPath}/${fileName}`;
					const file = this.app.vault.getAbstractFileByPath(filePath);
					if (file) {
						img.src = this.app.vault.adapter.getResourcePath(filePath);
					}
				}
			});
		}

		// ─── Type-specific body ───
		if (t === "single" || t === "multi") {
			const isMulti = t === "multi";
			if (isMulti) card.createDiv({ cls: "quiz-multi-indicator", text: "Sélectionnez une ou plusieurs réponses" });

			(q.options || []).forEach((o, i) => {
				const isCorrect = isMulti ? (q.correctIndices || []).includes(i) : i === q.correctIndex;
				const cls = `quiz-option ${isMulti ? "multi" : ""} ${isCorrect ? "correct" : ""}`.trim();
				const opt = card.createDiv({ cls, attr: { role: "button", tabindex: "0" } });
				// Convert markdown to HTML and resolve images
				opt.innerHTML = this._resolveImagesInHtml(md2html(o || "..."));
			});
		}

		if (t === "ordering") {
			card.createDiv({ cls: "quiz-multi-indicator", text: "Classez les éléments dans le bon ordre" });
			const orderingWrap = card.createDiv({ cls: "quiz-ordering" });
			const slotsWrap = orderingWrap.createDiv({ cls: "quiz-ordering-slots" });
			(q.slots || []).forEach((slotLabel, si) => {
				const oi = q.correctOrder?.[si];
				const itemText = q.possibilities?.[oi] || "?";
				const slot = slotsWrap.createDiv({ cls: "quiz-slot filled correct" });
				slot.createDiv({ cls: "quiz-slot-label", text: slotLabel });
				slot.createDiv({ cls: "quiz-slot-value", text: itemText });
			});
		}

		if (t === "matching") {
			card.createDiv({ cls: "quiz-multi-indicator", text: "Associez chaque situation à un support" });
			const matchWrap = card.createDiv({ cls: "quiz-ordering" });
			const slotsWrap = matchWrap.createDiv({ cls: "quiz-ordering-slots" });
			(q.rows || []).forEach((row, ri) => {
				const ci = q.correctMap?.[ri];
				const choiceText = q.choices?.[ci] || "?";
				const slot = slotsWrap.createDiv({ cls: "quiz-slot filled correct" });
				slot.createDiv({ cls: "quiz-slot-label", text: row || `Ligne ${ri}` });
				slot.createDiv({ cls: "quiz-slot-value", text: choiceText });
			});
		}

		if (t === "text") {
			const wrap = card.createDiv({ cls: "qcm-options quiz-text-wrap" });
			const ta = wrap.createEl("textarea", {
				cls: "quiz-textarea correct",
				attr: { readonly: true, "aria-readonly": "true" },
			});
			ta.value = (q.acceptedAnswers || [])[0] || q.placeholder || "";
		}

		if (t === "cmd") {
			const wrap = card.createDiv({ cls: "qcm-options quiz-text-wrap quiz-text-wrap-command" });
			const shell = wrap.createDiv({ cls: "quiz-command-shell quiz-terminal-variant-cmd correct" });
			shell.createSpan({ cls: "quiz-command-prefix", text: q.commandPrefix || "C:\\>" });
			const inputWrap = shell.createDiv({ cls: "quiz-command-input-wrap" });
			const ta = inputWrap.createEl("textarea", {
				cls: "quiz-textarea quiz-textarea-command",
				attr: { readonly: true, rows: "1", wrap: "off" },
			});
			ta.value = (q.acceptedAnswers || [])[0] || "";
		}

		if (t === "powershell") {
			const wrap = card.createDiv({ cls: "qcm-options quiz-text-wrap quiz-text-wrap-command" });
			const shell = wrap.createDiv({ cls: "quiz-command-shell quiz-terminal-variant-powershell correct" });
			shell.createSpan({ cls: "quiz-command-prefix", text: q.commandPrefix || "PS>" });
			const inputWrap = shell.createDiv({ cls: "quiz-command-input-wrap" });
			const ta = inputWrap.createEl("textarea", {
				cls: "quiz-textarea quiz-textarea-command",
				attr: { readonly: true, rows: "1", wrap: "off" },
			});
			ta.value = (q.acceptedAnswers || [])[0] || "";
		}

		if (t === "bash") {
			const wrap = card.createDiv({ cls: "qcm-options quiz-text-wrap quiz-text-wrap-command" });
			const shell = wrap.createDiv({ cls: "quiz-command-shell quiz-terminal-variant-bash correct" });
			const prefixSpan = shell.createSpan({ cls: "quiz-command-prefix quiz-command-prefix-bash" });
			prefixSpan.innerHTML = '<span class="quiz-bash-prefix-userhost">user@hostname</span><span class="quiz-bash-prefix-colon">:</span><span class="quiz-bash-prefix-path">~</span><span class="quiz-bash-prefix-dollar">$ </span>';
			const inputWrap = shell.createDiv({ cls: "quiz-command-input-wrap" });
			const ta = inputWrap.createEl("textarea", {
				cls: "quiz-textarea quiz-textarea-command",
				attr: { readonly: true, rows: "1", wrap: "off" },
			});
			ta.value = (q.acceptedAnswers || [])[0] || "";
		}

		// ─── Hint ─── 
		if (q.hint && q.hint.trim()) {
			const hintBtn = card.createEl("button", { cls: "quiz-hint-btn", text: "Indice", type: "button" });
			hintBtn.addEventListener("click", () => this._openHint(q.hint));
		}

		// ─── Explanation (always visible in builder) ───
		if (q.explain && q.explain.trim()) {
			const explainEl = card.createDiv({ cls: "quiz-explain good" });
			explainEl.innerHTML = this._resolveImagesInHtml(md2html(q.explain));
		}
	}

	/* Resolve image paths in HTML content */
	_resolveImagesInHtml(html) {
		if (!html) return html;
		// Create a temporary element to parse HTML
		const temp = document.createElement('div');
		temp.innerHTML = html;
		// Find all images with qb-md-img class
		temp.querySelectorAll("img.qb-md-img").forEach(img => {
			const fileName = img.getAttribute("src");
			if (fileName) {
				const attachFolder = this.app.vault.getConfig("attachmentFolderPath") || "";
				const folderPath = attachFolder.replace("${file}", "").replace(/\/$/, "") || ".";
				const filePath = folderPath === "." ? fileName : `${folderPath}/${fileName}`;
				const file = this.app.vault.getAbstractFileByPath(filePath);
				if (file) {
					img.src = this.app.vault.adapter.getResourcePath(filePath);
				}
			}
		});
		return temp.innerHTML;
	}

	/* ─── Code ─── */
	renderCode() {
		this.codeOutputEl.textContent = exportAllWithFence(this.questions, this.examOptions);
	}

	/* ═══════════ HINT (same DOM / CSS as engine) ═══════════ */
	_ensureHintOverlay() {
		let overlay = document.getElementById("qb-hint-overlay");
		if (overlay) return overlay;

		overlay = document.createElement("div");
		overlay.id = "qb-hint-overlay";
		overlay.className = "quiz-hint-modal-overlay";
		overlay.innerHTML = `
			<div class="quiz-hint-modal" role="dialog" aria-modal="true">
				<div class="quiz-hint-modal-header">
					<div class="quiz-hint-modal-title">Indice</div>
					<button class="quiz-hint-modal-close" type="button" aria-label="Fermer">×</button>
				</div>
				<div class="quiz-hint-modal-body"></div>
			</div>`;

		overlay.addEventListener("click", e => { if (e.target === overlay) this._closeHint(); });
		const modal = overlay.querySelector(".quiz-hint-modal");
		if (modal) modal.addEventListener("click", e => e.stopPropagation());
		const closeBtn = overlay.querySelector(".quiz-hint-modal-close");
		if (closeBtn) closeBtn.addEventListener("click", e => { e.preventDefault(); this._closeHint(); });

		document.body.appendChild(overlay);

		this._hintEscHandler = e => {
			const o = document.getElementById("qb-hint-overlay");
			if (!o || !o.classList.contains("is-open")) return;
			if (e.key === "Escape") this._closeHint();
		};
		document.addEventListener("keydown", this._hintEscHandler);

		this._applyHintTheme(overlay);
		return overlay;
	}

	_applyHintTheme(overlay) {
		if (!overlay) return;
		const modal = overlay.querySelector(".quiz-hint-modal");
		const header = overlay.querySelector(".quiz-hint-modal-header");
		const title = overlay.querySelector(".quiz-hint-modal-title");
		const bodyEl = overlay.querySelector(".quiz-hint-modal-body");
		const closeBtn = overlay.querySelector(".quiz-hint-modal-close");

		const body = document.body;
		const root = document.documentElement;
		const isLight = body?.classList.contains("theme-light") || root?.classList.contains("theme-light");
		const mode = isLight ? "light" : "dark";
		overlay.dataset.theme = mode;

		const cs = getComputedStyle(body);
		const bgPrimary = cs.getPropertyValue("--background-primary").trim() || (mode === "dark" ? "#111827" : "#ffffff");
		const bgSecondary = cs.getPropertyValue("--background-secondary").trim() || (mode === "dark" ? "#1f2937" : "#f5f6fa");
		const textNormal = cs.getPropertyValue("--text-normal").trim() || (mode === "dark" ? "#e5e7eb" : "#1f2937");
		const border = cs.getPropertyValue("--background-modifier-border").trim() || (mode === "dark" ? "rgba(148,163,184,.25)" : "rgba(31,41,55,.14)");
		const shadow = mode === "dark" ? "0 18px 48px rgba(2,6,23,.45)" : "0 18px 48px rgba(15,23,42,.14)";
		const overlayBg = mode === "dark" ? "rgba(2,6,23,.42)" : "rgba(15,23,42,.16)";

		overlay.style.background = overlayBg;
		if (modal) { modal.style.background = bgPrimary; modal.style.color = textNormal; modal.style.border = `1px solid ${border}`; modal.style.boxShadow = shadow; }
		if (header) { header.style.background = bgSecondary; header.style.borderBottom = `1px solid ${border}`; }
		if (title) title.style.color = textNormal;
		if (bodyEl) bodyEl.style.color = textNormal;
		if (closeBtn) { closeBtn.style.color = textNormal; closeBtn.style.border = `1px solid ${border}`; closeBtn.style.background = mode === "dark" ? "rgba(255,255,255,.06)" : "rgba(15,23,42,.04)"; }
	}

	_openHint(text) {
		const overlay = this._ensureHintOverlay();
		const body = overlay.querySelector(".quiz-hint-modal-body");
		const modal = overlay.querySelector(".quiz-hint-modal");
		if (body) body.innerHTML = this._resolveImagesInHtml(md2html(text));
		this._applyHintTheme(overlay);

		overlay.classList.add("is-open");
		overlay.style.transition = "none";
		overlay.style.opacity = "0";
		if (modal) { modal.style.transition = "none"; modal.style.opacity = "0"; modal.style.transform = "translateY(10px) scale(0.84)"; }
		void overlay.offsetWidth;

		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				overlay.style.transition = "opacity 320ms cubic-bezier(0.22, 1, 0.36, 1)";
				overlay.style.opacity = "1";
				if (modal) {
					modal.style.transition = "transform 420ms cubic-bezier(0.16, 1, 0.3, 1), opacity 320ms cubic-bezier(0.22, 1, 0.36, 1)";
					modal.style.opacity = "1";
					modal.style.transform = "translateY(0) scale(1)";
				}
				const focus = overlay.querySelector(".quiz-hint-modal-close");
				if (focus) setTimeout(() => { try { focus.focus(); } catch (_) {} }, 340);
			});
		});
	}

	_closeHint() {
		const overlay = document.getElementById("qb-hint-overlay");
		if (!overlay || !overlay.classList.contains("is-open")) return;
		const modal = overlay.querySelector(".quiz-hint-modal");

		overlay.style.transition = "opacity 240ms cubic-bezier(0.4, 0, 0.2, 1)";
		overlay.style.opacity = "0";
		if (modal) {
			modal.style.transition = "transform 260ms cubic-bezier(0.4, 0, 0.2, 1), opacity 220ms cubic-bezier(0.4, 0, 0.2, 1)";
			modal.style.opacity = "0";
			modal.style.transform = "translateY(8px) scale(0.94)";
		}
		setTimeout(() => {
			overlay.classList.remove("is-open");
			overlay.style.transition = "";
			overlay.style.opacity = "";
			if (modal) { modal.style.transition = ""; modal.style.opacity = ""; modal.style.transform = ""; }
		}, 300);
	}

	/* ─── Type Modal ─── */
	showTypeModal() {
		const modal = new TypePickerModal(this.app, type => {
			const nq = makeDefault(type);
			nq.title = `Question ${this.questions.length + 1}`;
			this.questions.push(nq);
			this.activeIdx = this.questions.length - 1;
			this.render();
		});
		modal.open();
	}

	openImportModal() {
		new ImportQuizModal(this.app, this).open();
	}

	async importQuizSource(source) {
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

			this.questions = questions;
			this.activeIdx = 0;
			if (examOptions) {
				this.examOptions = examOptions;
			}

			this.render();
			new obsidian.Notice(`${questions.length} question(s) importée(s)`);
		} catch (err) {
			console.error("Import error:", err);
			new obsidian.Notice("Erreur lors de l'import: " + err.message);
		}
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

module.exports = { QuizBuilderView, VIEW_TYPE };
