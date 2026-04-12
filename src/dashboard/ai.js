'use strict';

/* ══════════════════════════════════════════════════════════
   AI VIEW — Dashboard
   Formulaire de génération IA (onglets Sujet/Image/Texte)
   + preview (idle / loading / result / error)
══════════════════════════════════════════════════════════ */

const ANTHROPIC_MODELS = [
	{ value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
	{ value: "claude-opus-4-6", label: "Claude Opus 4.6" },
	{ value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
	{ value: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
	{ value: "claude-opus-4-5-20251101", label: "Claude Opus 4.5" },
	{ value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
	{ value: "claude-opus-4-20250514", label: "Claude Opus 4" }
];

const OLLAMA_MODELS = [
	{ value: "qwen3:14b", label: "Qwen 3 14B" },
	{ value: "qwen3.5:9b", label: "Qwen 3.5 9B" },
	{ value: "qwen3.5:27b", label: "Qwen 3.5 27B" },
	{ value: "deepseek-r1:14b", label: "DeepSeek R1 14B" },
	{ value: "qwen3-coder:30b-a3b", label: "Qwen 3 Coder 30B" },
	{ value: "gemma3:12b", label: "Gemma 3 12B" },
	{ value: "gemma3:27b", label: "Gemma 3 27B" },
	{ value: "llama3.3:70b", label: "Llama 3.3 70B" },
	{ value: "llama4:scout", label: "Llama 4 Scout" },
	{ value: "phi4:14b", label: "Phi-4 14B" },
	{ value: "phi4-mini", label: "Phi-4 Mini" },
	{ value: "mistral-nemo", label: "Mistral Nemo" },
	{ value: "mixtral", label: "Mixtral" },
	{ value: "gemma3:4b", label: "Gemma 3 4B" }
];

function createAiHandlers(ctx) {
	let currentTab = "topic";
	let topicValue = "";
	let textValue = "";
	let questionCount = 5;
	let questionType = "Mixte";
	let images = [];
	let phase = "idle"; // idle | loading | result | error
	let generatedQuestions = [];
	let errorMessage = "";

	const TABS = [
		{ key: "topic", label: "Sujet" },
		{ key: "image", label: "Image" },
		{ key: "text", label: "Texte" }
	];

	const TYPES = ["Mixte", "Choix unique", "Choix multiple", "Texte libre"];

	function canGenerate() {
		return (currentTab === "topic" && topicValue.trim()) ||
			(currentTab === "image" && images.length > 0) ||
			(currentTab === "text" && textValue.trim());
	}

	function render(container) {
		container.empty();

		// ── Layout 2 colonnes ──
		const layout = container.createDiv({ cls: "qbd-ai-layout" });

		// ── Formulaire (colonne gauche) ──
		const formCol = layout.createDiv({ cls: "qbd-ai-form" });

		formCol.createEl("h2", { cls: "qbd-ai-title", text: "Générer un quiz" });

		// ── Provider & Model bar ──
		const provider = ctx.plugin.settings.aiProvider || "anthropic";
		const providerLabels = { anthropic: "Anthropic (Claude)", ollama: "Ollama" };
		const models = provider === "ollama" ? OLLAMA_MODELS : ANTHROPIC_MODELS;
		const currentModel = ctx.plugin.settings.aiModel || models[0].value;

		const modelBar = formCol.createDiv({ cls: "qbd-ai-model-bar" });

		const providerTag = modelBar.createDiv({ cls: "qbd-ai-provider-tag" });
		const providerIcon = providerTag.createSpan({ cls: "qbd-ai-provider-icon" });
		obsidian.setIcon(providerIcon, provider === "anthropic" ? "brain" : "cpu");
		providerTag.createSpan({ text: providerLabels[provider] || provider });

		const modelSelect = modelBar.createEl("select", { cls: "qbd-ai-model-select" });
		for (const m of models) {
			const opt = modelSelect.createEl("option", { text: m.label, value: m.value });
			if (m.value === currentModel) opt.selected = true;
		}
		if (!models.find(m => m.value === currentModel)) {
			const opt = modelSelect.createEl("option", { text: currentModel + " (personnalisé)", value: currentModel });
			opt.selected = true;
		}
		modelSelect.addEventListener("change", async (e) => {
			ctx.plugin.settings.aiModel = e.target.value;
			await ctx.plugin.saveSettings();
		});

		// Onglets source
		const tabsCard = formCol.createDiv({ cls: "qbd-ai-tabs-card" });
		const tabBar = tabsCard.createDiv({ cls: "qbd-ai-tab-bar" });
		for (const tab of TABS) {
			const btn = tabBar.createEl("button", {
				cls: `qbd-ai-tab ${currentTab === tab.key ? "qbd-ai-tab--active" : ""}`
			});
			btn.textContent = tab.label;
			btn.addEventListener("click", () => {
				currentTab = tab.key;
				render(container);
			});
		}

		const tabContent = tabsCard.createDiv({ cls: "qbd-ai-tab-content" });
		let generateBtnRef = null;

		if (currentTab === "topic") {
			const input = tabContent.createEl("input", {
				type: "text",
				cls: "qbd-ai-input",
				placeholder: "La Révolution française, Algorithmes de tri…",
				value: topicValue
			});
			input.addEventListener("input", (e) => {
				topicValue = e.target.value;
				updateGenerateBtn(generateBtnRef);
			});
		} else if (currentTab === "image") {
			renderImageTab(tabContent);
		} else {
			const textarea = tabContent.createEl("textarea", {
				cls: "qbd-ai-textarea",
				placeholder: "Collez le contenu source… La sélection active est pré-remplie automatiquement.",
				value: textValue
			});
			textarea.rows = 4;
			textarea.addEventListener("input", (e) => {
				textValue = e.target.value;
				updateGenerateBtn(generateBtnRef);
			});
		}

		// Options
		const optionsCard = formCol.createDiv({ cls: "qbd-ai-options" });

		// Question count
		const countRow = optionsCard.createDiv({ cls: "qbd-ai-option-row" });
		countRow.createEl("span", { cls: "qbd-ai-option-label", text: "Questions" });
		const rangeInput = countRow.createEl("input", {
			type: "range",
			cls: "qbd-ai-range"
		});
		rangeInput.min = 2;
		rangeInput.max = 20;
		rangeInput.value = String(questionCount);
		const countDisplay = countRow.createEl("span", { cls: "qbd-ai-option-value", text: String(questionCount) });
		rangeInput.addEventListener("input", (e) => {
			questionCount = parseInt(e.target.value);
			countDisplay.textContent = String(questionCount);
		});

		// Question type
		const typeRow = optionsCard.createDiv({ cls: "qbd-ai-option-row" });
		typeRow.createEl("span", { cls: "qbd-ai-option-label", text: "Type" });
		const select = typeRow.createEl("select", { cls: "qbd-ai-select" });
		for (const t of TYPES) {
			const opt = select.createEl("option", { text: t, value: t });
			if (t === questionType) opt.selected = true;
		}
		select.addEventListener("change", (e) => {
			questionType = e.target.value;
		});

		// Generate button
		const canGen = canGenerate();
		const generateBtn = formCol.createEl("button", {
			cls: `qbd-ai-generate-btn ${canGen ? "qbd-ai-generate-btn--active" : ""}`,
			text: "Générer le quiz"
		});
		generateBtnRef = generateBtn;
		if (!canGen) generateBtn.setAttribute("disabled", "");
		const genIcon = generateBtn.createSpan({ cls: "qbd-btn-icon" });
		obsidian.setIcon(genIcon, "sparkles");
		generateBtn.prepend(genIcon);

		generateBtn.addEventListener("click", () => {
			if (!canGenerate()) return;
			startGeneration(container);
		});

		// ── Preview (colonne droite) ──
		const previewCol = layout.createDiv({ cls: "qbd-ai-preview" });
		renderPreview(previewCol);
	}

	function renderImageTab(container) {
		const dropZone = container.createDiv({ cls: "qbd-ai-drop-zone" });
		dropZone.createEl("p", { text: "Glissez des images ici" });
		dropZone.createEl("p", { cls: "qbd-ai-drop-hint", text: "PNG · JPG · WEBP" });

		const fileInput = container.createEl("input", {
			type: "file",
			cls: "qbd-ai-file-input"
		});
		fileInput.accept = "image/*";
		fileInput.multiple = true;

		dropZone.addEventListener("click", () => fileInput.click());
		dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("qbd-ai-drop-zone--hover"); });
		dropZone.addEventListener("dragleave", () => { dropZone.classList.remove("qbd-ai-drop-zone--hover"); });
		dropZone.addEventListener("drop", (e) => {
			e.preventDefault();
			dropZone.classList.remove("qbd-ai-drop-zone--hover");
		});

		if (images.length > 0) {
			const thumbs = container.createDiv({ cls: "qbd-ai-image-thumbs" });
			for (let i = 0; i < images.length; i++) {
				const thumb = thumbs.createDiv({ cls: "qbd-ai-image-thumb" });
				const imgEl = thumb.createEl("img", { cls: "qbd-ai-image-thumb-img" });
				imgEl.src = images[i].url;
				const removeBtn = thumb.createEl("button", { cls: "qbd-ai-image-remove", text: "✕" });
				const idx = i;
				removeBtn.addEventListener("click", () => {
					images.splice(idx, 1);
					render(container.parentElement.parentElement);
				});
			}
		}
	}

	function renderPreview(container) {
		container.empty();

		const label = container.createEl("p", {
			cls: "qbd-ai-preview-label",
			text: phase === "idle" ? "Aperçu" : phase === "loading" ? "Génération en cours…" : phase === "error" ? "Erreur" : "Résultat"
		});

		if (phase === "idle") {
			const empty = container.createDiv({ cls: "qbd-ai-preview-empty" });
			const emptyIcon = empty.createSpan({ cls: "qbd-btn-icon" });
			obsidian.setIcon(emptyIcon, "sparkles");
			empty.createSpan({ text: "Le quiz apparaîtra ici" });
		} else if (phase === "loading") {
			const loader = container.createDiv({ cls: "qbd-ai-preview-loading" });
			const iconWrap = loader.createDiv({ cls: "qbd-ai-loading-icon" });
			obsidian.setIcon(iconWrap, "sparkles");
			loader.createEl("p", { cls: "qbd-ai-loading-title", text: "Quiz en cours de création…" });
			loader.createEl("p", { cls: "qbd-ai-loading-sub", text: "Cela ne prendra qu'un instant." });

			const dots = loader.createDiv({ cls: "qbd-ai-loading-dots" });
			for (let i = 0; i < 3; i++) {
				dots.createDiv({ cls: "qbd-ai-loading-dot" });
			}
		} else if (phase === "error") {
			const errorEl = container.createDiv({ cls: "qbd-ai-preview-error" });
			const errorIcon = errorEl.createSpan({ cls: "qbd-btn-icon" });
			obsidian.setIcon(errorIcon, "alert-triangle");
			errorEl.createEl("p", { cls: "qbd-ai-error-title", text: "Échec de la génération" });
			errorEl.createEl("p", { cls: "qbd-ai-error-msg", text: errorMessage });

			const retryBtn = errorEl.createEl("button", {
				cls: "qbd-btn qbd-btn--ghost",
				text: "Réessayer"
			});
			retryBtn.addEventListener("click", () => {
				phase = "idle";
				render(container.parentElement.parentElement);
			});
		} else if (phase === "result") {
			const header = container.createDiv({ cls: "qbd-ai-result-header" });
			header.createEl("span", { cls: "qbd-ai-result-count", text: `✓ ${generatedQuestions.length} questions générées` });

			const restartBtn = header.createEl("button", { cls: "qbd-btn qbd-btn--ghost", text: "↺ Recommencer" });
			restartBtn.addEventListener("click", () => {
				phase = "idle";
				generatedQuestions = [];
				topicValue = "";
				textValue = "";
				images = [];
				render(container.parentElement.parentElement);
			});

			for (let i = 0; i < generatedQuestions.length; i++) {
				const q = generatedQuestions[i];
				const item = container.createDiv({ cls: "qbd-ai-result-item" });
				const num = item.createDiv({ cls: "qbd-ai-result-num" });
				num.textContent = String(i + 1);
				item.createSpan({ cls: "qbd-ai-result-text", text: q.title || q.prompt || `Question ${i + 1}` });
				item.createSpan({ cls: "qbd-ai-result-type-badge", text: q.type || "Choix unique" });
			}

			// Action buttons
			const actions = container.createDiv({ cls: "qbd-ai-result-actions" });
			const insertBtn = actions.createEl("button", {
				cls: "qbd-btn qbd-btn--primary",
				text: "Insérer dans la note"
			});
			insertBtn.addEventListener("click", () => insertIntoNote());

			const editBtn = actions.createEl("button", {
				cls: "qbd-btn qbd-btn--ghost",
				text: "Ouvrir dans l'éditeur"
			});
			editBtn.addEventListener("click", () => openInEditor());
		}
	}

	function updateGenerateBtn(btn) {
		if (!btn) return;
		const canGen = canGenerate();

		if (canGen) {
			btn.classList.add("qbd-ai-generate-btn--active");
			btn.removeAttribute("disabled");
		} else {
			btn.classList.remove("qbd-ai-generate-btn--active");
			btn.setAttribute("disabled", "");
		}
	}

	async function startGeneration(container) {
		phase = "loading";
		errorMessage = "";
		render(container);

		try {
			const aiClient = require("./ai-client");
			const client = aiClient(ctx.plugin);

			const prompt = currentTab === "topic" ? topicValue
				: currentTab === "text" ? textValue
				: "Analyse les images fournies";

			generatedQuestions = await client.generate(prompt, {
				count: questionCount,
				type: questionType,
				source: currentTab
			});
		} catch (err) {
			errorMessage = err.message || "Vérifiez vos paramètres IA dans les paramètres du plugin.";
			generatedQuestions = [];
		}

		phase = generatedQuestions.length > 0 ? "result" : "error";
		render(container);
	}

	async function insertIntoNote() {
		if (generatedQuestions.length === 0) return;

		const activeFile = ctx.app.workspace.getActiveFile();
		if (!activeFile) {
			new obsidian.Notice("Aucune note active");
			return;
		}

		try {
			const JSON5 = require("json5");
			let content = await ctx.app.vault.read(activeFile);

			const quizBlock = "```quiz-blocks\n" + JSON5.stringify(generatedQuestions, null, 2) + "\n```";

			// Vérifier s'il y a déjà un bloc quiz-blocks
			if (content.includes("```quiz-blocks")) {
				new obsidian.Notice("Un bloc quiz-blocks existe déjà dans cette note. Ouvrez l'éditeur pour le modifier.");
				return;
			}

			content += "\n\n" + quizBlock;
			await ctx.app.vault.modify(activeFile, content);
			new obsidian.Notice("Quiz inséré dans la note");
		} catch (err) {
			new obsidian.Notice("Erreur lors de l'insertion");
		}
	}

	async function openInEditor() {
		if (generatedQuestions.length === 0) return;
		const activeFile = ctx.app.workspace.getActiveFile();
		if (!activeFile) {
			new obsidian.Notice("Aucune note active");
			return;
		}

		try {
			const { QuizBuilderView, VIEW_TYPE } = require("../editor");
			const existing = ctx.app.workspace.getLeavesOfType(VIEW_TYPE);
			let leaf;
			if (existing.length > 0) {
				leaf = existing[0];
				ctx.app.workspace.revealLeaf(leaf);
			} else {
				leaf = ctx.app.workspace.getLeaf("tab");
				await leaf.setViewState({ type: VIEW_TYPE, active: true });
				ctx.app.workspace.revealLeaf(leaf);
			}

			const JSON5 = require("json5");
			const source = JSON5.stringify(generatedQuestions, null, 2);
			const view = leaf.view;
			if (view && view.openQuizFile) {
				await view.openQuizFile(activeFile, source);
			}
		} catch (err) {
			new obsidian.Notice("Erreur lors de l'ouverture dans l'éditeur");
		}
	}

	return { render };
}

const obsidian = require("obsidian");
module.exports = createAiHandlers;