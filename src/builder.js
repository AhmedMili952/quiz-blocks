'use strict';

const obsidian = require("obsidian");
const { parseQuizSource } = require("./engine");

const VIEW_TYPE = "quiz-blocks-builder";

/* ════════════════════════════════════════════════════════
   TYPES & DEFAULTS
   ════════════════════════════════════════════════════════ */
const Q_TYPES = [
	{ key: "single", label: "Choix unique", lucide: "circle-dot", desc: "Une seule bonne réponse" },
	{ key: "multi", label: "Choix multiple", lucide: "check-square", desc: "Plusieurs bonnes réponses" },
	{ key: "ordering", label: "Classement", lucide: "arrow-up-down", desc: "Ordonner les éléments" },
	{ key: "matching", label: "Association", lucide: "link", desc: "Associer lignes et choix" },
	{ key: "text", label: "Texte libre", lucide: "type", desc: "Textarea classique" },
	{ key: "cmd", label: "Terminal CMD", lucide: "terminal", desc: "Invite de commandes Windows" },
	{ key: "powershell", label: "PowerShell", lucide: "terminal-square", desc: "Terminal PowerShell" },
	{ key: "bash", label: "Terminal Bash", lucide: "terminal", desc: "Terminal Linux/Bash" },
];

function _setIcon(el, name) { try { obsidian.setIcon(el, name); } catch (_) {} }
function _iconSpan(parent, name, cls) { const s = parent.createSpan({ cls: cls || "qb-icon" }); _setIcon(s, name); return s; }

function makeDefault(type) {
	const b = { _type: type, _id: Math.random().toString(36).slice(2, 10), title: "", prompt: "", hint: "", explain: "", resourceButton: null };
	switch (type) {
		case "single": return { ...b, options: ["", ""], correctIndex: 0 };
		case "multi": return { ...b, options: ["", ""], correctIndices: [] };
		case "ordering": return { ...b, slots: ["Étape 1", "Étape 2"], possibilities: ["", ""], correctOrder: [0, 1] };
		case "matching": return { ...b, rows: ["", ""], choices: ["", ""], correctMap: [0, 0] };
		case "text": return { ...b, placeholder: "Votre réponse...", acceptedAnswers: [""], caseSensitive: false };
		case "cmd": return { ...b, placeholder: "", acceptedAnswers: [""], caseSensitive: false, commandPrefix: "C:\\>" };
		case "powershell": return { ...b, placeholder: "", acceptedAnswers: [""], caseSensitive: false, commandPrefix: "PS>" };
		case "bash": return { ...b, placeholder: "", acceptedAnswers: [""], caseSensitive: false };
		default: return b;
	}
}

/* ════════════════════════════════════════════════════════
   MARKDOWN → HTML
   ════════════════════════════════════════════════════════ */
function md2html(src) {
	if (!src) return "";
	return String(src)
		.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
		.replace(/^### (.+)$/gm, "<h3>$1</h3>")
		.replace(/^## (.+)$/gm, "<h2>$1</h2>")
		.replace(/^# (.+)$/gm, "<h1>$1</h1>")
		.replace(/`([^`\n]+)`/g, "<code>$1</code>")
		.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
		.replace(/\*(.+?)\*/g, "<em>$1</em>")
		.replace(/^- (.+)$/gm, "<li>$1</li>")
		.replace(/(<li>.*<\/li>\n?)+/g, m => "<ul>" + m + "</ul>")
		.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
		.replace(/(<blockquote>.*<\/blockquote>\n?)+/g, m => m.replace(/<\/blockquote>\n?<blockquote>/g, "\n"))
		.replace(/```(\w*)\n([\s\S]*?)```/g, (_, l, c) => "<pre><code>" + c.trim() + "</code></pre>")
		.replace(/\n{2,}/g, "</p><p>")
		.replace(/\n/g, "<br>");
}

function escHtml(s) { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }

function esc5(s) { return String(s ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n"); }

/* ════════════════════════════════════════════════════════
   EXPORT → JSON5
   ════════════════════════════════════════════════════════ */
function exportQuestion(q, idx) {
	const id = q.title ? q.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20) : `q${idx + 1}`;
	const e = esc5;
	const L = [];
	L.push("\t{");
	L.push(`\t\tid: '${e(id)}',`);
	L.push(`\t\ttitle: '${e(q.title || `Question ${idx + 1}`)}',`);
	if (q.resourceButton) L.push(`\t\tresourceButton: {\n\t\t\tlabel: '${e(q.resourceButton.label)}',\n\t\t\tfileName: '${e(q.resourceButton.fileName)}',\n\t\t},`);
	const hasMd = q.prompt && (/[*#`>\-]/.test(q.prompt) || q.prompt.includes("\n"));
	if (hasMd) L.push(`\t\tpromptHtml: '${e(md2html(q.prompt))}',`);
	else L.push(`\t\tprompt: '${e(q.prompt)}',`);
	const t = q._type;
	if (t === "single") { L.push(`\t\toptions: [\n${q.options.map(o => `\t\t\t'${e(o)}',`).join("\n")}\n\t\t],`); L.push(`\t\tcorrectIndex: ${q.correctIndex ?? 0},`); }
	if (t === "multi") { L.push(`\t\toptions: [\n${q.options.map(o => `\t\t\t'${e(o)}',`).join("\n")}\n\t\t],`); L.push("\t\tmultiSelect: true,"); L.push(`\t\tcorrectIndices: [${(q.correctIndices || []).join(", ")}],`); }
	if (t === "ordering") { L.push("\t\tordering: true,"); L.push(`\t\tslots: [${(q.slots || []).map(s => `'${e(s)}'`).join(", ")}],`); L.push(`\t\tpossibilities: [\n${(q.possibilities || []).map(p => `\t\t\t'${e(p)}',`).join("\n")}\n\t\t],`); L.push(`\t\tcorrectOrder: [${(q.correctOrder || []).join(", ")}],`); }
	if (t === "matching") { L.push("\t\tmatching: true,"); L.push(`\t\trows: [\n${(q.rows || []).map(r => `\t\t\t'${e(r)}',`).join("\n")}\n\t\t],`); L.push(`\t\tchoices: [\n${(q.choices || []).map(c => `\t\t\t'${e(c)}',`).join("\n")}\n\t\t],`); L.push(`\t\tcorrectMap: [${(q.correctMap || []).join(", ")}],`); }
	if (["text", "cmd", "powershell", "bash"].includes(t)) {
		L.push("\t\ttype: 'text',");
		if (t === "cmd") L.push("\t\tterminalVariant: 'cmd',");
		if (t === "powershell") L.push("\t\ttextVariant: 'powershell',");
		if (t === "bash") L.push("\t\ttextVariant: 'bash',");
		if (q.commandPrefix && (t === "cmd" || t === "powershell")) L.push(`\t\tcommandPrefix: '${e(q.commandPrefix)}',`);
		if (q.placeholder) L.push(`\t\tplaceholder: '${e(q.placeholder)}',`);
		if (q.caseSensitive) L.push("\t\tcaseSensitive: true,");
		L.push(`\t\tacceptedAnswers: [\n${(q.acceptedAnswers || []).filter(Boolean).map(a => `\t\t\t'${e(a)}',`).join("\n")}\n\t\t],`);
	}
	if (q.hint) L.push(`\t\thint: '${e(q.hint)}',`);
	if (q.explain) L.push(`\t\texplainHtml: '${e(md2html(q.explain))}',`);
	L.push("\t}");
	return L.join("\n");
}

function exportAll(questions) { return "[\n" + questions.map((q, i) => exportQuestion(q, i)).join(",\n\n") + "\n]"; }
function exportAllWithFence(questions) { return "```quiz-blocks\n" + exportAll(questions) + "\n```"; }

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
	}

	getViewType() { return VIEW_TYPE; }
	getDisplayText() { return "Quiz Builder"; }
	getIcon() { return "file-question"; }

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
		_setIcon(logo, "file-question");
		const brandText = brand.createDiv();
		brandText.createDiv({ cls: "qb-title", text: "Quiz Builder" });
		brandText.createDiv({ cls: "qb-sub", text: "quiz-blocks" });

		const toggles = header.createDiv({ cls: "qb-toggles" });
		for (const [key, label, lucide] of [["sidebar", "Questions", "list"], ["editor", "Éditeur", "pencil"], ["preview", "Aperçu", "eye"], ["code", "Code", "code"]]) {
			const btn = toggles.createEl("button", { cls: `qb-toggle ${this.panels[key] ? "active" : ""}` });
			btn.dataset.panel = key;
			_iconSpan(btn, lucide, "qb-toggle-icon");
			btn.createSpan({ cls: "qb-toggle-label", text: label });
			btn.addEventListener("click", () => {
				this.panels[key] = !this.panels[key];
				if (!Object.values(this.panels).some(Boolean)) this.panels[key] = true;
				this.syncPanels();
			});
		}

		const actions = header.createDiv({ cls: "qb-actions" });
		this._exportBtn = actions.createEl("button", { cls: "qb-btn qb-btn-accent" });
		_iconSpan(this._exportBtn, "clipboard-copy", "qb-btn-leading-icon");
		this._exportBtn.createSpan({ text: "Exporter" });
		this._exportBtn.addEventListener("click", () => {
			navigator.clipboard.writeText(exportAllWithFence(this.questions)).then(() => {
				this._exportBtn.empty();
				_iconSpan(this._exportBtn, "check", "qb-btn-leading-icon");
				this._exportBtn.createSpan({ text: "Copié !" });
				this._exportBtn.classList.add("qb-btn-ok");
				setTimeout(() => {
					this._exportBtn.empty();
					_iconSpan(this._exportBtn, "clipboard-copy", "qb-btn-leading-icon");
					this._exportBtn.createSpan({ text: "Exporter" });
					this._exportBtn.classList.remove("qb-btn-ok");
				}, 2000);
			});
		});

		const main = root.createDiv({ cls: "qb-main" });
		this.sidebarEl = main.createDiv({ cls: "qb-panel qb-sidebar" });
		this.editorEl = main.createDiv({ cls: "qb-panel qb-editor" });
		this.previewEl = main.createDiv({ cls: "qb-panel qb-preview" });
		this.codeEl = main.createDiv({ cls: "qb-panel qb-code" });

		const sHead = this.sidebarEl.createDiv({ cls: "qb-sidebar-head" });
		this.qCountEl = sHead.createSpan({ text: "Questions (1)" });
		const addBtn = sHead.createEl("button", { cls: "qb-btn-icon" });
		_setIcon(addBtn, "plus");
		addBtn.addEventListener("click", () => this.showTypeModal());
		this.sidebarListEl = this.sidebarEl.createDiv({ cls: "qb-sidebar-list" });

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
		copyBtn.addEventListener("click", () => navigator.clipboard.writeText(exportAllWithFence(this.questions)));
		this.codeOutputEl = this.codeEl.createDiv({ cls: "qb-code-output" });

		this.editorInnerEl = this.editorEl.createDiv({ cls: "qb-editor-inner" });
	}

	syncPanels() {
		const map = { sidebar: this.sidebarEl, editor: this.editorEl, preview: this.previewEl, code: this.codeEl };
		for (const [k, el] of Object.entries(map)) if (el) el.toggleClass("qb-hidden", !this.panels[k]);
		this.contentEl.querySelectorAll(".qb-toggle").forEach(btn => btn.toggleClass("active", !!this.panels[btn.dataset.panel]));
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
		if (this.questions.length <= 1) return;
		this.questions.splice(i, 1);
		this.activeIdx = Math.min(this.activeIdx, this.questions.length - 1);
		this.questions.forEach((qq, idx) => { if (/^Question \d+$/.test(qq.title)) qq.title = `Question ${idx + 1}`; });
		this.render();
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

		this._field(wrap, "Titre", q.title, "Question 1", false, v => { q.title = v; this.renderSidebar(); this.renderCode(); this.schedulePreview(); });
		this._field(wrap, "Énoncé (Markdown)", q.prompt, "Votre question...", true, v => { q.prompt = v; this.renderCode(); this.schedulePreview(); });
		this._resourceSection(wrap, q);

		const box = wrap.createDiv({ cls: "qb-section-box" });
		this._renderTypeFields(box, q);

		this._field(wrap, "Indice", q.hint, "Un indice pour aider...", true, v => { q.hint = v; this.renderCode(); this.schedulePreview(); });
		this._field(wrap, "Explication (Markdown)", q.explain, "### Rappels\n- **Terme** — Définition", true, v => { q.explain = v; this.renderCode(); this.schedulePreview(); });
	}

	_field(parent, label, value, placeholder, multiline, onChange) {
		const wrap = parent.createDiv();
		wrap.createEl("label", { cls: "qb-field-label", text: label });
		if (multiline) {
			const ta = wrap.createEl("textarea", { cls: "qb-field-textarea", placeholder, text: value ?? "" });
			ta.addEventListener("input", () => onChange(ta.value));
		} else {
			const inp = wrap.createEl("input", { cls: "qb-field-input", placeholder, value: value ?? "" });
			inp.addEventListener("input", () => onChange(inp.value));
		}
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
			this._arrayEditor(box, "Options", q.options, () => {
				if (t === "single") q.correctIndex = Math.min(q.correctIndex ?? 0, q.options.length - 1);
				if (t === "multi") q.correctIndices = (q.correctIndices || []).filter(i => i < q.options.length);
				rerender();
			}, "Option", "Ajouter une option");

			box.createDiv().createEl("label", { cls: "qb-field-label", text: t === "single" ? "Bonne réponse" : "Bonnes réponses" });
			const picker = box.createDiv({ cls: "qb-chip-row" });
			q.options.forEach((o, i) => {
				const isSel = t === "single" ? i === q.correctIndex : (q.correctIndices || []).includes(i);
				const chip = picker.createEl("button", { cls: `qb-chip ${isSel ? "correct" : ""}` });
				if (isSel) _iconSpan(chip, "check", "qb-chip-icon");
				chip.createSpan({ text: (o || "...").slice(0, 30) });
				chip.addEventListener("click", () => {
					if (t === "single") q.correctIndex = i;
					else { const a = q.correctIndices || []; if (a.includes(i)) q.correctIndices = a.filter(x => x !== i); else q.correctIndices = [...a, i].sort((a, b) => a - b); }
					this.render();
				});
			});
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
		}

		// ─── Type-specific body ─── 
		if (t === "single" || t === "multi") {
			const isMulti = t === "multi";
			if (isMulti) card.createDiv({ cls: "quiz-multi-indicator", text: "Sélectionnez une ou plusieurs réponses" });

			(q.options || []).forEach((o, i) => {
				const isCorrect = isMulti ? (q.correctIndices || []).includes(i) : i === q.correctIndex;
				const cls = `quiz-option ${isMulti ? "multi" : ""} ${isCorrect ? "correct" : ""}`.trim();
				const opt = card.createDiv({ cls, attr: { role: "button", tabindex: "0" } });
				opt.textContent = o || "...";
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
			explainEl.innerHTML = md2html(q.explain);
		}
	}

	/* ─── Code ─── */
	renderCode() {
		this.codeOutputEl.textContent = exportAllWithFence(this.questions);
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
		if (body) body.innerHTML = md2html(text);
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

module.exports = { QuizBuilderView, VIEW_TYPE };