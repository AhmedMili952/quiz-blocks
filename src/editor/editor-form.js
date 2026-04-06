'use strict';

module.exports = function createEditorFormHandlers(ctx) {
	const { escHtml, md2html } = ctx;
	const view = ctx.view;

	function _renderEditor() {
		if (!view.editorEl) return;
		view.editorEl.empty();

		const q = ctx.activeQuestion;
		if (!q) return;

		const tabs = view.editorEl.createDiv({ cls: "qb-editor-tabs" });
		const contents = view.editorEl.createDiv({ cls: "qb-editor-contents" });

		const tabSpecs = [
			{ key: 'content', label: 'Contenu' },
			{ key: 'options', label: 'Options' },
			{ key: 'settings', label: 'Paramètres' }
		];

		tabSpecs.forEach(spec => {
			const btn = tabs.createEl("button", { cls: "qb-editor-tab" });
			btn.textContent = spec.label;
			if (ctx.activeEditorTab === spec.key) btn.classList.add("active");
			btn.addEventListener("click", () => {
				ctx.activeEditorTab = spec.key;
				view.render();
			});
		});

		const content = contents.createDiv({ cls: "qb-editor-content" });

		if (ctx.activeEditorTab === 'content') {
			_bindBasicField(content, q);
		} else if (ctx.activeEditorTab === 'options') {
			if (q.type === 'single') _bindOptionsEditor(content, q);
			else if (q.type === 'multi') _bindMultiSelectEditor(content, q);
			else if (q.type === 'ordering') _bindOrderingEditor(content, q);
			else if (q.type === 'matching') _bindMatchingEditor(content, q);
			else if (q.type === 'text') _bindTextEditor(content, q);
		} else if (ctx.activeEditorTab === 'settings') {
			_bindSettingsEditor(content, q);
		}
	}

	function _bindBasicField(container, q) {
		const titleWrap = container.createDiv({ cls: "qb-field" });
		titleWrap.createEl("label", { cls: "qb-field-label", text: "Titre" });
		const titleInput = titleWrap.createEl("input", { cls: "qb-field-input", type: "text", value: q.title || "" });
		titleInput.addEventListener("input", () => {
			q.title = titleInput.value;
			view.renderPreview();
			view._renderSidebar();
		});

		const codeWrap = container.createDiv({ cls: "qb-field" });
		codeWrap.createEl("label", { cls: "qb-field-label", text: "Code (optionnel)" });
		const codeInput = codeWrap.createEl("textarea", { cls: "qb-field-textarea" });
		codeInput.value = q.code || "";
		codeInput.addEventListener("input", () => {
			q.code = codeInput.value;
			view.renderPreview();
		});

		const hintWrap = container.createDiv({ cls: "qb-field" });
		hintWrap.createEl("label", { cls: "qb-field-label", text: "Indice (optionnel)" });
		const hintInput = hintWrap.createEl("textarea", { cls: "qb-field-textarea" });
		hintInput.value = q.hint || "";
		hintInput.addEventListener("input", () => {
			q.hint = hintInput.value;
			view.renderPreview();
		});

		const explainWrap = container.createDiv({ cls: "qb-field" });
		explainWrap.createEl("label", { cls: "qb-field-label", text: "Explication (optionnel)" });
		const explainInput = explainWrap.createEl("textarea", { cls: "qb-field-textarea" });
		explainInput.value = q.explain || "";
		explainInput.addEventListener("input", () => {
			q.explain = explainInput.value;
			view.renderPreview();
		});
	}

	function _bindOptionsEditor(container, q) {
		container.createEl("h4", { text: "Options" });
		const list = container.createDiv({ cls: "qb-options-list" });

		const renderOptions = () => {
			list.empty();
			q.options.forEach((opt, idx) => {
				const row = list.createDiv({ cls: "qb-option-row" });

				const correctBtn = row.createEl("button", { cls: `qb-btn-icon ${q.answer === opt.id ? 'is-correct' : ''}` });
				correctBtn.textContent = q.answer === opt.id ? "●" : "○";
				correctBtn.addEventListener("click", () => {
					q.answer = opt.id;
					renderOptions();
					view.renderPreview();
				});

				const labelInput = row.createEl("input", { cls: "qb-field-input", type: "text", value: opt.label });
				labelInput.addEventListener("input", () => {
					opt.label = labelInput.value;
					view.renderPreview();
				});

				const delBtn = row.createEl("button", { cls: "qb-btn-icon" });
				delBtn.textContent = "×";
				delBtn.addEventListener("click", () => {
					q.options.splice(idx, 1);
					if (q.answer === opt.id) q.answer = q.options[0]?.id || "";
					renderOptions();
					view.renderPreview();
				});
			});
		};

		renderOptions();

		const addBtn = container.createEl("button", { cls: "qb-btn" });
		addBtn.textContent = "Ajouter une option";
		addBtn.addEventListener("click", () => {
			const newId = String.fromCharCode(97 + q.options.length);
			q.options.push({ id: newId, label: `Option ${newId.toUpperCase()}` });
			renderOptions();
			view.renderPreview();
		});
	}

	function _bindMultiSelectEditor(container, q) {
		container.createEl("h4", { text: "Options (sélection multiple)" });
		const list = container.createDiv({ cls: "qb-options-list" });

		const renderOptions = () => {
			list.empty();
			q.options.forEach((opt, idx) => {
				const row = list.createDiv({ cls: "qb-option-row" });

				const correctBtn = row.createEl("button", { cls: `qb-btn-icon ${(q.answers || []).includes(opt.id) ? 'is-correct' : ''}` });
				correctBtn.textContent = (q.answers || []).includes(opt.id) ? "☑" : "☐";
				correctBtn.addEventListener("click", () => {
					if (!q.answers) q.answers = [];
					if (q.answers.includes(opt.id)) {
						q.answers = q.answers.filter(id => id !== opt.id);
					} else {
						q.answers.push(opt.id);
					}
					renderOptions();
					view.renderPreview();
				});

				const labelInput = row.createEl("input", { cls: "qb-field-input", type: "text", value: opt.label });
				labelInput.addEventListener("input", () => {
					opt.label = labelInput.value;
					view.renderPreview();
				});

				const delBtn = row.createEl("button", { cls: "qb-btn-icon" });
				delBtn.textContent = "×";
				delBtn.addEventListener("click", () => {
					q.options.splice(idx, 1);
					q.answers = (q.answers || []).filter(id => id !== opt.id);
					renderOptions();
					view.renderPreview();
				});
			});
		};

		renderOptions();

		const addBtn = container.createEl("button", { cls: "qb-btn" });
		addBtn.textContent = "Ajouter une option";
		addBtn.addEventListener("click", () => {
			const newId = String.fromCharCode(97 + q.options.length);
			q.options.push({ id: newId, label: `Option ${newId.toUpperCase()}` });
			renderOptions();
			view.renderPreview();
		});
	}

	function _bindOrderingEditor(container, q) {
		container.createEl("h4", { text: "Items à ordonner" });
		const list = container.createDiv({ cls: "qb-options-list" });

		const renderItems = () => {
			list.empty();
			q.items.forEach((item, idx) => {
				const row = list.createDiv({ cls: "qb-option-row" });

				const labelInput = row.createEl("input", { cls: "qb-field-input", type: "text", value: item.label });
				labelInput.addEventListener("input", () => {
					item.label = labelInput.value;
					view.renderPreview();
				});

				const upBtn = row.createEl("button", { cls: "qb-btn-icon", attr: { title: "Monter" } });
				upBtn.textContent = "↑";
				upBtn.disabled = idx === 0;
				upBtn.addEventListener("click", () => {
					if (idx > 0) {
						[q.items[idx], q.items[idx - 1]] = [q.items[idx - 1], q.items[idx]];
						renderItems();
						view.renderPreview();
					}
				});

				const downBtn = row.createEl("button", { cls: "qb-btn-icon", attr: { title: "Descendre" } });
				downBtn.textContent = "↓";
				downBtn.disabled = idx === q.items.length - 1;
				downBtn.addEventListener("click", () => {
					if (idx < q.items.length - 1) {
						[q.items[idx], q.items[idx + 1]] = [q.items[idx + 1], q.items[idx]];
						renderItems();
						view.renderPreview();
					}
				});

				const delBtn = row.createEl("button", { cls: "qb-btn-icon" });
				delBtn.textContent = "×";
				delBtn.addEventListener("click", () => {
					q.items.splice(idx, 1);
					q.order = q.items.map(i => i.id);
					renderItems();
					view.renderPreview();
				});
			});
		};

		renderItems();

		const addBtn = container.createEl("button", { cls: "qb-btn" });
		addBtn.textContent = "Ajouter un item";
		addBtn.addEventListener("click", () => {
			const newId = String(q.items.length + 1);
			q.items.push({ id: newId, label: `Item ${newId}` });
			q.order = q.items.map(i => i.id);
			renderItems();
			view.renderPreview();
		});
	}

	function _bindMatchingEditor(container, q) {
		container.createEl("h4", { text: "Paires à associer" });
		const list = container.createDiv({ cls: "qb-options-list" });

		const renderPairs = () => {
			list.empty();
			q.pairs.forEach((pair, idx) => {
				const row = list.createDiv({ cls: "qb-option-row" });

				const leftInput = row.createEl("input", { cls: "qb-field-input", type: "text", value: pair.left, placeholder: "Gauche" });
				leftInput.addEventListener("input", () => {
					pair.left = leftInput.value;
					view.renderPreview();
				});

				const rightInput = row.createEl("input", { cls: "qb-field-input", type: "text", value: pair.right, placeholder: "Droite" });
				rightInput.addEventListener("input", () => {
					pair.right = rightInput.value;
					view.renderPreview();
				});

				const delBtn = row.createEl("button", { cls: "qb-btn-icon" });
				delBtn.textContent = "×";
				delBtn.addEventListener("click", () => {
					q.pairs.splice(idx, 1);
					renderPairs();
					view.renderPreview();
				});
			});
		};

		renderPairs();

		const addBtn = container.createEl("button", { cls: "qb-btn" });
		addBtn.textContent = "Ajouter une paire";
		addBtn.addEventListener("click", () => {
			const newId = String(q.pairs.length + 1);
			q.pairs.push({ id: newId, left: "", right: "" });
			renderPairs();
			view.renderPreview();
		});
	}

	function _bindTextEditor(container, q) {
		container.createEl("h4", { text: "Réponse attendue" });
		const wrap = container.createDiv({ cls: "qb-field" });
		const input = wrap.createEl("input", { cls: "qb-field-input", type: "text", value: (q.acceptedAnswers || [])[0] || "" });
		input.addEventListener("input", () => {
			q.acceptedAnswers = [input.value];
			view.renderPreview();
		});
	}

	function _bindSettingsEditor(container, q) {
		container.createEl("h4", { text: "Paramètres de la question" });
		// Paramètres spécifiques au type
	}

	return {
		_renderEditor,
		_bindBasicField,
		_bindOptionsEditor,
		_bindMultiSelectEditor,
		_bindOrderingEditor,
		_bindMatchingEditor,
		_bindTextEditor
	};
};
