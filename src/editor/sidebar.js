'use strict';

module.exports = function createSidebarHandlers(ctx) {
	const { _setIcon, Q_TYPES, ConfirmModal, TypePickerModal } = ctx;
	const view = ctx.view;

	function _renderSidebar() {
		if (!view.sidebarListEl) return;
		view.sidebarListEl.empty();

		if (view.qCountEl) {
			view.qCountEl.textContent = `Questions (${ctx.questions.length})`;
		}

		ctx.questions.forEach((q, idx) => {
			const row = view.sidebarListEl.createEl("button", { cls: "qb-q-item" });
			if (idx === ctx.activeIdx) row.classList.add("active");

			const icon = row.createSpan({ cls: "qb-q-icon" });
			const typeIcon = { single: "○", multi: "☐", text: "T", ordering: "⇅", matching: "⇄" }[q.type] || "?";
			icon.textContent = typeIcon;

			const title = row.createSpan({ cls: "qb-q-title" });
			title.textContent = q.title || `Question ${idx + 1}`;

			row.addEventListener("click", () => {
				ctx.activeIdx = idx;
				view.render();
			});

			const actions = row.createSpan({ cls: "qb-q-actions" });

			const dupBtn = actions.createEl("button", { cls: "qb-btn-icon qb-btn-icon-small", attr: { title: "Dupliquer" } });
			_setIcon(dupBtn, "copy");
			dupBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				duplicateQuestion(idx);
			});

			const delBtn = actions.createEl("button", { cls: "qb-btn-icon qb-btn-icon-small", attr: { title: "Supprimer" } });
			_setIcon(delBtn, "trash-2");
			delBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				deleteQuestion(idx);
			});

			if (idx > 0) {
				const upBtn = actions.createEl("button", { cls: "qb-btn-icon qb-btn-icon-small", attr: { title: "Monter" } });
				_setIcon(upBtn, "arrow-up");
				upBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					moveQuestion(idx, idx - 1);
				});
			}

			if (idx < ctx.questions.length - 1) {
				const downBtn = actions.createEl("button", { cls: "qb-btn-icon qb-btn-icon-small", attr: { title: "Descendre" } });
				_setIcon(downBtn, "arrow-down");
				downBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					moveQuestion(idx, idx + 1);
				});
			}
		});
	}

	function showTypeModal() {
		new TypePickerModal(view.app, (type) => {
			addQuestion(type);
		}).open();
	}

	function addQuestion(type) {
		const defaults = {
			single: { type: "single", title: "", code: "", options: [{ id: "a", label: "Option A" }, { id: "b", label: "Option B" }], answer: "a", hint: "", explain: "" },
			multi: { type: "multi", title: "", code: "", options: [{ id: "a", label: "Option A" }, { id: "b", label: "Option B" }], answers: [], hint: "", explain: "" },
			text: { type: "text", title: "", code: "", acceptedAnswers: [""], hint: "", explain: "" },
			ordering: { type: "ordering", title: "", code: "", items: [{ id: "1", label: "Item 1" }, { id: "2", label: "Item 2" }], order: ["1", "2"], hint: "", explain: "" },
			matching: { type: "matching", title: "", code: "", pairs: [{ id: "1", left: "A", right: "1" }, { id: "2", left: "B", right: "2" }], hint: "", explain: "" }
		};
		const newQ = JSON.parse(JSON.stringify(defaults[type] || defaults.single));
		newQ.title = `Question ${ctx.questions.length + 1}`;
		ctx.questions.push(newQ);
		ctx.activeIdx = ctx.questions.length - 1;
		view.render();
	}

	function duplicateQuestion(idx) {
		const q = JSON.parse(JSON.stringify(ctx.questions[idx]));
		q.title = `${q.title || `Question ${idx + 1}`} (copie)`;
		ctx.questions.splice(idx + 1, 0, q);
		ctx.activeIdx = idx + 1;
		view.render();
	}

	function deleteQuestion(idx) {
		new ConfirmModal(view.app, `Supprimer la question ${idx + 1} ?`, () => {
			ctx.questions.splice(idx, 1);
			if (ctx.questions.length === 0) {
				addQuestion('single');
			}
			ctx.activeIdx = Math.max(0, Math.min(ctx.activeIdx, ctx.questions.length - 1));
			view.render();
		}).open();
	}

	function moveQuestion(fromIdx, toIdx) {
		if (toIdx < 0 || toIdx >= ctx.questions.length) return;
		const [q] = ctx.questions.splice(fromIdx, 1);
		ctx.questions.splice(toIdx, 0, q);
		ctx.activeIdx = toIdx;
		view.render();
	}

	return {
		_renderSidebar,
		showTypeModal,
		addQuestion,
		duplicateQuestion,
		deleteQuestion,
		moveQuestion
	};
};
