'use strict';

module.exports = function createCardRenderers(ctx) {
	// Variables locales
	let __quizSubmitSlideSignature = "";
	let __quizResultsSlideSignature = "";

	function tabClass(i) {
		const active = (ctx.isQuestionSlideIndex(ctx.quizState.current) && i === ctx.quizState.current) ? "active" : "";
		if (!ctx.hasAnyAnswer(i)) return active;
		if (!ctx.quizState.locked) return `${active} answered`.trim();
		return `${active} ${ctx.isCorrect(i) ? "correct" : "wrong"}`.trim();
	}

	function navHtml() {
		const resultsActive = (ctx.isSubmitSlideIndex(ctx.quizState.current) || ctx.isResultsSlideIndex(ctx.quizState.current)) ? "active" : "";
		return `<div class="quiz-nav">${ctx.quiz.map((_, i) => `<a class="quiz-tab ${tabClass(i)}" href="#" data-nav="${i}">Q${i + 1}</a>`).join("")}<a class="quiz-tab is-result ${resultsActive}" href="#" data-nav-results="1">Résultats</a></div>`;
	}

	function optionClass(qi, oi) {
		const q = ctx.quiz[qi];
		const sel = ctx.quizState.selections[qi];
		if (q.multiSelect) {
			const selected = sel instanceof Set && sel.has(oi);
			if (!ctx.quizState.locked) return selected ? "selected" : "";
			const correct = q.correctIndices.includes(oi);
			if (selected && correct) return "correct";
			if (selected && !correct) return "wrong";
			if (!selected && correct) return "missed";
			return "";
		}
		const selected = sel === oi;
		if (!ctx.quizState.locked) return selected ? "selected" : "";
		const correct = oi === q.correctIndex;
		if (selected && correct) return "correct";
		if (selected && !correct) return "wrong";
		if (!selected && correct) return "missed";
		return "";
	}

	function explanationHtml(qi) {
		const q = ctx.quiz[qi];
		if (!q) return "";
		if (q._explainHtml) {
			return `<div class="quiz-explain ${ctx.isCorrect(qi) ? "good" : "bad"}">${ctx.sanitize.replaceObsidianEmbedsInHtml(q._explainHtml)}</div>`;
		}
		if (q.explain) {
			return `<div class="quiz-explain ${ctx.isCorrect(qi) ? "good" : "bad"}">${ctx.sanitize.renderTextWithEmbeds(q.explain)}</div>`;
		}
		return "";
	}

	function renderQuizPromptHtml(q) {
		if (q._promptHtml) {
			return ctx.sanitize.replaceObsidianEmbedsInHtml(q._promptHtml);
		}
		if (q.prompt) {
			return ctx.sanitize.renderTextWithEmbeds(q.prompt);
		}
		return "";
	}

	function orderingCardHtml(q, qi) {
		const items = ctx.getOrderingItems(q);
		const slotLabels = ctx.getOrderingSlotLabels(q);
		const sel = ctx.quizState.selections[qi];

		let slotsHtml = "";
		for (let i = 0; i < slotLabels.length; i++) {
			const placedIdx = Array.isArray(sel) ? sel[i] : null;
			const placedText = placedIdx !== null && placedIdx !== undefined && items[placedIdx] ? items[placedIdx] : "";
			const isFilled = placedText !== "";
			slotsHtml += `<div class="quiz-slot ${isFilled ? "filled" : ""}" data-order-slot="${i}"><span class="quiz-slot-label">${slotLabels[i]}</span>${placedText ? `<span class="quiz-slot-value">${ctx.escapeHtmlText(placedText)}</span>` : ""}</div>`;
		}

		let itemsHtml = "";
		for (let i = 0; i < items.length; i++) {
			if (!ctx.orderingSelectionIncludes(qi, i)) {
				itemsHtml += `<div class="quiz-possibility" data-order-item="${i}">${ctx.escapeHtmlText(items[i])}</div>`;
			}
		}

		return `<div class="quiz-ordering"><div class="quiz-ordering-slots">${slotsHtml}</div><div class="quiz-ordering-items">${itemsHtml}</div></div>`;
	}

	function matchingCardHtml(q, qi) {
		const rows = ctx.getMatchRows(q);
		const choices = ctx.getMatchChoices(q);
		const sel = ctx.quizState.selections[qi];

		let rowsHtml = "";
		for (let i = 0; i < rows.length; i++) {
			const matchedChoiceIdx = Array.isArray(sel) ? sel[i] : null;
			const matchedText = matchedChoiceIdx !== null && matchedChoiceIdx !== undefined && choices[matchedChoiceIdx] ? choices[matchedChoiceIdx] : "";
			rowsHtml += `<div class="quiz-match-row" data-match-row="${i}"><span class="quiz-match-label">${ctx.escapeHtmlText(rows[i])}</span>${matchedText ? `<span class="quiz-match-value">${ctx.escapeHtmlText(matchedText)}</span>` : `<span class="quiz-match-placeholder">—</span>`}</div>`;
		}

		let choicesHtml = "";
		for (let i = 0; i < choices.length; i++) {
			if (!ctx.matchingSelectionIncludes(qi, i)) {
				choicesHtml += `<div class="quiz-match-choice" data-match-choice="${i}">${ctx.escapeHtmlText(choices[i])}</div>`;
			}
		}

		return `<div class="quiz-matching"><div class="quiz-matching-rows">${rowsHtml}</div><div class="quiz-matching-choices">${choicesHtml}</div></div>`;
	}

	function submitSlideHtml() {
		const missing = ctx.getMissingIndices();
		if (missing.length === 0) {
			return `<div class="quiz-track-item" data-slide-kind="submit"><section class="quiz-card quiz-submit-card"><h2>Récapitulatif</h2><p>Toutes les questions ont une réponse. Vous pouvez soumettre !</p><div class="quiz-submit-wrap"><button class="quiz-action-btn success quiz-show-score-btn" type="button">Voir le score</button></div></section></div>`;
		}
		const missingList = missing.map(i => `<a href="#" data-jump="${i}">Question ${i + 1}</a>`).join(", ");
		return `<div class="quiz-track-item" data-slide-kind="submit"><section class="quiz-card quiz-submit-card"><h2>Récapitulatif</h2><p>Questions sans réponse : ${missingList}</p><div class="quiz-submit-wrap"><button class="quiz-action-btn quiz-back-btn" type="button">Retour à la dernière question</button></div></section></div>`;
	}

	function resultsSlideHtml() {
		const { pct, correct, total } = ctx.computeScorePercent();
		return `<div class="quiz-track-item" data-slide-kind="results"><section class="quiz-result"><h2 class="quiz-result-title" style="font-weight:900;">Résultats</h2><p style="font-size:48px;font-weight:900;margin:18px 0 6px;">${pct}%</p><p>Bonnes réponses : <strong>${correct}/${total}</strong></p><div class="quiz-actions"><button class="quiz-action-btn success quiz-retry-btn" type="button">Recommencer</button></div></section></div>`;
	}

	function refreshMetaSlides({ force = false } = {}) {
		const nextSubmitSignature = ctx.getSubmitSlideSignature();
		const nextResultsSignature = ctx.getResultsSlideSignature();
		const shouldRefreshSubmit = force || nextSubmitSignature !== __quizSubmitSlideSignature;
		const shouldRefreshResults = force || nextResultsSignature !== __quizResultsSlideSignature;
		if (!shouldRefreshSubmit && !shouldRefreshResults) return;

		const refreshMetaSlide = ({ selector, index, html, binder }) => {
			const oldNode = ctx.container.querySelector(selector);
			if (!oldNode) return;
			ctx.viewport.unobserveTrackItemInAllSlidesResizeObserver(oldNode);
			ctx.bumpSlideGeneration(index);
			const tmp = document.createElement("div");
			tmp.innerHTML = html().trim();
			const newNode = tmp.firstElementChild;
			if (!newNode) return;
			oldNode.replaceWith(newNode);
			ctx.viewport.observeTrackItemInAllSlidesResizeObserver(newNode);
			binder(newNode);
		};

		if (shouldRefreshSubmit) {
			refreshMetaSlide({
				selector: '.quiz-track-item[data-slide-kind="submit"]',
				index: ctx.SLIDE_SUBMIT_INDEX,
				html: submitSlideHtml,
				binder: ctx.interactions.bindSubmitSlideControls
			});
			__quizSubmitSlideSignature = nextSubmitSignature;
		}
		if (shouldRefreshResults) {
			refreshMetaSlide({
				selector: '.quiz-track-item[data-slide-kind="results"]',
				index: ctx.SLIDE_RESULTS_INDEX,
				html: resultsSlideHtml,
				binder: ctx.interactions.bindResultsSlideControls
			});
			__quizResultsSlideSignature = nextResultsSignature;
		}

		ctx.viewport.applyTrackGeometry({ refreshWidth: false });
		ctx.viewport.syncTrackViewportIsolation();
		const { track } = ctx.viewport.getTrackElements();
		if (track && (ctx.quizState.current === ctx.SLIDE_SUBMIT_INDEX || ctx.quizState.current === ctx.SLIDE_RESULTS_INDEX)) {
			track.style.transition = "none";
			ctx.track.setTrackTransformPx(ctx.track.getSlideTranslateX(ctx.quizState.current));
			ctx.viewport.__quizSlideHeightCache?.delete(ctx.quizState.current);
			ctx.viewport.scheduleViewportHeightSync({ index: ctx.quizState.current, animate: false, refresh: true });
		}
	}

	function questionCardHtml(qi) {
		const q = ctx.quiz[qi];
		const isTxt = ctx.isTextQuestion(q);
		const isOrd = ctx.isOrderingQuestion(q);
		const isMatch = ctx.isMatchingQuestion(q);
		const isMulti = !!q.multiSelect;

		let body = "";

		if (isTxt) {
			body = ctx.terminal.textQuestionCardHtml(q, qi);
		}
		else if (isOrd) {
			body = orderingCardHtml(q, qi);
		}
		else if (isMatch) {
			body = matchingCardHtml(q, qi);
		}
		else {
			const smap = ctx.quizState.shuffleMap[qi] || [];
			const mi = isMulti ? `<div class="quiz-multi-indicator">Sélectionnez une ou plusieurs réponses</div>` : "";
			const optionsHtml = smap.map((oi) => {
				let optionContentHtml = "";
				if (q.optionHtml?.[oi]) {
					optionContentHtml = q.optionHtml[oi];
					if (typeof ctx.app?.vault?.adapter?.getResourcePath === "function") {
						optionContentHtml = optionContentHtml.replace(/src="([^"]+)"/g, (match, src) => {
							if (src.startsWith("http") || src.startsWith("data:") || src.startsWith("app://")) {
								return match;
							}
							try {
								const resolved = ctx.app.vault.adapter.getResourcePath(src);
								return `src="${ctx.escapeHtmlAttr(resolved)}"`;
							} catch {
								return match;
							}
						});
					}
				} else {
					optionContentHtml = ctx.sanitize.renderRawHtmlWithEmbeds(q.options[oi], { wrapClass: "quiz-option-embed-wrap", imgClass: "quiz-option-embed" });
				}
				return `<div class="quiz-option ${isMulti ? "multi" : ""} ${optionClass(qi, oi)}" role="button" tabindex="0" data-orig="${oi}">${optionContentHtml}</div>`;
			}).join("");
			const hasImg = /<img[\s>]/i.test(optionsHtml);
			body = mi + `<div class="quiz-options-wrap${hasImg ? " quiz-options-image-grid" : ""}">${optionsHtml}</div>`;
		}

		const hintBtn = (q.hint && String(q.hint).trim()) ? `<button class="quiz-hint-btn" type="button">Indice</button>` : "";
		const sectionIdAttr = (typeof q?.id === "string" && q.id.trim().length > 0)
			? ` id="${ctx.escapeHtmlAttr(q.id)}"`
			: "";

		return `<div class="quiz-track-item" data-slide-kind="question" data-qi="${qi}">
			<section class="quiz-card"${sectionIdAttr}>
				<h2>${ctx.escapeHtmlText(q.title)}</h2>
				${ctx.sanitize.resourceButtonHtml(q)}
				<div class="quiz-question">${renderQuizPromptHtml(q)}</div>
				${body}
				${hintBtn}
				${ctx.quizState.locked ? explanationHtml(qi) : ""}
			</section>
		</div>`;
	}

	return {
		tabClass,
		navHtml,
		optionClass,
		explanationHtml,
		renderQuizPromptHtml,
		orderingCardHtml,
		matchingCardHtml,
		submitSlideHtml,
		resultsSlideHtml,
		refreshMetaSlides,
		questionCardHtml
	};
};
