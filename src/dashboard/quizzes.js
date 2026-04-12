'use strict';

/* ══════════════════════════════════════════════════════════
   QUIZZES VIEW — Dashboard
   Header + search + filtres + grid de QuizCards
══════════════════════════════════════════════════════════ */

function createQuizzesHandlers(ctx) {
	let currentFilter = "Tous";
	let searchQuery = "";

	const FILTERS = ["Tous", "En cours", "Maîtrisés", "Non commencés"];

	function render(container) {
		container.empty();

		const quizzes = ctx.scanner ? ctx.scanner.getQuizzes() : [];
		const stats = ctx.statsStore ? ctx.statsStore.getAll() : {};

		// ── Header ──
		const header = container.createDiv({ cls: "qbd-quizzes-header" });
		header.createEl("h2", { cls: "qbd-quizzes-title", text: "Mes quiz" });

		const newBtn = header.createEl("button", { cls: "qbd-btn qbd-btn--ghost" });
		const newIcon = newBtn.createSpan({ cls: "qbd-btn-icon" });
		obsidian.setIcon(newIcon, "plus");
		newBtn.createSpan({ text: "Nouveau" });
		newBtn.addEventListener("click", async () => {
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
		});

		// ── Search ──
		const searchWrap = container.createDiv({ cls: "qbd-quizzes-search" });
		const searchIcon = searchWrap.createSpan({ cls: "qbd-quizzes-search-icon" });
		obsidian.setIcon(searchIcon, "search");

		const searchInput = searchWrap.createEl("input", {
			type: "text",
			placeholder: "Rechercher…",
			cls: "qbd-quizzes-search-input"
		});
		searchInput.value = searchQuery;
		searchInput.addEventListener("input", (e) => {
			searchQuery = e.target.value;
			renderQuizGrid(gridEl, quizzes, stats);
		});

		// ── Filters ──
		const filterBar = container.createDiv({ cls: "qbd-quizzes-filters" });
		for (const filter of FILTERS) {
			const btn = filterBar.createEl("button", {
				cls: `qbd-filter-pill ${currentFilter === filter ? "qbd-filter-pill--active" : ""}`,
				text: filter
			});
			btn.addEventListener("click", () => {
				currentFilter = filter;
				render(container);
			});
		}

		// ── Grid ──
		const gridEl = container.createDiv({ cls: "qbd-home-grid" });
		renderQuizGrid(gridEl, quizzes, stats);
	}

	function renderQuizGrid(gridEl, quizzes, stats) {
		gridEl.empty();

		const filtered = quizzes.filter(q => {
			// Search filter
			if (searchQuery && !q.title.toLowerCase().includes(searchQuery.toLowerCase()) && !q.path.toLowerCase().includes(searchQuery.toLowerCase())) {
				return false;
			}

			const s = stats[q.path];
			if (currentFilter === "En cours") return s && s.questionsDone > 0 && s.questionsDone < q.questions;
			if (currentFilter === "Maîtrisés") return s && s.bestScore >= 80;
			if (currentFilter === "Non commencés") return !s || s.questionsDone === 0;
			return true;
		});

		if (filtered.length === 0) {
			gridEl.createDiv({ cls: "qbd-empty-state" }, el => {
				el.createEl("p", { text: "Aucun quiz trouvé" });
			});
			return;
		}

		for (const quiz of filtered) {
			renderQuizCardInline(gridEl, quiz, stats[quiz.path]);
		}
	}

	function renderQuizCardInline(container, quiz, stats) {
		const card = container.createDiv({ cls: "qbd-quiz-card" });

		card.createDiv({ cls: "qbd-quiz-card-accent" });
		const body = card.createDiv({ cls: "qbd-quiz-card-body" });
		body.createEl("p", { cls: "qbd-quiz-card-title", text: quiz.title });

		const pathEl = body.createEl("p", { cls: "qbd-quiz-card-path" });
		pathEl.createSpan({ text: quiz.path });

		const progressWrapper = body.createDiv({ cls: "qbd-quiz-card-progress-wrap" });
		const progressBg = progressWrapper.createDiv({ cls: "qbd-quiz-card-progress-bg" });
		const pct = stats && stats.totalQuestions > 0
			? Math.round(stats.questionsDone / stats.totalQuestions * 100)
			: 0;
		const progressFill = progressBg.createDiv({ cls: "qbd-quiz-card-progress-fill" });
		progressFill.style.width = `${pct}%`;

		const meta = body.createDiv({ cls: "qbd-quiz-card-meta" });
		meta.createEl("span", { cls: "qbd-quiz-card-meta-item", text: `${quiz.questions} questions` });
		meta.createEl("span", { cls: "qbd-quiz-card-badge", text: quiz.quizType });

		if (stats && stats.bestScore > 0) {
			const scoreRow = card.createDiv({ cls: "qbd-quiz-card-score-row" });
			scoreRow.createEl("span", { text: `${quiz.questions} questions`, cls: "qbd-quiz-card-meta-item" });
			const scoreValue = stats.bestScore;
			const scoreColor = scoreValue >= 80 ? "var(--color-green, #4ade80)"
				: scoreValue >= 60 ? "var(--color-yellow, #facc15)"
				: "var(--color-red, #f87171)";
			const scoreSpan = scoreRow.createEl("span", { cls: "qbd-quiz-card-score-value" });
			scoreSpan.style.color = scoreColor;
			scoreSpan.textContent = `Meilleur : ${scoreValue}%`;
		}

		card.addEventListener("click", () => {
			ctx.navigate("detail", { quiz });
		});
	}

	return { render };
}

const obsidian = require("obsidian");
module.exports = createQuizzesHandlers;