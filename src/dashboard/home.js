'use strict';

/* ══════════════════════════════════════════════════════════
   HOME VIEW — Dashboard
   Header + stats grid + sections "À reprendre" / "Complétés"
══════════════════════════════════════════════════════════ */

function createHomeHandlers(ctx) {

	function render(container) {
		container.empty();

		const quizzes = ctx.scanner ? ctx.scanner.getQuizzes() : [];
		const stats = ctx.statsStore ? ctx.statsStore.getAll() : {};

		// ── Header ──
		const header = container.createDiv({ cls: "qbd-home-header" });
		const headerLeft = header.createDiv({ cls: "qbd-home-header-left" });
		headerLeft.createEl("h2", { cls: "qbd-home-title", text: "Quiz Blocks" });

		const activeFile = ctx.getActiveFile();
		const noteText = activeFile ? activeFile.path : "Aucune note active";
		headerLeft.createEl("p", { cls: "qbd-home-subtitle" });
		headerLeft.lastChild.createSpan({ text: "Note active : " });
		headerLeft.lastChild.createEl("code", { text: noteText });

		const genBtn = header.createEl("button", { cls: "qbd-btn qbd-btn--primary" });
		const genIcon = genBtn.createSpan({ cls: "qbd-btn-icon" });
		obsidian.setIcon(genIcon, "sparkles");
		genBtn.createSpan({ text: "Générer un quiz" });
		genBtn.addEventListener("click", () => ctx.navigate("ai"));

		// ── Stats grid ──
		const statsGrid = container.createDiv({ cls: "qbd-home-stats" });

		const totalQuestions = ctx.scanner ? ctx.scanner.getTotalQuestions() : 0;
		const mastered = quizzes.filter(q => {
			const s = stats[q.path];
			return s && s.bestScore >= 80;
		}).length;

		const statCards = [
			{ label: "Quiz créés", value: String(quizzes.length), sub: "dans le vault" },
			{ label: "Questions totales", value: String(totalQuestions), sub: "toutes notes" },
			{ label: "Maîtrisés", value: `${mastered}/${quizzes.length}`, sub: "score ≥ 80%" }
		];

		for (const card of statCards) {
			const el = statsGrid.createDiv({ cls: "qbd-stat-card" });
			el.createEl("p", { cls: "qbd-stat-value", text: card.value });
			el.createEl("p", { cls: "qbd-stat-label", text: card.label });
			el.createEl("p", { cls: "qbd-stat-sub", text: card.sub });
		}

		// ── Sections de quiz ──
		const inProgress = quizzes.filter(q => {
			const s = stats[q.path];
			return s && s.questionsDone > 0 && s.questionsDone < q.questions;
		});
		const notStarted = quizzes.filter(q => {
			const s = stats[q.path];
			return !s || s.questionsDone === 0;
		});
		const completed = quizzes.filter(q => {
			const s = stats[q.path];
			return s && s.questionsDone >= q.questions;
		});

		// À reprendre (incomplets)
		if (inProgress.length > 0 || notStarted.length > 0) {
			const section = container.createDiv({ cls: "qbd-home-section" });
			const sectionHeader = section.createDiv({ cls: "qbd-home-section-header" });
			sectionHeader.createEl("p", { cls: "qbd-home-section-title", text: "À reprendre" });

			const seeAll = sectionHeader.createEl("button", { cls: "qbd-btn qbd-btn--subtle" });
			seeAll.createSpan({ text: "Voir tout" });
			const chevron = seeAll.createSpan({ cls: "qbd-btn-icon qbd-btn-icon--sm" });
			obsidian.setIcon(chevron, "chevron-right");
			seeAll.addEventListener("click", () => ctx.navigate("quizzes"));

			const grid = section.createDiv({ cls: "qbd-home-grid" });
			for (const quiz of [...inProgress, ...notStarted]) {
				renderQuizCard(grid, quiz, stats[quiz.path]);
			}
		}

		// Complétés
		if (completed.length > 0) {
			const section = container.createDiv({ cls: "qbd-home-section" });
			section.createEl("p", { cls: "qbd-home-section-title", text: "Complétés ✓" });

			const grid = section.createDiv({ cls: "qbd-home-grid" });
			for (const quiz of completed) {
				renderQuizCard(grid, quiz, stats[quiz.path]);
			}
		}

		// Empty state
		if (quizzes.length === 0) {
			const empty = container.createDiv({ cls: "qbd-empty-state" });
			empty.createEl("p", { text: "Aucun quiz trouvé dans le vault." });
			empty.createEl("p", { text: "Créez un bloc ```quiz-blocks dans une note pour commencer.", cls: "qbd-empty-hint" });
		}
	}

	function renderQuizCard(container, quiz, stats) {
		const card = container.createDiv({ cls: "qbd-quiz-card" });
		card.dataset.path = quiz.path;

		// Accent bar
		card.createDiv({ cls: "qbd-quiz-card-accent" });

		const body = card.createDiv({ cls: "qbd-quiz-card-body" });

		// Title
		body.createEl("p", { cls: "qbd-quiz-card-title", text: quiz.title });

		// Path
		const pathEl = body.createEl("p", { cls: "qbd-quiz-card-path" });
		pathEl.createSpan({ text: quiz.path });

		// Progress bar
		const progressWrapper = body.createDiv({ cls: "qbd-quiz-card-progress-wrap" });
		const progressBg = progressWrapper.createDiv({ cls: "qbd-quiz-card-progress-bg" });
		const pct = stats && stats.totalQuestions > 0
			? Math.round(stats.questionsDone / stats.totalQuestions * 100)
			: 0;
		const progressFill = progressBg.createDiv({ cls: "qbd-quiz-card-progress-fill" });
		progressFill.style.width = `${pct}%`;

		// Meta row
		const meta = body.createDiv({ cls: "qbd-quiz-card-meta" });
		meta.createEl("span", { cls: "qbd-quiz-card-meta-item", text: `${quiz.questions} questions` });
		const badge = meta.createEl("span", { cls: "qbd-quiz-card-badge" });
		badge.textContent = quiz.quizType;

		// Ring + score (si joué)
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

		// Click handler
		card.addEventListener("click", () => {
			ctx.navigate("detail", { quiz });
		});

		return card;
	}

	return { render };
}

const obsidian = require("obsidian");
module.exports = createHomeHandlers;