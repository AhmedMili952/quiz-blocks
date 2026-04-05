'use strict';

module.exports = function createInteractionHandlers(ctx) {
	// Variables locales
	let __quizZoomFixBound = false;
	let __quizZoomFixRaf = 0;
	let __quizZoomFixSettleTimer = 0;
	let __quizZoomLastDpr = window.devicePixelRatio || 1;
	let __quizZoomFixHandler = null;

	function commitQuestionInteraction(qi, { syncHeight = true } = {}) {
		ctx.__quizSlideHeightCache?.delete(qi);
		ctx.refreshQuestionSlide(qi, { syncHeight });
		ctx.refreshMetaSlides();
	}

	function bindBinaryQuestion(trackItem, qi, isMulti) {
		trackItem.querySelectorAll(".quiz-option").forEach(el => {
			const oi = Number(el.dataset.orig);
			const trySelect = () => {
				if (ctx.quizState.isSliding || ctx.quizState.locked) return;
				if (isMulti) {
					const s = ctx.quizState.selections[qi];
					if (!(s instanceof Set)) return;
					if (s.has(oi)) s.delete(oi);
					else s.add(oi);
				} else ctx.quizState.selections[qi] = oi;
				commitQuestionInteraction(qi, { syncHeight: true });
			};
			el.addEventListener("click", trySelect);
			el.addEventListener("keydown", e => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					trySelect();
				}
			});
		});
	}

	function bindOrderingQuestion(trackItem, qi, q) {
		const qItems = ctx.getOrderingItems(q);
		if (!Array.isArray(ctx.quizState.selections[qi]) || ctx.quizState.selections[qi].length !== qItems.length) {
			ctx.quizState.selections[qi] = Array(qItems.length).fill(null);
		}

		trackItem.querySelectorAll("[data-order-item]").forEach(el => {
			const oi = Number(el.dataset.orderItem);
			const pickItem = () => {
				if (ctx.quizState.isSliding || ctx.quizState.locked || ctx.orderingSelectionIncludes(qi, oi)) return;
				ctx.quizState.orderingPick[qi] = ctx.quizState.orderingPick[qi] === oi ? null : oi;
				commitQuestionInteraction(qi, { syncHeight: true });
			};
			el.addEventListener("click", pickItem);
			el.addEventListener("keydown", e => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					pickItem();
				}
			});
			el.addEventListener("dragstart", e => {
				if (ctx.quizState.isSliding || ctx.quizState.locked || ctx.orderingSelectionIncludes(qi, oi)) return void e.preventDefault();
				if (e.dataTransfer) {
					e.dataTransfer.effectAllowed = "move";
					e.dataTransfer.setData("text/plain", JSON.stringify({ mode: "order", oi, sourceSlot: -1 }));
				}
				el.classList.add("dragging");
				trackItem.querySelectorAll("[data-order-slot]").forEach(s => s.classList.add("drag-ready"));
			});
			el.addEventListener("dragend", () => {
				el.classList.remove("dragging");
				trackItem.querySelectorAll("[data-order-slot]").forEach(s => s.classList.remove("dragover", "drag-ready", "swap-target"));
			});
		});

		trackItem.querySelectorAll("[data-order-slot]").forEach(el => {
			const si = Number(el.dataset.orderSlot);
			const actOnSlot = () => {
				if (ctx.quizState.isSliding || ctx.quizState.locked) return;
				const sel = ctx.quizState.selections[qi];
				const picked = ctx.quizState.orderingPick[qi];
				if (!Array.isArray(sel)) return;
				if (picked !== null) {
					ctx.placeOrderingItemInSlot(qi, si, picked);
					ctx.quizState.orderingPick[qi] = null;
					return commitQuestionInteraction(qi, { syncHeight: true });
				}
				if (sel[si] !== null) {
					ctx.removeOrderingItemFromSlot(qi, si);
					commitQuestionInteraction(qi, { syncHeight: true });
				}
			};
			el.addEventListener("click", actOnSlot);
			el.addEventListener("keydown", e => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					actOnSlot();
				}
			});
			el.addEventListener("dragstart", e => {
				if (ctx.quizState.isSliding || ctx.quizState.locked) return void e.preventDefault();
				const sel = ctx.quizState.selections[qi];
				if (!Array.isArray(sel)) return void e.preventDefault();
				const oi = sel[si];
				if (oi === null || oi === undefined) return void e.preventDefault();
				if (e.dataTransfer) {
					e.dataTransfer.effectAllowed = "move";
					e.dataTransfer.setData("text/plain", JSON.stringify({ mode: "order", oi, sourceSlot: si }));
				}
				el.classList.add("dragging");
				trackItem.querySelectorAll("[data-order-slot]").forEach(s => s.classList.add("drag-ready"));
			});
			el.addEventListener("dragend", () => {
				el.classList.remove("dragging");
				trackItem.querySelectorAll("[data-order-slot]").forEach(s => s.classList.remove("dragover", "drag-ready", "swap-target"));
			});
			el.addEventListener("dragover", e => {
				if (ctx.quizState.isSliding || ctx.quizState.locked) return;
				e.preventDefault();
				const sel = ctx.quizState.selections[qi];
				el.classList.add("dragover");
				if (Array.isArray(sel) && sel[si] !== null) el.classList.add("swap-target");
				else el.classList.remove("swap-target");
			});
			el.addEventListener("dragleave", () => el.classList.remove("dragover", "swap-target"));
			el.addEventListener("drop", e => {
				e.preventDefault();
				el.classList.remove("dragover", "swap-target");
				if (ctx.quizState.locked || ctx.quizState.isSliding) return;
				const sel = ctx.quizState.selections[qi];
				if (!Array.isArray(sel)) return;
				const raw = e.dataTransfer ? e.dataTransfer.getData("text/plain") : "";
				if (!raw) return;
				let payload = null;
				try { payload = JSON.parse(raw); } catch (_) {}
				if (!payload || payload.mode !== "order") return;
				const oi = Number(payload.oi);
				let sourceSlot = Number(payload.sourceSlot);
				if (!Number.isFinite(oi)) return;
				if (!Number.isFinite(sourceSlot)) sourceSlot = -1;
				const targetSlot = si;
				const targetValue = sel[targetSlot];
				if (sourceSlot < 0 || sourceSlot >= sel.length || sel[sourceSlot] !== oi) sourceSlot = sel.indexOf(oi);
				if (sourceSlot !== -1) {
					if (sourceSlot === targetSlot) return;
					sel[sourceSlot] = targetValue;
					sel[targetSlot] = oi;
					ctx.quizState.orderingPick[qi] = null;
					return commitQuestionInteraction(qi, { syncHeight: true });
				}
				sel[targetSlot] = oi;
				ctx.quizState.orderingPick[qi] = null;
				commitQuestionInteraction(qi, { syncHeight: true });
			});
		});
	}

	function bindMatchingQuestion(trackItem, qi, q) {
		const rows = ctx.getMatchRows(q);
		if (!Array.isArray(ctx.quizState.selections[qi]) || ctx.quizState.selections[qi].length !== rows.length) {
			ctx.quizState.selections[qi] = Array(rows.length).fill(null);
		}

		trackItem.querySelectorAll("[data-match-choice]").forEach(el => {
			const ci = Number(el.dataset.matchChoice);
			const pickChoice = () => {
				if (ctx.quizState.isSliding || ctx.quizState.locked) return;
				ctx.quizState.matchPick[qi] = ctx.quizState.matchPick[qi] === ci ? null : ci;
				commitQuestionInteraction(qi, { syncHeight: true });
			};
			el.addEventListener("click", pickChoice);
			el.addEventListener("keydown", e => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					pickChoice();
				}
			});
			el.addEventListener("dragstart", e => {
				if (ctx.quizState.isSliding || ctx.quizState.locked) return void e.preventDefault();
				if (e.dataTransfer) {
					e.dataTransfer.effectAllowed = "copyMove";
					e.dataTransfer.setData("text/plain", JSON.stringify({ mode: "match", ci, sourceSlot: -1 }));
				}
				el.classList.add("dragging");
				trackItem.querySelectorAll("[data-match-slot]").forEach(s => s.classList.add("drag-ready"));
			});
			el.addEventListener("dragend", () => {
				el.classList.remove("dragging");
				trackItem.querySelectorAll("[data-match-slot]").forEach(s => s.classList.remove("dragover", "drag-ready", "swap-target"));
			});
		});

		trackItem.querySelectorAll("[data-match-slot]").forEach(el => {
			const si = Number(el.dataset.matchSlot);
			const actOnSlot = () => {
				if (ctx.quizState.isSliding || ctx.quizState.locked) return;
				const picked = ctx.quizState.matchPick[qi];
				const sel = ctx.quizState.selections[qi];
				if (!Array.isArray(sel)) return;
				if (picked !== null) {
					sel[si] = picked;
					ctx.quizState.matchPick[qi] = null;
					return commitQuestionInteraction(qi, { syncHeight: true });
				}
				if (sel[si] !== null) {
					sel[si] = null;
					commitQuestionInteraction(qi, { syncHeight: true });
				}
			};
			el.addEventListener("click", actOnSlot);
			el.addEventListener("keydown", e => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					actOnSlot();
				}
			});
			el.addEventListener("dragstart", e => {
				if (ctx.quizState.isSliding || ctx.quizState.locked) return void e.preventDefault();
				const sel = ctx.quizState.selections[qi];
				if (!Array.isArray(sel)) return void e.preventDefault();
				const ci = sel[si];
				if (ci === null || ci === undefined) return void e.preventDefault();
				if (e.dataTransfer) {
					e.dataTransfer.effectAllowed = "move";
					e.dataTransfer.setData("text/plain", JSON.stringify({ mode: "match", ci, sourceSlot: si }));
				}
				el.classList.add("dragging");
				trackItem.querySelectorAll("[data-match-slot]").forEach(s => s.classList.add("drag-ready"));
			});
			el.addEventListener("dragend", () => {
				el.classList.remove("dragging");
				trackItem.querySelectorAll("[data-match-slot]").forEach(s => s.classList.remove("dragover", "drag-ready", "swap-target"));
			});
			el.addEventListener("dragover", e => {
				if (ctx.quizState.isSliding || ctx.quizState.locked) return;
				e.preventDefault();
				const sel = ctx.quizState.selections[qi];
				el.classList.add("dragover");
				if (Array.isArray(sel) && sel[si] !== null) el.classList.add("swap-target");
				else el.classList.remove("swap-target");
			});
			el.addEventListener("dragleave", () => el.classList.remove("dragover", "swap-target"));
			el.addEventListener("drop", e => {
				e.preventDefault();
				el.classList.remove("dragover", "swap-target");
				if (ctx.quizState.locked || ctx.quizState.isSliding) return;
				const sel = ctx.quizState.selections[qi];
				if (!Array.isArray(sel)) return;
				const raw = e.dataTransfer ? e.dataTransfer.getData("text/plain") : "";
				if (!raw) return;
				let payload = null;
				try { payload = JSON.parse(raw); } catch (_) {}
				if (!payload || payload.mode !== "match") return;
				const ci = Number(payload.ci);
				if (!Number.isFinite(ci)) return;
				let sourceSlot = Number(payload.sourceSlot);
				if (!Number.isFinite(sourceSlot)) sourceSlot = -1;
				const targetSlot = si;
				const targetValue = sel[targetSlot];
				if (sourceSlot >= 0 && sourceSlot < sel.length && sel[sourceSlot] === ci) {
					if (sourceSlot === targetSlot) return;
					sel[sourceSlot] = targetValue;
					sel[targetSlot] = ci;
					ctx.quizState.matchPick[qi] = null;
					return commitQuestionInteraction(qi, { syncHeight: true });
				}
				sel[targetSlot] = ci;
				ctx.quizState.matchPick[qi] = null;
				commitQuestionInteraction(qi, { syncHeight: true });
			});
		});
	}

	function bindQuestionTrackItem(trackItem) {
		if (!trackItem) return;

		const qi = Number(trackItem.dataset.qi);
		if (!Number.isFinite(qi) || qi < 0 || qi >= ctx.quiz.length) return;

		const q = ctx.quiz[qi];
		const isTxt = ctx.isTextQuestion(q);
		const isOrd = ctx.isOrderingQuestion(q);
		const isMatch = ctx.isMatchingQuestion(q);
		const isMulti = !!q.multiSelect;

		if (isTxt) ctx.terminal.bindTextQuestion(trackItem, qi);
		if (!isTxt && !isOrd && !isMatch) bindBinaryQuestion(trackItem, qi, isMulti);
		if (isOrd) bindOrderingQuestion(trackItem, qi, q);
		if (isMatch) bindMatchingQuestion(trackItem, qi, q);

		const hintBtn = trackItem.querySelector(".quiz-hint-btn");
		if (hintBtn) {
			hintBtn.addEventListener("click", e => {
				e.preventDefault();
				e.stopPropagation();
				ctx.openHintModal(q.hint);
			});
		}

		const prevBtn = trackItem.querySelector(".quiz-prev-btn");
		if (prevBtn) prevBtn.addEventListener("click", () => ctx.goToQuestion(qi - 1));

		const nextBtn = trackItem.querySelector(".quiz-next-btn");
		if (nextBtn) nextBtn.addEventListener("click", () => ctx.goToQuestion(qi + 1));
	}

	function bindSubmitSlideControls(rootEl) {
		if (!rootEl) return;
		rootEl.querySelectorAll("[data-jump]").forEach(btn => btn.addEventListener("click", () => ctx.goToQuestion(Number(btn.dataset.jump))));
		const backBtn = rootEl.querySelector(".quiz-back-btn");
		if (backBtn) backBtn.addEventListener("click", () => ctx.goToQuestion(ctx.quizState.lastQuestionIndex));
		const showScoreBtn = rootEl.querySelector(".quiz-show-score-btn");
		if (showScoreBtn) showScoreBtn.addEventListener("click", () => ctx.goToResults());
	}

	function bindResultsSlideControls(rootEl) {
		if (!rootEl) return;
		const retryBtn = rootEl.querySelector(".quiz-retry-btn");
		if (retryBtn) retryBtn.addEventListener("click", e => {
			e.preventDefault();
			ctx.zoom.restartQuizWithZoomBlurTransition();
		});
	}

	function bindExamStartButton() {
		const startBtn = ctx.container.querySelector('.quiz-exam-start-btn');
		if (startBtn) {
			startBtn.addEventListener('click', () => ctx.exam.startExam());
		}
	}

	function bindStaticControls() {
		bindSubmitSlideControls(ctx.container.querySelector('.quiz-track-item[data-slide-kind="submit"]'));
		bindResultsSlideControls(ctx.container.querySelector('.quiz-track-item[data-slide-kind="results"]'));
		const bindNavTab = (tab, navigateFn) => {
			if (!tab) return;
			tab.addEventListener("pointerdown", e => {
				if (e.button !== 0) return;
				ctx.clearAllNavTabPressStates();
				ctx.setNavTabPressState(tab, true);
			});
			tab.addEventListener("pointercancel", () => ctx.clearNavTabPressState(tab));
			tab.addEventListener("click", async e => {
				e.preventDefault();
				e.stopPropagation();
				await ctx.playNavTabPressAndNavigate(tab, navigateFn);
			});
			tab.addEventListener("keydown", async e => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					e.stopPropagation();
					await ctx.playNavTabPressAndNavigate(tab, navigateFn, { fromKeyboard: true });
				}
			});
		};
		ctx.container.querySelectorAll("[data-nav]").forEach(a => bindNavTab(a, () => ctx.goToQuestion(Number(a.dataset.nav))));
		const resultsTab = ctx.container.querySelector("[data-nav-results]");
		if (resultsTab) bindNavTab(resultsTab, () => {
			if (ctx.quizState.locked) ctx.goToSlide(ctx.SLIDE_RESULTS_INDEX, { forceRender: false });
			else ctx.goToSubmit();
		});
	}

	function destroyZoomFixHandlers() {
		if (!__quizZoomFixBound) return;
		__quizZoomFixBound = false;

		if (__quizZoomFixRaf) {
			cancelAnimationFrame(__quizZoomFixRaf);
			__quizZoomFixRaf = 0;
		}
		if (__quizZoomFixSettleTimer) {
			clearTimeout(__quizZoomFixSettleTimer);
			__quizZoomFixSettleTimer = 0;
		}
		if (__quizZoomFixHandler) {
			window.removeEventListener("resize", __quizZoomFixHandler);
			if (window.visualViewport) {
				window.visualViewport.removeEventListener("resize", __quizZoomFixHandler);
			}
			__quizZoomFixHandler = null;
		}
	}

	function bindZoomFixHandlers() {
		if (__quizZoomFixBound) return;
		__quizZoomFixBound = true;

		__quizZoomLastDpr = window.devicePixelRatio || 1;

		const requestResync = (settle = false) => {
			if (ctx.isDestroyed()) return;

			if (__quizZoomFixRaf) return;
			__quizZoomFixRaf = requestAnimationFrame(() => {
				__quizZoomFixRaf = 0;
				if (ctx.isDestroyed()) return;

				// Invalider les caches liés au layout/zoom
				ctx.viewport.__quizTrackViewportWidth = 0;
				ctx.viewport.__quizSlideHeightCache?.delete(ctx.quizState.current);

				// Recalage géométrie + position
				ctx.viewport.applyTrackGeometry({ refreshWidth: true });
				ctx.viewport.syncTrackViewportIsolation();

				// Si on est en slide, on repart proprement depuis l'état courant
				if (ctx.quizState.isSliding) {
					const snap = ctx.track.cancelRunningTrackAnimation();
					ctx.track.animateTrackToIndex(ctx.quizState.current, {
						fromX: snap.x,
						fromHeight: snap.height,
						refreshTargetHeight: true
					});
				} else {
					const { track } = ctx.viewport.getTrackElements();
					if (track) {
						track.style.transition = "none";
						track.style.willChange = "";
						ctx.track.setTrackTransformPx(ctx.track.getSlideTranslateX(ctx.quizState.current));
					}
					ctx.viewport.primeAllSlideHeights({ retries: settle ? 4 : 2, syncCurrent: true });
					ctx.viewport.scheduleViewportHeightSync({ index: ctx.quizState.current, animate: false, refresh: true });
				}

				// Re-sync spécifique des textareas terminal (caret/overlay/scrollLeft)
				ctx.viewport.resyncCommandTextareasOnSlide(ctx.quizState.current);

				ctx.updateNavHighlight();
			});
		};

		const onZoomOrResize = () => {
			const dpr = window.devicePixelRatio || 1;
			const dprChanged = Math.abs(dpr - __quizZoomLastDpr) > 0.001;
			if (dprChanged) __quizZoomLastDpr = dpr;

			requestResync(false);

			// "settle" : après stabilisation des layouts/fonts
			if (__quizZoomFixSettleTimer) clearTimeout(__quizZoomFixSettleTimer);
			__quizZoomFixSettleTimer = setTimeout(() => {
				__quizZoomFixSettleTimer = 0;
				requestResync(true);
			}, 260);
		};

		__quizZoomFixHandler = onZoomOrResize;

		window.addEventListener("resize", onZoomOrResize, { passive: true });
		if (window.visualViewport) {
			window.visualViewport.addEventListener("resize", onZoomOrResize, { passive: true });
		}
	}

	return {
		bindBinaryQuestion,
		bindOrderingQuestion,
		bindMatchingQuestion,
		bindQuestionTrackItem,
		bindSubmitSlideControls,
		bindResultsSlideControls,
		bindExamStartButton,
		bindStaticControls,
		bindZoomFixHandlers,
		destroyZoomFixHandlers
	};
};
