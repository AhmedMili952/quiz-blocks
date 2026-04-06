'use strict';

const obsidian = require("obsidian");
const { ConfirmModal } = require("./modals");

module.exports = function createSidebarHandlers(ctx) {
	const { Q_TYPES, _setIcon } = ctx;
	const view = ctx.view;

	function renderSidebar() {
		const list = view.sidebarListEl;
		list.empty();
		view.qCountEl.textContent = `Questions (${ctx.questions.length})`;

		ctx.questions.forEach((q, i) => {
			const ti = Q_TYPES.find(t => t.key === q._type) || Q_TYPES[0];
			const item = list.createDiv({ cls: `qb-q-item ${i === ctx.activeIdx ? "active" : ""}` });
			const qIcon = item.createDiv({ cls: "qb-q-icon" });
			_setIcon(qIcon, ti.lucide);
			const text = item.createDiv({ cls: "qb-q-text" });
			text.createDiv({ cls: "qb-q-title", text: q.title || `Question ${i + 1}` });
			text.createDiv({ cls: "qb-q-type", text: ti.label });

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
				ctx.activeIdx = i;
				view.render();
			});
			up.addEventListener("click", () => moveQuestion(i, -1));
			down.addEventListener("click", () => moveQuestion(i, 1));
			del.addEventListener("click", () => deleteQuestion(i));
		});
	}

	function moveQuestion(i, dir) {
		const ni = i + dir;
		if (ni < 0 || ni >= ctx.questions.length) return;
		[ctx.questions[i], ctx.questions[ni]] = [ctx.questions[ni], ctx.questions[i]];
		if (ctx.activeIdx === i) ctx.activeIdx = ni;
		else if (ctx.activeIdx === ni) ctx.activeIdx = i;
		ctx.questions.forEach((qq, idx) => { if (/^Question \d+$/.test(qq.title)) qq.title = `Question ${idx + 1}`; });
		view.render();
	}

	function deleteQuestion(i) {
		if (ctx.questions.length <= 1) {
			new obsidian.Notice("Impossible de supprimer la dernière question");
			return;
		}

		const q = ctx.questions[i];
		const title = q.title || `Question ${i + 1}`;

		const modal = new ConfirmModal(view.app,
			`Supprimer "${title}" ?`,
			`Cette action est irréversible. La question sera définitivement supprimée.`,
			"Supprimer",
			"Annuler",
			(confirmed) => {
				if (confirmed) {
					ctx.questions.splice(i, 1);
					ctx.activeIdx = Math.min(ctx.activeIdx, ctx.questions.length - 1);
					ctx.questions.forEach((qq, idx) => { if (/^Question \d+$/.test(qq.title)) qq.title = `Question ${idx + 1}`; });
					view.render();
					new obsidian.Notice(`Question "${title}" supprimée`);
				}
			}
		);
		modal.open();
	}

	return {
		renderSidebar,
		moveQuestion,
		deleteQuestion
	};
};
