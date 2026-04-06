'use strict';

module.exports = function createEditorFormHandlers(ctx) {
	const { Q_TYPES, _setIcon, _iconSpan, md2html } = ctx;
	const view = ctx.view;

	function renderEditor() {
		const q = ctx.questions[ctx.activeIdx];
		if (!q) return;
		const ti = Q_TYPES.find(t => t.key === q._type) || Q_TYPES[0];
		const wrap = view.editorInnerEl;
		wrap.empty();

		const badge = wrap.createDiv({ cls: "qb-type-badge" });
		const badgeIcon = badge.createDiv({ cls: "qb-type-icon" }); _setIcon(badgeIcon, ti.lucide);
		const badgeText = badge.createDiv();
		badgeText.createDiv({ cls: "qb-type-label", text: ti.label });
		badgeText.createDiv({ cls: "qb-type-desc", text: ti.desc });

		_field(wrap, "Énoncé", q.prompt, "Votre question...", true, v => { q.prompt = v; view.renderCode(); view.schedulePreview(); }, { imagePaste: true });
		_resourceSection(wrap, q);

		const box = wrap.createDiv({ cls: "qb-section-box" });
		_renderTypeFields(box, q);

		_field(wrap, "Indice", q.hint, "Un indice pour aider...", true, v => { q.hint = v; view.renderCode(); view.schedulePreview(); }, { imagePaste: true });
		_field(wrap, "Explication (Markdown)", q.explain, "### Rappels\n- **Terme** — Définition", true, v => { q.explain = v; view.renderCode(); view.schedulePreview(); }, { imagePaste: true });
	}

	function _field(parent, label, value, placeholder, multiline, onChange, opts = {}) {
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
							const attachFolder = ctx.plugin.app.vault.getConfig("attachmentFolderPath") || "";
							const filePath = attachFolder ? attachFolder + "/" + fileName : fileName;
							const buffer = await file.arrayBuffer();
							await ctx.plugin.app.vault.adapter.writeBinary(filePath, new Uint8Array(buffer));
							const before = ta.value.slice(0, ta.selectionStart);
							const after = ta.value.slice(ta.selectionEnd);
							ta.value = before + `![[${fileName}]]` + after;
							ta.selectionStart = ta.selectionEnd = before.length + `![[${fileName}]]`.length;
							onChange(ta.value);
							view.schedulePreview();
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

	function _resourceSection(parent, q) {
		if (!q.resourceButton) {
			q.resourceButton = { label: "", fileName: "" };
		}

		const details = parent.createEl("details", { cls: "qb-collapsible" });
		const summary = details.createEl("summary");
		_iconSpan(summary, "paperclip", "qb-summary-icon");
		summary.appendChild(document.createTextNode(" Bouton ressource (optionnel)"));
		const body = details.createDiv({ cls: "qb-collapsible-body" });
		const renderInner = () => {
			body.empty();
			const has = !!q.resourceButton;
			const toggleWrap = body.createDiv({ cls: "qb-toggle-wrap" });
			const track = toggleWrap.createDiv({ cls: `qb-toggle-track ${has ? "on" : ""}` });
			track.createDiv({ cls: "qb-toggle-thumb" });
			toggleWrap.appendChild(document.createTextNode("Activer le bouton ressource"));
			toggleWrap.addEventListener("click", () => { q.resourceButton = q.resourceButton ? null : { label: "Activité PT", fileName: "" }; renderInner(); view.renderCode(); view.schedulePreview(); });
			if (has) {
				_field(body, "Label", q.resourceButton.label, "Activité PT", false, v => { q.resourceButton.label = v; view.renderCode(); view.schedulePreview(); });
				_field(body, "Nom du fichier", q.resourceButton.fileName, "fichier.pka", false, v => { q.resourceButton.fileName = v; view.renderCode(); view.schedulePreview(); });
			}
		};
		renderInner();
	}

	function _renderTypeFields(box, q) {
		const t = q._type;
		const rerender = () => { view.renderCode(); view.schedulePreview(); };

		if (t === "single" || t === "multi") {
			const isMulti = t === "multi";
			const cardsContainer = box.createDiv({ cls: "qb-answer-cards" });

			const renderCards = () => {
				cardsContainer.empty();

				q.options.forEach((o, i) => {
					const isCorrect = isMulti ? (q.correctIndices || []).includes(i) : i === q.correctIndex;
					const card = cardsContainer.createDiv({ cls: `qb-answer-card ${isCorrect ? "qb-answer-correct" : "qb-answer-wrong"}` });

					const toggleRow = card.createDiv({ cls: "qb-answer-toggle-row" });
					toggleRow.createSpan({ cls: "qb-answer-toggle-label", text: isCorrect ? "Bonne réponse" : "Mauvaise réponse" });

					const toggle = toggleRow.createDiv({ cls: "qb-answer-toggle" });
					const track = toggle.createDiv({ cls: "qb-answer-toggle-track" });
					const thumb = track.createDiv({ cls: "qb-answer-toggle-thumb" });
					_setIcon(thumb, isCorrect ? "check" : "x");

					const triggerFlash = (toCorrect) => {
						card.classList.remove("qb-answer-flash-green", "qb-answer-flash-red");
						void card.offsetWidth;
						card.classList.add(toCorrect ? "qb-answer-flash-green" : "qb-answer-flash-red");
						setTimeout(() => {
							card.classList.remove("qb-answer-flash-green", "qb-answer-flash-red");
						}, 500);
					};

					toggle.addEventListener("click", () => {
						if (isMulti) {
							const a = q.correctIndices || [];
							if (a.includes(i)) {
								if (a.length > 1) {
									triggerFlash(false);
									q.correctIndices = a.filter(x => x !== i);
									view.render();
								}
							} else {
								triggerFlash(true);
								q.correctIndices = [...a, i].sort((a, b) => a - b);
								view.render();
							}
						} else {
							if (!isCorrect) {
								triggerFlash(true);
								q.correctIndex = i;
								view.render();
							}
						}
					});

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

									const folder = ctx.plugin.app.vault.getConfig('attachmentFolderPath') || '';
									const path = folder ? folder + '/' + fileName : fileName;

									const buf = await file.arrayBuffer();
									await ctx.plugin.app.vault.adapter.writeBinary(path, new Uint8Array(buf));

									const before = input.value.slice(0, input.selectionStart);
									const after = input.value.slice(input.selectionEnd);
									const wikiLink = `![[${fileName}]]`;
									input.value = before + wikiLink + after;
									input.selectionStart = input.selectionEnd = before.length + wikiLink.length;

									q.options[i] = input.value;
									view.schedulePreview();
									view.renderCode();
								} catch (err) {
									console.error("Failed to paste image:", err);
								}
								break;
							}
						}
					});

					if (!isCorrect && q.options.length > 2) {
						const delBtn = card.createEl("button", { cls: "qb-answer-delete" });
						_setIcon(delBtn, "x");
						delBtn.addEventListener("click", () => {
							q.options.splice(i, 1);
							if (isMulti) {
								q.correctIndices = (q.correctIndices || []).filter(idx => idx !== i).map(idx => idx > i ? idx - 1 : idx);
							} else {
								if (q.correctIndex === i) q.correctIndex = 0;
								else if (q.correctIndex > i) q.correctIndex--;
							}
							view.render();
						});
					}
				});

				const addBtn = box.createEl("button", { cls: "qb-answer-add" });
				addBtn.appendChild(document.createTextNode("Ajouter une réponse"));
				addBtn.addEventListener("click", () => {
					q.options.push("");
					if (isMulti && q.options.length === 1) {
						q.correctIndices = [0];
					}
					view.render();
				});
			};

			renderCards();
		}

		if (t === "ordering") {
			_arrayEditor(box, "Possibilités", q.possibilities, () => {
				while (q.correctOrder.length < q.possibilities.length) q.correctOrder.push(q.correctOrder.length);
				q.correctOrder = q.correctOrder.slice(0, q.possibilities.length);
				while (q.slots.length < q.possibilities.length) q.slots.push(`Étape ${q.slots.length + 1}`);
				q.slots = q.slots.slice(0, q.possibilities.length);
				rerender();
			}, "Élément", "Ajouter");
			_arrayEditor(box, "Labels des slots", q.slots, rerender, "Slot", "Ajouter");

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
			_arrayEditor(box, "Lignes (situations)", q.rows, () => {
				while (q.correctMap.length < q.rows.length) q.correctMap.push(0);
				q.correctMap = q.correctMap.slice(0, q.rows.length);
				rerender();
			}, "Situation", "Ajouter");
			_arrayEditor(box, "Choix (supports)", q.choices, () => {
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
				_field(box, "Préfix du prompt", q.commandPrefix, t === "cmd" ? "C:\\>" : "PS>", false, v => { q.commandPrefix = v; rerender(); });
			_field(box, "Placeholder", q.placeholder, "Texte indicatif...", false, v => { q.placeholder = v; rerender(); });
			_arrayEditor(box, "Réponses acceptées", q.acceptedAnswers, rerender, "Réponse", "Ajouter");
			const toggleWrap = box.createDiv({ cls: "qb-toggle-wrap" });
			const track = toggleWrap.createDiv({ cls: `qb-toggle-track ${q.caseSensitive ? "on" : ""}` });
			track.createDiv({ cls: "qb-toggle-thumb" });
			toggleWrap.appendChild(document.createTextNode("Sensible à la casse"));
			toggleWrap.addEventListener("click", () => { q.caseSensitive = !q.caseSensitive; view.render(); });
		}
	}

	function _arrayEditor(parent, label, items, onChange, placeholder, addLabel) {
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
			addBtn.appendChild(document.createTextNode(addLabel));
			addBtn.addEventListener("click", () => { items.push(""); onChange(); renderItems(); });
		};
		renderItems();
	}

	return {
		renderEditor,
		_field,
		_resourceSection,
		_renderTypeFields,
		_arrayEditor
	};
};
