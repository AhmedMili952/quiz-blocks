'use strict';

const { parseQuizSource, extractExamOptions, renderParagraph } = require("./quiz-utils");
const createTerminalHandlers = require("./engine-terminal");
const createSanitizer = require("./engine-sanitizer");
const createResourceHandlers = require("./engine-resources");
const createExamHandlers = require("./engine-exam");
const createCardRenderers = require("./engine-cards");
const createViewportHandlers = require("./engine-viewport");
const createTrackHandlers = require("./engine-track");
const createZoomHandlers = require("./engine-zoom");
const createInteractionHandlers = require("./engine-interactions");
const createStateHandlers = require("./engine-state");
const createHintHandlers = require("./engine-hint");
const createQuestionHandlers = require("./engine-questions");

async function renderInteractiveQuiz(context) {

	const {
		app,
		container,
		quiz: rawQuiz,
		sourcePath,
		Notice
	} = context;

	container.empty();

	if (!Array.isArray(rawQuiz) || rawQuiz.length === 0) {
		renderParagraph(container, "⚠️ Aucune question fournie au moteur de quiz.");
		return;
	}

	const { questions: quiz, examOptions } = extractExamOptions(rawQuiz);

	if (!Array.isArray(quiz) || quiz.length === 0) {
		renderParagraph(container, "⚠️ Aucune question fournie au moteur de quiz.");
		return;
	}

	const isExamMode = examOptions !== null;
	const examDurationMs = isExamMode ? examOptions.durationMinutes * 60 * 1000 : 0;
	let examStartTime = 0;
	let examTimerId = null;
	let examTimeRemaining = examDurationMs;
	let examEnded = false;
	let examStarted = false;

	const QUIZ_INSTANCE_ID = (
		typeof crypto !== "undefined" && crypto.randomUUID
			? crypto.randomUUID()
			: Math.random().toString(36).slice(2) + Date.now().toString(36)
	).slice(0, 8);

	const HINT_OVERLAY_ID = `quizHintOverlay_${QUIZ_INSTANCE_ID}`;
	const HINT_TITLE_ID = `quizHintTitle_${QUIZ_INSTANCE_ID}`;
	const __quizGlobalCleanups = [];

	const shuffleArray = arr => {
		const a = [...arr];
		for (let i = a.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[a[i], a[j]] = [a[j], a[i]];
		}
		return a;
	};

	const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
	const isOrderingQuestion = q => !!(q && (q.ordering === true || typeof q.ordering === "object"));
	const isMatchingQuestion = q => !!(q && (q.matching === true || typeof q.matching === "object"));
	const isTextQuestion = q => !!(q && (q.type === "text" || q.text === true));

	// Créer le contexte partagé (ctx) pour injection de dépendances
	const ctx = {
		app,
		container,
		sourcePath,
		Notice,
		quiz,
		isExamMode,
		examOptions,
		examDurationMs,
		get examTimeRemaining() { return examTimeRemaining; },
		set examTimeRemaining(v) { examTimeRemaining = v; },
		get examStarted() { return examStarted; },
		set examStarted(v) { examStarted = v; },
		get examEnded() { return examEnded; },
		set examEnded(v) { examEnded = v; },
		get examStartTime() { return examStartTime; },
		set examStartTime(v) { examStartTime = v; },
		QUIZ_INSTANCE_ID,
		HINT_OVERLAY_ID,
		HINT_TITLE_ID,
		__quizGlobalCleanups,
		shuffleArray,
		clamp,
		isOrderingQuestion,
		isMatchingQuestion,
		isTextQuestion
	};

	// Instancier tous les modules avec ctx injecté
	const sanitizer = createSanitizer(ctx);
	const resources = createResourceHandlers(ctx);
	const exam = createExamHandlers(ctx);
	const cards = createCardRenderers(ctx);
	const viewport = createViewportHandlers(ctx);
	const track = createTrackHandlers(ctx);
	const zoom = createZoomHandlers(ctx);
	const interactions = createInteractionHandlers(ctx);
	const terminal = createTerminalHandlers(ctx);
	const state = createStateHandlers(ctx);
	const hint = createHintHandlers(ctx);
	const questions = createQuestionHandlers(ctx);

	// Attacher les modules à ctx pour référence croisée
	Object.assign(ctx, {
		sanitize: sanitizer,
		resources,
		exam,
		cards,
		viewport,
		track,
		zoom,
		interactions,
		terminal,
		state,
		hint,
		questions,
		// Fonctions exposées directement
		openHintModal: hint.openHintModal,
		closeHintModal: hint.closeHintModal,
		getOrderingItems: questions.getOrderingItems,
		getOrderingCorrectOrder: questions.getOrderingCorrectOrder,
		getOrderingSlotLabels: questions.getOrderingSlotLabels,
		getMatchRows: questions.getMatchRows,
		getMatchChoices: questions.getMatchChoices,
		getMatchCorrectMap: questions.getMatchCorrectMap,
		orderingSelectionIncludes: questions.orderingSelectionIncludes,
		removeOrderingItemFromSlot: questions.removeOrderingItemFromSlot,
		placeOrderingItemInSlot: questions.placeOrderingItemInSlot,
		matchingSelectionIncludes: questions.matchingSelectionIncludes,
		hasAnyAnswer: state.hasAnyAnswer,
		isComplete: state.isComplete,
		getMissingIndices: state.getMissingIndices,
		isCorrect: state.isCorrect,
		computeScorePercent: state.computeScorePercent,
		getSubmitSlideSignature: state.getSubmitSlideSignature,
		getResultsSlideSignature: state.getResultsSlideSignature,
		goToQuestion: state.goToQuestion,
		goToSubmit: state.goToSubmit,
		goToResults: state.goToResults,
		resetQuiz: state.resetQuiz,
		goToSlide: state.goToSlide,
		redirectSlide: state.redirectSlide,
		updateNavHighlight: state.updateNavHighlight,
		playNavTabPressAndNavigate: state.playNavTabPressAndNavigate,
		clearAllNavTabPressStates: state.clearAllNavTabPressStates,
		setNavTabPressState: state.setNavTabPressState,
		buildNavTabClass: state.buildNavTabClass
	});

function firstArray(...candidates) {
	for (const c of candidates) if (Array.isArray(c)) return c;
	return [];
}

function buildShuffleMap() {
	return quiz.map(q => {
		if (isTextQuestion(q)) return null;

		if (isOrderingQuestion(q)) {
			return shuffleArray([...Array(questions.getOrderingItems(q).length).keys()]);
		}

		if (isMatchingQuestion(q)) {
			return {
				rows: shuffleArray([...Array(questions.getMatchRows(q).length).keys()]),
				choices: shuffleArray([...Array(questions.getMatchChoices(q).length).keys()])
			};
		}

		return shuffleArray([...Array((q.options || []).length).keys()]);
	});
}

function initSelections() {
	return quiz.map(q => {
		if (isTextQuestion(q)) return "";
		if (isOrderingQuestion(q)) return Array(questions.getOrderingItems(q).length).fill(null);
		if (isMatchingQuestion(q)) return Array(questions.getMatchRows(q).length).fill(null);
		if (q.multiSelect) return new Set();
		return null;
	});
}
const initOrderingPicks = () => quiz.map(() => null);
const initMatchPicks = () => quiz.map(() => null);

const SLIDE_SUBMIT_INDEX = quiz.length;
const SLIDE_RESULTS_INDEX = quiz.length + 1;
const TOTAL_SLIDES = quiz.length + 2;
const isQuestionSlideIndex = i => i >= 0 && i < quiz.length;
const isSubmitSlideIndex = i => i === SLIDE_SUBMIT_INDEX;
const isResultsSlideIndex = i => i === SLIDE_RESULTS_INDEX;
const clampSlideIndex = i => Math.max(0, Math.min(TOTAL_SLIDES - 1, i));

const quizState = {
	selections: initSelections(),
	current: 0,
	prevCurrent: 0,
	lastQuestionIndex: 0,
	locked: false,
	pendingResultsLock: false,
	shuffleMap: buildShuffleMap(),
	orderingPick: initOrderingPicks(),
	matchPick: initMatchPicks(),
	isSliding: false,
	slideToken: 0
};

if (typeof container.__quizDestroy === "function") {
	try { container.__quizDestroy(); } catch (_) {}
}

let __quizTrackFixBound = false;
let __quizHeightRaf = 0;
let __quizHeightResyncTimer = 0;
let __quizMediaSyncToken = 0;
let __quizPrimeHeightsRaf = 0;
let __quizTrackTransitionFallbackTimer = 0;
let __quizActiveSlideResizeObserver = null;
let __quizAllSlidesResizeObserver = null;
let __quizViewportSettleTimer = 0;
let __quizBackgroundWarmStarted = false;
let __quizViewportResizeObserver = null;
let __quizViewportResizeRaf = 0;
let __quizViewportResizeSettleTimer = 0;
let __quizDestroyed = false;
let __quizAsyncEpoch = 0;
let __quizBackgroundWarmIdleHandle = 0;
let __quizBackgroundWarmIdleType = "";
let __quizBootstrapRaf1 = 0;
let __quizBootstrapRaf2 = 0;
let __quizHintCloseTimer = 0;
let __quizHintOpenRaf1 = 0;
let __quizHintOpenRaf2 = 0;
let __quizHintFocusTimer = 0;
let __quizEnsureVisibleRaf = 0;
let __quizTrackViewportWidth = 0;
let __quizTrackAppliedWidth = 0;
let __quizTrackAppliedSlideCount = 0;
let __quizSubmitSlideSignature = "";
let __quizResultsSlideSignature = "";

const __quizSlideHeightCache = new Map();
const __quizWarmSlidePromises = new Map();
const __quizSlideGeneration = Array.from({ length: TOTAL_SLIDES }, () => 0);
const __quizPendingAsyncWaiters = new Set();

const currentAsyncEpoch = () => __quizAsyncEpoch;
const isQuizInstanceAlive = (epoch = __quizAsyncEpoch) => !__quizDestroyed && epoch === __quizAsyncEpoch;
const getSlideGeneration = index => Number.isFinite(__quizSlideGeneration[index]) ? __quizSlideGeneration[index] : 0;
const isSlideGenerationCurrent = (index, generation) => getSlideGeneration(index) === generation;

function createPendingAsyncWaiter(cleanup = null) {
	const waiter = {
		settled: false,
		cleanup,
		promise: null,
		_resolve: null,
		resolve(value) {
			if (waiter.settled) return;
			waiter.settled = true;
			try { waiter.cleanup?.(); } catch (_) {}
			__quizPendingAsyncWaiters.delete(waiter);
			waiter._resolve(value);
		}
	};
	waiter.promise = new Promise(resolve => { waiter._resolve = resolve; });
	__quizPendingAsyncWaiters.add(waiter);
	return waiter;
}

function resolveAllPendingAsync(value = false) {
	for (const waiter of [...__quizPendingAsyncWaiters]) {
		try { waiter.resolve(value); } catch (_) {}
	}
}

// Étendre ctx avec les variables et fonctions partagées
Object.assign(ctx, {
	SLIDE_SUBMIT_INDEX,
	SLIDE_RESULTS_INDEX,
	TOTAL_SLIDES,
	quizState,
	__quizSlideHeightCache,
	__quizWarmSlidePromises,
	__quizSlideGeneration,
	__quizDestroyed,
	__quizAsyncEpoch,
	__quizBackgroundWarmStarted,
	__quizSubmitSlideSignature,
	__quizResultsSlideSignature,
	__quizBootstrapRaf1,
	__quizBootstrapRaf2,
	setBootstrapRaf1: v => __quizBootstrapRaf1 = v,
	setBootstrapRaf2: v => __quizBootstrapRaf2 = v,
	currentAsyncEpoch,
	isQuizInstanceAlive,
	getSlideGeneration,
	isSlideGenerationCurrent,
	createPendingAsyncWaiter,
	resolveAllPendingAsync,
	restartAsyncLifecycle,
	isDestroyed: () => __quizDestroyed,
	getMaxRenderedSlideHeight: ({ refresh = false, padding = 0 } = {}) => {
		let max = 0;
		const { track } = viewport.getTrackElements();
		if (!track) return 0;
		Array.from(track.children || []).forEach((slide, idx) => {
			const h = viewport.getSlideStableHeight(idx, { refresh });
			max = Math.max(max, h);
		});
		return Math.max(1, Math.ceil(max + padding));
	}
});

function restartAsyncLifecycle() {
	__quizAsyncEpoch++;
	resolveAllPendingAsync(false);
	clearBackgroundWarmIdleHandle();
	cancelEnsureTrackVisibleRaf();

	if (__quizBootstrapRaf1) {
		cancelAnimationFrame(__quizBootstrapRaf1);
		__quizBootstrapRaf1 = 0;
	}
	if (__quizBootstrapRaf2) {
		cancelAnimationFrame(__quizBootstrapRaf2);
		__quizBootstrapRaf2 = 0;
	}

	__quizBackgroundWarmStarted = false;
	__quizWarmSlidePromises.clear();
}

function sleep(ms, epoch = currentAsyncEpoch()) {
	let timer = 0;
	const waiter = createPendingAsyncWaiter(() => timer && clearTimeout(timer));
	timer = window.setTimeout(() => waiter.resolve(isQuizInstanceAlive(epoch)), Math.max(0, Number(ms) || 0));
	return waiter.promise;
}

function nextFrame(epoch = currentAsyncEpoch()) {
	let raf = 0;
	const waiter = createPendingAsyncWaiter(() => raf && cancelAnimationFrame(raf));
	raf = requestAnimationFrame(() => waiter.resolve(isQuizInstanceAlive(epoch)));
	return waiter.promise;
}

async function waitFrames(count = 1, epoch = currentAsyncEpoch()) {
	for (let i = 0; i < count; i++) {
		const alive = await nextFrame(epoch);
		if (!alive) return false;
	}
	return isQuizInstanceAlive(epoch);
}

function bumpSlideGeneration(index) {
	if (index < 0 || index >= TOTAL_SLIDES) return 0;
	__quizSlideGeneration[index] = getSlideGeneration(index) + 1;
	return __quizSlideGeneration[index];
}
function bumpAllSlideGenerations() {
	for (let i = 0; i < TOTAL_SLIDES; i++) bumpSlideGeneration(i);
}
function cancelEnsureTrackVisibleRaf() {
	if (__quizEnsureVisibleRaf) {
		cancelAnimationFrame(__quizEnsureVisibleRaf);
		__quizEnsureVisibleRaf = 0;
	}
}

const observeTrackItemInAllSlidesResizeObserver = item => {
	if (!__quizAllSlidesResizeObserver || !item) return;
	try { __quizAllSlidesResizeObserver.observe(item); } catch (_) {}
};
const unobserveTrackItemInAllSlidesResizeObserver = item => {
	if (!__quizAllSlidesResizeObserver || !item) return;
	try { __quizAllSlidesResizeObserver.unobserve(item); } catch (_) {}
};

function getQuestionFocusDescriptor(rootEl) {
	const active = document.activeElement;
	if (!rootEl || !active || !rootEl.contains(active)) return null;

	const descriptor = {
		selector: null,
		scrollX: window.scrollX || window.pageXOffset || 0,
		scrollY: window.scrollY || window.pageYOffset || 0
	};

	if (active.matches?.('.quiz-option[data-orig]')) {
		descriptor.selector = `.quiz-option[data-orig="${active.dataset.orig}"]`;
	}
	else if (active.matches?.('[data-order-item]')) {
		descriptor.selector = `[data-order-item="${active.dataset.orderItem}"]`;
	}
	else if (active.matches?.('[data-order-slot]')) {
		descriptor.selector = `[data-order-slot="${active.dataset.orderSlot}"]`;
	}
	else if (active.matches?.('[data-match-choice]')) {
		descriptor.selector = `[data-match-choice="${active.dataset.matchChoice}"]`;
	}
	else if (active.matches?.('[data-match-slot]')) {
		descriptor.selector = `[data-match-slot="${active.dataset.matchSlot}"]`;
	}
	else if (active.matches?.('.quiz-textarea[data-text-answer]')) {
		descriptor.selector = '.quiz-textarea[data-text-answer]';
	}
	else if (active.matches?.('.quiz-hint-btn')) {
		descriptor.selector = '.quiz-hint-btn';
	}
	else if (active.matches?.('.quiz-prev-btn')) {
		descriptor.selector = '.quiz-prev-btn';
	}
	else if (active.matches?.('.quiz-next-btn')) {
		descriptor.selector = '.quiz-next-btn';
	}
	else if (active.matches?.('.quiz-results-btn')) {
		descriptor.selector = '.quiz-results-btn';
	}
	else if (active.matches?.('.quiz-resource-btn')) {
		descriptor.selector = '.quiz-resource-btn';
	}

	return descriptor.selector ? descriptor : null;
}

function restoreQuestionFocus(rootEl, descriptor) {
	if (!rootEl || !descriptor?.selector) return;
	requestAnimationFrame(() => {
		if (__quizDestroyed) return;
		const target = rootEl.querySelector(descriptor.selector);
		if (!target || typeof target.focus !== "function") return;
		try { target.focus({ preventScroll: true }); } catch (_) { try { target.focus(); } catch (_) {} }
		try { window.scrollTo(descriptor.scrollX ?? 0, descriptor.scrollY ?? 0); } catch (_) {}
	});
}

function waitForManagedTransitions(entries, fallbackMs, epoch = currentAsyncEpoch()) {
	const normalized = (entries || []).map(entry => {
		if (!entry) return null;
		if (typeof Element !== "undefined" && entry instanceof Element) return { target: entry, properties: null };
		const target = entry.target || null;
		const properties = Array.isArray(entry.properties) && entry.properties.length > 0 ? new Set(entry.properties) : null;
		return target ? { target, properties } : null;
	}).filter(Boolean);
	if (normalized.length === 0) return Promise.resolve(isQuizInstanceAlive(epoch));

	let timer = 0;
	let remaining = normalized.length;
	const tracked = normalized.map(item => ({ target: item.target, properties: item.properties, seen: new Set(), listener: null, done: false }));
	const waiter = createPendingAsyncWaiter(() => {
		for (const item of tracked) {
			if (!item.target || !item.listener) continue;
			try { item.target.removeEventListener("transitionend", item.listener); } catch (_) {}
		}
		if (timer) clearTimeout(timer);
	});

	const finishOne = item => {
		if (item.done) return;
		item.done = true;
		if (item.target && item.listener) {
			try { item.target.removeEventListener("transitionend", item.listener); } catch (_) {}
		}
		item.listener = null;
		remaining -= 1;
		if (remaining <= 0) waiter.resolve(isQuizInstanceAlive(epoch));
	};

	for (const item of tracked) {
		item.listener = e => {
			if (e.target !== item.target) return;
			if (!item.properties) return finishOne(item);
			if (!item.properties.has(e.propertyName)) return;
			item.seen.add(e.propertyName);
			if (item.seen.size >= item.properties.size) finishOne(item);
		};
		try { item.target.addEventListener("transitionend", item.listener); } catch (_) { finishOne(item); }
	}

	if (remaining <= 0) return waiter.promise;
	timer = window.setTimeout(() => waiter.resolve(isQuizInstanceAlive(epoch)), Math.max(0, Number(fallbackMs) || 0));
	return waiter.promise;
}

function clearBackgroundWarmIdleHandle() {
	if (!__quizBackgroundWarmIdleHandle) return;
	if (__quizBackgroundWarmIdleType === "idle" && "cancelIdleCallback" in window) {
		try { window.cancelIdleCallback(__quizBackgroundWarmIdleHandle); } catch (_) {}
	} else clearTimeout(__quizBackgroundWarmIdleHandle);
	__quizBackgroundWarmIdleHandle = 0;
	__quizBackgroundWarmIdleType = "";
}

function requestQuizIdle(timeout = 500, epoch = currentAsyncEpoch()) {
	const waiter = createPendingAsyncWaiter(() => clearBackgroundWarmIdleHandle());
	if ("requestIdleCallback" in window) {
		__quizBackgroundWarmIdleType = "idle";
		__quizBackgroundWarmIdleHandle = window.requestIdleCallback(() => {
			__quizBackgroundWarmIdleHandle = 0;
			__quizBackgroundWarmIdleType = "";
			waiter.resolve(isQuizInstanceAlive(epoch));
		}, { timeout });
		return waiter.promise;
	}
	__quizBackgroundWarmIdleType = "timeout";
	__quizBackgroundWarmIdleHandle = window.setTimeout(() => {
		__quizBackgroundWarmIdleHandle = 0;
		__quizBackgroundWarmIdleType = "";
		waiter.resolve(isQuizInstanceAlive(epoch));
	}, Math.min(timeout, 80));
	return waiter.promise;
}

const getTrackElements = () => ({
	viewport: container.querySelector(".quiz-track-viewport"),
	track: container.querySelector(".quiz-track")
});

function getTrackItem(index = quizState.current) {
	const { track } = getTrackElements();
	return track ? track.children[index] || null : null;
}
function getTrackItems() {
	const { track } = getTrackElements();
	return track ? Array.from(track.children || []) : [];
}

function getViewportStableWidth({ refresh = false } = {}) {
	if (!refresh && __quizTrackViewportWidth > 0) return __quizTrackViewportWidth;
	const { viewport } = getTrackElements();
	const width = Math.max(1, Math.ceil(viewport?.clientWidth || viewport?.getBoundingClientRect?.().width || 0));
	__quizTrackViewportWidth = width;
	return width;
}

function applyTrackGeometry({ refreshWidth = false } = {}) {
	const { track } = getTrackElements();
	const width = getViewportStableWidth({ refresh: refreshWidth });
	if (!track || !width) return width;
	const items = Array.from(track.children || []);
	const childCount = items.length;
	let needsWrite = refreshWidth || __quizTrackAppliedWidth !== width || __quizTrackAppliedSlideCount !== childCount || track.style.width !== `${width * childCount}px`;
	if (!needsWrite) needsWrite = items.some(item => Number(item.__quizAppliedWidth || 0) !== width);
	if (!needsWrite) return width;
	track.style.width = `${width * childCount}px`;
	items.forEach(item => {
		item.style.flex = `0 0 ${width}px`;
		item.style.width = `${width}px`;
		item.style.minWidth = `${width}px`;
		item.style.maxWidth = `${width}px`;
		item.style.boxSizing = "border-box";
		item.__quizAppliedWidth = width;
	});
	__quizTrackAppliedWidth = width;
	__quizTrackAppliedSlideCount = childCount;
	return width;
}

const alignToDevicePixel = value => {
	const dpr = window.devicePixelRatio || 1;
	return Math.round((Number(value) || 0) * dpr) / dpr;
};

function getSlideTranslateX(index = quizState.current) {
	const { viewport, track } = getTrackElements();
	if (!viewport || !track) return 0;
	return alignToDevicePixel(-(getViewportStableWidth() * index));
}
function setTrackTransformPx(x) {
	const { track } = getTrackElements();
	if (track) track.style.transform = `translate3d(${alignToDevicePixel(x)}px, 0, 0)`;
}

function readCurrentTrackTranslateX() {
	const { track } = getTrackElements();
	if (!track) return getSlideTranslateX(quizState.current);
	try {
		const computed = getComputedStyle(track).transform;
		if (!computed || computed === "none") return getSlideTranslateX(quizState.current);
		const matrix = new DOMMatrix(computed);
		return Number.isFinite(matrix.m41) ? alignToDevicePixel(matrix.m41) : getSlideTranslateX(quizState.current);
	} catch (_) {
		return getSlideTranslateX(quizState.current);
	}
}

const setSlidingClass = on => container.classList.toggle("quiz-is-sliding", !!on);
const getSlidingWindow = () => ({ from: Math.min(quizState.prevCurrent, quizState.current), to: Math.max(quizState.prevCurrent, quizState.current) });

function primeTrackAndViewportForSlideStart(startX, lockedHeight) {
	const { track, viewport } = getTrackElements();
	if (!track || !viewport) return;
	applyTrackGeometry({ refreshWidth: true });
	const safeHeight = Math.max(1, Math.ceil(lockedHeight));
	track.style.transition = "none";
	track.style.willChange = "transform";
	setTrackTransformPx(startX);
	viewport.style.transition = "none";
	viewport.style.willChange = "height";
	viewport.style.height = `${safeHeight}px`;
	viewport.style.minHeight = `${safeHeight}px`;
	viewport.dataset.quizHeightReady = "1";
	viewport.__quizLockedHeight = safeHeight;
	void track.offsetWidth;
	void viewport.offsetHeight;
}

function clearTrackTransitionFallback() {
	if (__quizTrackTransitionFallbackTimer) {
		clearTimeout(__quizTrackTransitionFallbackTimer);
		__quizTrackTransitionFallbackTimer = 0;
	}
	if (__quizViewportSettleTimer) {
		clearTimeout(__quizViewportSettleTimer);
		__quizViewportSettleTimer = 0;
	}
	if (__quizPrimeHeightsRaf) {
		cancelAnimationFrame(__quizPrimeHeightsRaf);
		__quizPrimeHeightsRaf = 0;
	}
}

function destroyActiveSlideResizeObserver() {
	if (!__quizActiveSlideResizeObserver) return;
	try { __quizActiveSlideResizeObserver.disconnect(); } catch (_) {}
	__quizActiveSlideResizeObserver = null;
}
function destroyAllSlidesResizeObserver() {
	if (!__quizAllSlidesResizeObserver) return;
	try { __quizAllSlidesResizeObserver.disconnect(); } catch (_) {}
	__quizAllSlidesResizeObserver = null;
}

function bindActiveSlideResizeObserver() {
	destroyActiveSlideResizeObserver();
	if (typeof ResizeObserver === "undefined") return;
	const item = getTrackItem(quizState.current);
	if (!item) return;
	__quizActiveSlideResizeObserver = new ResizeObserver(() => {
		__quizSlideHeightCache.delete(quizState.current);
		scheduleViewportHeightSync({ index: quizState.current, animate: false, refresh: true });
	});
	try { __quizActiveSlideResizeObserver.observe(item); } catch (_) {}
}

function bindAllSlidesResizeObserver() {
	destroyAllSlidesResizeObserver();
	if (typeof ResizeObserver === "undefined") return;
	const { track, viewport } = getTrackElements();
	if (!track || !viewport) return;

	__quizAllSlidesResizeObserver = new ResizeObserver(entries => {
		const children = Array.from(track.children || []);
		let currentTouched = false;
		let slidingTouched = false;
		let touched = false;
		const { from, to } = getSlidingWindow();

		for (const entry of entries) {
			const index = children.indexOf(entry.target);
			if (index === -1) continue;
			touched = true;
			__quizSlideHeightCache.delete(index);
			if (index === quizState.current) currentTouched = true;
			if (quizState.isSliding && index >= from && index <= to) slidingTouched = true;
		}
		if (!touched) return;

		if (quizState.isSliding && slidingTouched) {
			const liveMaxHeight = getMaxRenderedSlideHeight({ refresh: true, padding: 24 });
			const currentViewportHeight = Math.max(
				1,
				Math.ceil(parseFloat(viewport.style.height || "0") || 0),
				Math.ceil(parseFloat(viewport.style.minHeight || "0") || 0),
				Math.ceil(viewport.getBoundingClientRect().height || 0),
				Math.ceil(viewport.clientHeight || 0)
			);
			if (liveMaxHeight > currentViewportHeight + 1) {
				viewport.style.transition = "none";
				viewport.style.willChange = "height";
				viewport.style.height = `${liveMaxHeight}px`;
				viewport.style.minHeight = `${liveMaxHeight}px`;
				viewport.dataset.quizHeightReady = "1";
				viewport.dataset.quizGrowDuringSlide = "1";
				viewport.__quizLockedHeight = liveMaxHeight;
			}
			return;
		}
		if (currentTouched) scheduleViewportHeightSync({ index: quizState.current, animate: false, refresh: true });
	});

	for (const child of track.children) {
		try { __quizAllSlidesResizeObserver.observe(child); } catch (_) {}
	}
}

function cancelRunningTrackAnimation() {
	const { track, viewport } = getTrackElements();
	clearTrackTransitionFallback();
	const currentX = readCurrentTrackTranslateX();
	const currentHeight = Math.max(
		1,
		Math.ceil(parseFloat(getComputedStyle(viewport || document.body).height) || 0),
		Math.ceil(viewport?.getBoundingClientRect?.().height || 0),
		Math.ceil(viewport?.clientHeight || 0)
	);

	if (track) {
		if (track.__quizTransitionEndHandler) {
			track.removeEventListener("transitionend", track.__quizTransitionEndHandler);
			track.__quizTransitionEndHandler = null;
		}
		try { track.getAnimations?.().forEach(anim => anim.cancel?.()); } catch (_) {}
		track.style.transition = "none";
		track.style.willChange = "";
		setTrackTransformPx(currentX);
	}
	if (viewport) {
		try { viewport.getAnimations?.().forEach(anim => anim.cancel?.()); } catch (_) {}
		viewport.style.transition = "none";
		viewport.style.willChange = "";
		viewport.style.height = `${currentHeight}px`;
		viewport.dataset.quizHeightReady = "1";
	}
	destroyActiveSlideResizeObserver();
	return { x: currentX, height: currentHeight };
}

function getElementStableHeight(el) {
	if (!el) return 0;
	const rootRect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
	const rootTop = rootRect ? rootRect.top : 0;
	let maxBottom = 0;
	const ownHeight = Math.max(
		Math.ceil(rootRect ? rootRect.height : 0),
		Math.ceil(el.scrollHeight || 0),
		Math.ceil(el.offsetHeight || 0),
		Math.ceil(el.clientHeight || 0),
		0
	);
	const nodes = [el, ...Array.from(el.querySelectorAll("*"))];
	for (const node of nodes) {
		if (!(node instanceof HTMLElement)) continue;
		const cs = getComputedStyle(node);
		if (cs.display === "none" || cs.position === "fixed") continue;
		const rect = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
		if (!rect) continue;
		const marginBottom = parseFloat(cs.marginBottom) || 0;
		const bottom = (rect.bottom - rootTop) + marginBottom;
		if (bottom > maxBottom) maxBottom = bottom;
	}
	return Math.max(1, Math.ceil(Math.max(ownHeight, maxBottom)));
}

function getSlideStableHeight(index = quizState.current, { refresh = false } = {}) {
	const cached = __quizSlideHeightCache.get(index);
	if (!refresh && Number.isFinite(cached) && cached > 0) return cached;
	const item = getTrackItem(index);
	const h = getElementStableHeight(item);
	if (h > 0) __quizSlideHeightCache.set(index, h);
	return h;
}

function getMaxRenderedSlideHeight({ refresh = false, padding = 24 } = {}) {
	const items = getTrackItems();
	if (!items.length) return Math.max(1, padding);
	let max = 0;
	items.forEach((item, index) => {
		if (!item) return;
		let h = 0;
		if (refresh) {
			h = getElementStableHeight(item);
			if (h > 0) __quizSlideHeightCache.set(index, h);
		} else {
			h = getSlideStableHeight(index, { refresh: false });
			if (!h || h <= 0) {
				h = getElementStableHeight(item);
				if (h > 0) __quizSlideHeightCache.set(index, h);
			}
		}
		if (h > max) max = h;
	});
	return Math.max(1, Math.ceil(max + Math.max(0, Number(padding) || 0)));
}

function setViewportHeight(height, { animate = false } = {}) {
	const { viewport } = getTrackElements();
	if (!viewport) return false;
	const h = Math.max(1, Math.ceil(Number(height) || 0));
	viewport.style.transition = animate ? "height 220ms cubic-bezier(0.16, 1, 0.3, 1)" : "none";
	viewport.style.height = `${h}px`;
	viewport.dataset.quizHeightReady = "1";
	return true;
}

function syncViewportHeight({ index = quizState.current, animate = false, refresh = false } = {}) {
	const h = getSlideStableHeight(index, { refresh });
	return h > 0 ? setViewportHeight(h, { animate }) : false;
}

function settleViewportHeightToIndex(index, { animate = true, refresh = true } = {}) {
	const { viewport } = getTrackElements();
	if (!viewport) return;
	const targetHeight = Math.max(1, getSlideStableHeight(index, { refresh }) || 0);
	if (!targetHeight) return;
	const currentHeight = Math.max(
		1,
		Math.ceil(parseFloat(viewport.style.height || "0") || 0),
		Math.ceil(viewport.getBoundingClientRect().height || 0),
		Math.ceil(viewport.clientHeight || 0)
	);
	if (Math.abs(currentHeight - targetHeight) <= 1) return void setViewportHeight(targetHeight, { animate: false });
	viewport.style.transition = animate ? "height 240ms cubic-bezier(0.16, 1, 0.3, 1)" : "none";
	viewport.style.height = `${targetHeight}px`;
	viewport.dataset.quizHeightReady = "1";
	if (animate) {
		__quizViewportSettleTimer = window.setTimeout(() => {
			const { viewport: vp } = getTrackElements();
			if (vp) vp.style.transition = "none";
		}, 280);
	}
}

function scheduleViewportHeightSync({ delay = 0, index = quizState.current, animate = false, refresh = false } = {}) {
	if (__quizHeightRaf) {
		cancelAnimationFrame(__quizHeightRaf);
		__quizHeightRaf = 0;
	}
	if (__quizHeightResyncTimer) {
		clearTimeout(__quizHeightResyncTimer);
		__quizHeightResyncTimer = 0;
	}
	const run = () => {
		__quizHeightRaf = requestAnimationFrame(() => {
			__quizHeightRaf = 0;
			syncViewportHeight({ index, animate, refresh });
			if (index === quizState.current) {
				bindCurrentSlideMediaHeightSync();
				bindActiveSlideResizeObserver();
			}
		});
	};
	if (delay > 0) {
		__quizHeightResyncTimer = window.setTimeout(() => {
			__quizHeightResyncTimer = 0;
			run();
		}, delay);
	} else run();
}

function primeAllSlideHeights({ retries = 8, syncCurrent = true } = {}) {
	const items = getTrackItems();
	if (items.length === 0) return;
	let zeroCount = 0;
	items.forEach((item, index) => {
		const h = getElementStableHeight(item);
		if (h > 0) __quizSlideHeightCache.set(index, h);
		else zeroCount++;
	});
	if (syncCurrent) syncViewportHeight({ index: quizState.current, animate: false, refresh: true });
	if (zeroCount > 0 && retries > 0) {
		__quizPrimeHeightsRaf = requestAnimationFrame(() => {
			__quizPrimeHeightsRaf = 0;
			primeAllSlideHeights({ retries: retries - 1, syncCurrent });
		});
	}
}

async function decodeImageSafe(img) {
	if (!img) return;
	try { img.loading = "eager"; img.decoding = "async"; } catch (_) {}
	if (img.complete) {
		if (typeof img.decode === "function") {
			try { await img.decode(); } catch (_) {}
		}
		return;
	}
	await new Promise(resolve => {
		const done = () => resolve();
		img.addEventListener("load", done, { once: true });
		img.addEventListener("error", done, { once: true });
	});
}

async function warmSlideForAccurateHeight(index, { timeoutMs = 1200, stableFramesRequired = 3, maxFrames = 32 } = {}) {
	if (index < 0 || index >= TOTAL_SLIDES) return;
	const existing = __quizWarmSlidePromises.get(index);
	if (existing) return existing;
	const epoch = currentAsyncEpoch();
	const generation = getSlideGeneration(index);

	const p = (async () => {
		if (!isQuizInstanceAlive(epoch) || !isSlideGenerationCurrent(index, generation)) return;
		const item = getTrackItem(index);
		if (!item) return;
		const imgs = Array.from(item.querySelectorAll("img"));
		for (const img of imgs) {
			try {
				img.loading = "eager";
				img.decoding = "async";
				img.fetchPriority = "high";
			} catch (_) {}
		}
		await Promise.race([
			Promise.allSettled(imgs.map(img => decodeImageSafe(img))),
			sleep(timeoutMs, epoch)
		]);
		if (!isQuizInstanceAlive(epoch) || !isSlideGenerationCurrent(index, generation)) return;
		let last = 0;
		let stableCount = 0;
		for (let frame = 0; frame < maxFrames; frame++) {
			const alive = await waitFrames(1, epoch);
			if (!alive || !isQuizInstanceAlive(epoch) || !isSlideGenerationCurrent(index, generation)) return;
			const h = getElementStableHeight(item);
			if (h > 0 && isSlideGenerationCurrent(index, generation)) __quizSlideHeightCache.set(index, h);
			if (h > 0 && Math.abs(h - last) <= 1) stableCount++;
			else stableCount = 0;
			last = h;
			if (stableCount >= stableFramesRequired) break;
		}
		if (!isQuizInstanceAlive(epoch) || !isSlideGenerationCurrent(index, generation)) return;
		if (index === quizState.current) scheduleViewportHeightSync({ index, animate: false, refresh: true });
	})();

	__quizWarmSlidePromises.set(index, p);
	try { await p; } finally {
		if (__quizWarmSlidePromises.get(index) === p) __quizWarmSlidePromises.delete(index);
	}
}

function warmSlidesAroundIndex(center, radius = 2) {
	for (let offset = 0; offset <= radius; offset++) {
		const left = center - offset;
		const right = center + offset;
		if (left >= 0) warmSlideForAccurateHeight(left).catch(() => {});
		if (right < TOTAL_SLIDES && right !== left) warmSlideForAccurateHeight(right).catch(() => {});
	}
}

function startFullBackgroundWarm() {
	if (__quizBackgroundWarmStarted) return;
	__quizBackgroundWarmStarted = true;
	const epoch = currentAsyncEpoch();
	const run = async () => {
		await waitFrames(2);
		if (!isQuizInstanceAlive(epoch)) return;
		const total = TOTAL_SLIDES;
		const center = clamp(quizState.current, 0, total - 1);
		const nearRadius = Math.min(4, Math.max(2, total - 1));
		const seen = new Set();
		const near = [];
		for (let offset = 0; offset <= nearRadius; offset++) {
			const right = center + offset;
			const left = center - offset;
			if (right >= 0 && right < total && !seen.has(right)) { seen.add(right); near.push(right); }
			if (left >= 0 && left < total && !seen.has(left)) { seen.add(left); near.push(left); }
		}
		const rest = [...Array(total).keys()].filter(i => !seen.has(i)).sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
		for (const i of near) {
			if (!isQuizInstanceAlive(epoch)) return;
			await warmSlideForAccurateHeight(i, { timeoutMs: 700, stableFramesRequired: 2, maxFrames: 12 }).catch(() => {});
		}
		for (const i of rest) {
			if (!isQuizInstanceAlive(epoch)) return;
			const idleOk = await requestQuizIdle(600, epoch);
			if (!idleOk || !isQuizInstanceAlive(epoch)) return;
			await warmSlideForAccurateHeight(i, { timeoutMs: 500, stableFramesRequired: 2, maxFrames: 8 }).catch(() => {});
		}
		if (!isQuizInstanceAlive(epoch)) return;
		primeAllSlideHeights({ retries: 2, syncCurrent: true });
	};
	run();
}

function bindTrackItemImages(slide, slideIndex) {
	if (!slide) return;
	const generation = getSlideGeneration(slideIndex);
	slide.querySelectorAll("img").forEach(img => {
		if (img.dataset.quizPrimeBound === "1") return;
		img.dataset.quizPrimeBound = "1";
		try {
			img.loading = "eager";
			img.decoding = "async";
			img.fetchPriority = "high";
		} catch (_) {}
		const onAssetSettled = () => {
			if (__quizDestroyed || !isSlideGenerationCurrent(slideIndex, generation)) return;
			__quizSlideHeightCache.delete(slideIndex);
			primeAllSlideHeights({ retries: 2, syncCurrent: slideIndex === quizState.current });
			if (slideIndex === quizState.current) {
				scheduleViewportHeightSync({ index: slideIndex, animate: false, refresh: true });
			}
		};
		img.addEventListener("load", onAssetSettled, { passive: true });
		img.addEventListener("error", onAssetSettled, { passive: true });
		if (img.complete) {
			if (typeof img.decode === "function") img.decode().then(onAssetSettled).catch(onAssetSettled);
			else onAssetSettled();
		}
	});
}

function bindAllTrackImages() {
	const { track } = getTrackElements();
	if (!track) return;
	Array.from(track.children || []).forEach((slide, slideIndex) => bindTrackItemImages(slide, slideIndex));
}

function bindCurrentSlideMediaHeightSync() {
	const index = quizState.current;
	const item = getTrackItem(index);
	if (!item) return;
	const token = ++__quizMediaSyncToken;
	const generation = getSlideGeneration(index);
	item.querySelectorAll("img").forEach(img => {
		if (img.dataset.quizHeightBound === "1") return;
		img.dataset.quizHeightBound = "1";
		const resync = () => {
			if (token !== __quizMediaSyncToken || !isSlideGenerationCurrent(index, generation)) return;
			__quizSlideHeightCache.delete(index);
			scheduleViewportHeightSync({ index, animate: false, refresh: true });
		};
		img.addEventListener("load", resync, { once: true });
		img.addEventListener("error", resync, { once: true });
		if (img.complete) {
			if (typeof img.decode === "function") img.decode().then(resync).catch(resync);
			else resync();
		}
	});
}

function resyncCommandTextareasOnSlide(index) {
	const item = getTrackItem(index);
	if (!item) return;
	item.querySelectorAll('.quiz-textarea-command').forEach(ta => {
		try { ta.dispatchEvent(new Event('scroll')); } catch (_) {}
	});
}

function applyTrackPositionAndHeightInstant() {
	const { track } = getTrackElements();
	if (!track) return false;
	syncTrackViewportIsolation();
	applyTrackGeometry({ refreshWidth: true });
	track.style.transition = "none";
	track.style.willChange = "";
	setTrackTransformPx(getSlideTranslateX(quizState.current));
	const ok = syncViewportHeight({ index: quizState.current, animate: false, refresh: true });
	bindCurrentSlideMediaHeightSync();
	bindActiveSlideResizeObserver();
	syncTrackViewportIsolation();
	return ok;
}

function ensureTrackVisibleAfterLayout(retries = 24, epoch = currentAsyncEpoch()) {
	cancelEnsureTrackVisibleRaf();
	if (!isQuizInstanceAlive(epoch)) return;
	const { track } = getTrackElements();
	if (!track) return;
	syncTrackViewportIsolation();
	applyTrackGeometry({ refreshWidth: true });
	track.style.transition = "none";
	track.style.willChange = "";
	setTrackTransformPx(getSlideTranslateX(quizState.current));
	const h = getSlideStableHeight(quizState.current, { refresh: true });
	if (h > 0) {
		setViewportHeight(h, { animate: false });
		bindCurrentSlideMediaHeightSync();
		bindActiveSlideResizeObserver();
		syncTrackViewportIsolation();
		return;
	}
	if (retries <= 0) {
		scheduleViewportHeightSync({ index: quizState.current, animate: false, refresh: true });
		return;
	}
	__quizEnsureVisibleRaf = requestAnimationFrame(() => {
		__quizEnsureVisibleRaf = 0;
		ensureTrackVisibleAfterLayout(retries - 1, epoch);
	});
}

function bindTrackFirstLoadFix() {
	if (__quizTrackFixBound) return;
	__quizTrackFixBound = true;
	const resyncLayout = () => requestAnimationFrame(() => {
		if (__quizDestroyed) return;
		const { track } = getTrackElements();
		if (track) {
			track.style.transition = "none";
			track.style.willChange = "";
			track.style.backfaceVisibility = "hidden";
			track.style.transformStyle = "preserve-3d";
			setTrackTransformPx(getSlideTranslateX(quizState.current));
		}
		__quizSlideHeightCache.delete(quizState.current);
		primeAllSlideHeights({ retries: 3, syncCurrent: true });
		scheduleViewportHeightSync({ index: quizState.current, animate: false, refresh: true });
	});
	if (document.fonts?.ready) {
		const epoch = currentAsyncEpoch();
		document.fonts.ready.then(() => {
			if (!isQuizInstanceAlive(epoch)) return;
			resyncLayout();
			primeAllSlideHeights({ retries: 3, syncCurrent: true });
		}).catch(() => {});
	}
}

function slideDuration(dist) {
	if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return 0;
	const d = Math.max(1, Number(dist) || 1);
	return Math.min(1200, 860 + (d - 3) * 90);
}
function getTrackEaseForDistance(hops) {
	if (hops <= 1) return "cubic-bezier(0.22, 0.88, 0.24, 1)";
	if (hops <= 3) return "cubic-bezier(0.24, 0.84, 0.22, 1)";
	return "cubic-bezier(0.26, 0.80, 0.20, 1)";
}

function finishTrackSlideAnimation(token, targetIndex) {
	if (token !== quizState.slideToken) return;
	const { track, viewport } = getTrackElements();
	const shouldLockResultsNow = isResultsSlideIndex(targetIndex) && quizState.pendingResultsLock;
	const grewDuringSlide = viewport?.dataset.quizGrowDuringSlide === "1";
	clearTrackTransitionFallback();
	if (track && track.__quizTransitionEndHandler) {
		track.removeEventListener("transitionend", track.__quizTransitionEndHandler);
		track.__quizTransitionEndHandler = null;
	}
	try { track?.getAnimations?.().forEach(anim => anim.cancel?.()); } catch (_) {}
	try { viewport?.getAnimations?.().forEach(anim => anim.cancel?.()); } catch (_) {}

	const finalX = Number.isFinite(track?.__quizTargetX) ? track.__quizTargetX : getSlideTranslateX(targetIndex);
	const refreshedTargetHeight = Math.max(
		1,
		Number(viewport?.__quizTargetHeight) || 0,
		getSlideStableHeight(targetIndex, { refresh: true }) || 0,
		getElementStableHeight(getTrackItem(targetIndex)) || 0
	);
	const finalHeight = Math.max(1, Math.ceil(refreshedTargetHeight + 4));

	if (track) {
		track.style.transition = "none";
		track.style.willChange = "";
		setTrackTransformPx(finalX);
	}
	if (viewport) {
		viewport.style.transition = "none";
		viewport.style.willChange = "";
		viewport.style.height = `${finalHeight}px`;
		viewport.style.minHeight = "";
		viewport.dataset.quizHeightReady = "1";
		delete viewport.dataset.quizGrowDuringSlide;
	}
	if (!shouldLockResultsNow) {
		quizState.isSliding = false;
		setSlidingClass(false);
	}
	if (shouldLockResultsNow) quizState.locked = true;
	if (!isResultsSlideIndex(targetIndex)) quizState.pendingResultsLock = false;
	updateNavHighlight();

	requestAnimationFrame(() => requestAnimationFrame(() => {
		if (token !== quizState.slideToken || __quizDestroyed) return;
		syncTrackViewportIsolation();
		settleViewportHeightToIndex(targetIndex, { animate: false, refresh: true });
		scheduleViewportHeightSync({ delay: grewDuringSlide ? 180 : 320, index: targetIndex, animate: false, refresh: true });
		primeAllSlideHeights({ retries: 2, syncCurrent: false });
		if (shouldLockResultsNow) {
			quizState.pendingResultsLock = false;
			requestAnimationFrame(() => {
				if (token !== quizState.slideToken || __quizDestroyed) return;
				quizState.isSliding = false;
				setSlidingClass(false);
				render();
			});
			return;
		}
		bindCurrentSlideMediaHeightSync();
		bindActiveSlideResizeObserver();
		resyncCommandTextareasOnSlide(targetIndex);
	}));
}

function animateTrackToIndex(targetIndex, { fromX = null, fromHeight = null, refreshTargetHeight = true } = {}) {
	const { track, viewport } = getTrackElements();
	if (!track || !viewport) {
		quizState.isSliding = false;
		setSlidingClass(false);
		return;
	}
	clearTrackTransitionFallback();
	destroyActiveSlideResizeObserver();
	quizState.isSliding = true;
	setSlidingClass(true);
	syncTrackViewportIsolation();
	applyTrackGeometry({ refreshWidth: true });
	const token = quizState.slideToken;
	const targetX = getSlideTranslateX(targetIndex);
	const startX = Number.isFinite(fromX) ? alignToDevicePixel(fromX) : readCurrentTrackTranslateX();
	const startHeight = Math.max(
		1,
		Number(fromHeight) || 0,
		getSlideStableHeight(quizState.prevCurrent, { refresh: true }) || 0,
		getElementStableHeight(getTrackItem(quizState.prevCurrent)) || 0,
		Math.ceil(viewport.getBoundingClientRect().height || 0),
		Math.ceil(viewport.clientHeight || 0)
	);
	const targetHeight = Math.max(
		1,
		getSlideStableHeight(targetIndex, { refresh: refreshTargetHeight }) || 0,
		getElementStableHeight(getTrackItem(targetIndex)) || 0,
		startHeight
	);
	const lockedHeight = Math.max(1, Math.ceil(startHeight), Math.ceil(targetHeight), Math.ceil(getMaxRenderedSlideHeight({ refresh: true, padding: 24 })));
	const deltaPx = Math.abs(targetX - startX);
	const viewportWidth = Math.max(1, viewport.clientWidth || Math.ceil(viewport.getBoundingClientRect().width) || 1);
	const dist = Math.max(1, deltaPx / viewportWidth);
	const dur = slideDuration(dist);
	const trackEase = getTrackEaseForDistance(dist);

	track.__quizTargetX = targetX;
	track.__quizTargetIndex = targetIndex;
	viewport.__quizTargetHeight = targetHeight;
	viewport.__quizLockedHeight = lockedHeight;
	viewport.dataset.quizGrowDuringSlide = "0";

	if (dur <= 0) {
		setTrackTransformPx(targetX);
		setViewportHeight(targetHeight, { animate: false });
		viewport.style.minHeight = "";
		finishTrackSlideAnimation(token, targetIndex);
		return;
	}

	primeTrackAndViewportForSlideStart(startX, lockedHeight);
	requestAnimationFrame(() => {
		if (token !== quizState.slideToken || __quizDestroyed) return;
		const { track: liveTrack, viewport: liveViewport } = getTrackElements();
		if (!liveTrack || !liveViewport) return;
		liveViewport.style.transition = "none";
		liveViewport.style.willChange = "height";
		liveViewport.style.height = `${lockedHeight}px`;
		liveViewport.style.minHeight = `${lockedHeight}px`;
		liveViewport.dataset.quizHeightReady = "1";
		liveViewport.__quizLockedHeight = lockedHeight;
		liveTrack.style.transition = `transform ${dur}ms ${trackEase}`;
		setTrackTransformPx(targetX);
	});

	const onEnd = e => {
		if (token !== quizState.slideToken || e.target !== track || e.propertyName !== "transform") return;
		finishTrackSlideAnimation(token, targetIndex);
	};
	track.__quizTransitionEndHandler = onEnd;
	track.addEventListener("transitionend", onEnd);
	__quizTrackTransitionFallbackTimer = window.setTimeout(() => finishTrackSlideAnimation(token, targetIndex), dur + 160);
}

function getHintThemeMode() {
	const body = document.body;
	const root = document.documentElement;
	if (body?.classList.contains("theme-light") || root?.classList.contains("theme-light")) return "light";
	if (body?.classList.contains("theme-dark") || root?.classList.contains("theme-dark")) return "dark";
	const cs = getComputedStyle(body || root);
	const bg = (cs.getPropertyValue("--background-primary") || "").trim().toLowerCase();
	return bg && (bg.includes("#fff") || bg.includes("255")) ? "light" : "dark";
}

function applyHintModalTheme() {
	const overlay = document.getElementById(HINT_OVERLAY_ID);
	if (!overlay) return;
	const modal = overlay.querySelector(".quiz-hint-modal");
	const header = overlay.querySelector(".quiz-hint-modal-header");
	const title = overlay.querySelector(".quiz-hint-modal-title");
	const bodyEl = overlay.querySelector(".quiz-hint-modal-body");
	const closeBtn = overlay.querySelector(".quiz-hint-modal-close");
	const mode = getHintThemeMode();
	overlay.dataset.theme = mode;
	const base = getComputedStyle(document.body);
	const bgPrimary = (base.getPropertyValue("--background-primary") || "").trim() || (mode === "dark" ? "#111827" : "#ffffff");
	const bgSecondary = (base.getPropertyValue("--background-secondary") || "").trim() || (mode === "dark" ? "#1f2937" : "#f5f6fa");
	const textNormal = (base.getPropertyValue("--text-normal") || "").trim() || (mode === "dark" ? "#e5e7eb" : "#1f2937");
	const border = (base.getPropertyValue("--background-modifier-border") || "").trim() || (mode === "dark" ? "rgba(148,163,184,.25)" : "rgba(31,41,55,.14)");
	const shadow = mode === "dark" ? "0 18px 48px rgba(2,6,23,.45)" : "0 18px 48px rgba(15,23,42,.14)";
	const overlayBg = mode === "dark" ? "rgba(2,6,23,.42)" : "rgba(15,23,42,.16)";
	overlay.style.background = overlayBg;
	if (modal) {
		modal.style.background = bgPrimary;
		modal.style.color = textNormal;
		modal.style.border = `1px solid ${border}`;
		modal.style.boxShadow = shadow;
	}
	if (header) {
		header.style.background = bgSecondary;
		header.style.borderBottom = `1px solid ${border}`;
	}
	if (title) title.style.color = textNormal;
	if (bodyEl) bodyEl.style.color = textNormal;
	if (closeBtn) {
		closeBtn.style.color = textNormal;
		closeBtn.style.border = `1px solid ${border}`;
		closeBtn.style.background = mode === "dark" ? "rgba(255,255,255,.06)" : "rgba(15,23,42,.04)";
	}
}

function ensureHintModal() {
	let overlay = document.getElementById(HINT_OVERLAY_ID);
	if (overlay) {
		applyHintModalTheme();
		return overlay;
	}
	overlay = document.createElement("div");
	overlay.id = HINT_OVERLAY_ID;
	overlay.className = "quiz-hint-modal-overlay";
	overlay.innerHTML = `
		<div class="quiz-hint-modal" role="dialog" aria-modal="true" aria-labelledby="${HINT_TITLE_ID}">
			<div class="quiz-hint-modal-header">
				<div class="quiz-hint-modal-title" id="${HINT_TITLE_ID}">Indice</div>
				<button class="quiz-hint-modal-close" type="button" aria-label="Fermer">×</button>
			</div>
			<div class="quiz-hint-modal-body"></div>
		</div>`;
	overlay.addEventListener("click", e => { if (e.target === overlay) closeHintModal(); });
	const modal = overlay.querySelector(".quiz-hint-modal");
	if (modal) modal.addEventListener("click", e => e.stopPropagation());
	const closeBtn = overlay.querySelector(".quiz-hint-modal-close");
	if (closeBtn) closeBtn.addEventListener("click", e => { e.preventDefault(); closeHintModal(); });
	document.body.appendChild(overlay);
	applyHintModalTheme();

	const escHandler = e => {
		const o = document.getElementById(HINT_OVERLAY_ID);
		if (!o || !o.classList.contains("is-open")) return;
		if (e.key === "Escape") return closeHintModal();
		if (e.key !== "Tab") return;
		const focusable = o.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])');
		if (focusable.length === 0) return;
		const first = focusable[0], last = focusable[focusable.length - 1];
		if (e.shiftKey) {
			if (document.activeElement === first) { e.preventDefault(); last.focus(); }
		} else if (document.activeElement === last) {
			e.preventDefault();
			first.focus();
		}
	};
	document.addEventListener("keydown", escHandler);
	__quizGlobalCleanups.push(() => document.removeEventListener("keydown", escHandler));

	if (typeof MutationObserver !== "undefined") {
		const themeObserver = new MutationObserver(() => {
			if (document.getElementById(HINT_OVERLAY_ID)) applyHintModalTheme();
		});
		themeObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
		if (document.documentElement) themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
		__quizGlobalCleanups.push(() => themeObserver.disconnect());
	}
	return overlay;
}

function openHintModal(text) {
	const overlay = ensureHintModal();
	const body = overlay.querySelector(".quiz-hint-modal-body");
	const modal = overlay.querySelector(".quiz-hint-modal");
	if (body) body.innerHTML = renderHintWithCodeAndEmbeds(text);
	applyHintModalTheme();
	if (__quizHintCloseTimer) { clearTimeout(__quizHintCloseTimer); __quizHintCloseTimer = 0; }
	if (__quizHintOpenRaf1) cancelAnimationFrame(__quizHintOpenRaf1);
	if (__quizHintOpenRaf2) cancelAnimationFrame(__quizHintOpenRaf2);
	overlay.classList.add("is-open");
	overlay.style.transition = "none";
	overlay.style.opacity = "0";
	if (modal) {
		modal.style.transition = "none";
		modal.style.opacity = "0";
		modal.style.transform = "translateY(10px) scale(0.84)";
		modal.style.willChange = "transform, opacity";
		modal.style.transformOrigin = "center center";
	}
	void overlay.offsetWidth;
	__quizHintOpenRaf1 = requestAnimationFrame(() => {
		__quizHintOpenRaf2 = requestAnimationFrame(() => {
			overlay.style.transition = "opacity 320ms cubic-bezier(0.22, 1, 0.36, 1)";
			overlay.style.opacity = "1";
			if (modal) {
				modal.style.transition = "transform 420ms cubic-bezier(0.16, 1, 0.3, 1), opacity 320ms cubic-bezier(0.22, 1, 0.36, 1)";
				modal.style.opacity = "1";
				modal.style.transform = "translateY(0) scale(1)";
			}
			const focusTarget = overlay.querySelector(".quiz-hint-modal-close");
			if (focusTarget) {
				if (__quizHintFocusTimer) clearTimeout(__quizHintFocusTimer);
				const epoch = currentAsyncEpoch();
				__quizHintFocusTimer = window.setTimeout(() => {
					__quizHintFocusTimer = 0;
					if (!isQuizInstanceAlive(epoch) || !overlay.classList.contains("is-open")) return;
					try { focusTarget.focus(); } catch (_) {}
				}, 340);
			}
		});
	});
}

function closeHintModal() {
	const overlay = document.getElementById(HINT_OVERLAY_ID);
	if (!overlay || !overlay.classList.contains("is-open")) return;
	const modal = overlay.querySelector(".quiz-hint-modal");
	if (__quizHintOpenRaf1) cancelAnimationFrame(__quizHintOpenRaf1);
	if (__quizHintOpenRaf2) cancelAnimationFrame(__quizHintOpenRaf2);
	overlay.style.transition = "opacity 240ms cubic-bezier(0.4, 0, 0.2, 1)";
	overlay.style.opacity = "0";
	if (modal) {
		modal.style.transition = "transform 260ms cubic-bezier(0.4, 0, 0.2, 1), opacity 220ms cubic-bezier(0.4, 0, 0.2, 1)";
		modal.style.opacity = "0";
		modal.style.transform = "translateY(8px) scale(0.94)";
	}
	if (__quizHintCloseTimer) clearTimeout(__quizHintCloseTimer);
	__quizHintCloseTimer = setTimeout(() => {
		overlay.classList.remove("is-open");
		overlay.style.transition = "";
		overlay.style.opacity = "";
		if (modal) {
			modal.style.transition = "";
			modal.style.opacity = "";
			modal.style.transform = "";
			modal.style.willChange = "";
			modal.style.transformOrigin = "";
		}
		__quizHintCloseTimer = 0;
	}, 300);
}

function hasAnyAnswer(i) {
	const q = quiz[i], sel = quizState.selections[i];

	if (isTextQuestion(q)) {
		return typeof sel === "string" && sel.trim().length > 0;
	}

	if (isOrderingQuestion(q) || isMatchingQuestion(q)) {
		return Array.isArray(sel) && sel.some(v => v !== null);
	}

	if (q.multiSelect) return sel instanceof Set && sel.size > 0;
	return sel !== null;
}

function isComplete(i) {
	const q = quiz[i], sel = quizState.selections[i];

	if (isTextQuestion(q)) {
		return typeof sel === "string" && sel.trim().length > 0;
	}

	if (isOrderingQuestion(q) || isMatchingQuestion(q)) {
		return Array.isArray(sel) && sel.length > 0 && sel.every(v => v !== null);
	}

	if (q.multiSelect) return sel instanceof Set && sel.size > 0;
	return sel !== null;
}

function getMissingIndices() {
	const missing = [];
	for (let i = 0; i < quiz.length; i++) if (!isComplete(i)) missing.push(i);
	return missing;
}

function isCorrect(i) {
	const q = quiz[i], sel = quizState.selections[i];

	if (isTextQuestion(q)) {
		return terminal.isTextAnswerCorrect(q, sel);
	}

	if (isOrderingQuestion(q)) {
		const co = questions.getOrderingCorrectOrder(q);
		if (!Array.isArray(sel) || sel.length !== co.length) return false;
		return co.every((v, k) => sel[k] === v);
	}

	if (isMatchingQuestion(q)) {
		const rows = questions.getMatchRows(q), cm = questions.getMatchCorrectMap(q);
		if (!Array.isArray(sel) || sel.length !== rows.length || !Array.isArray(cm) || cm.length !== rows.length) return false;
		return cm.every((v, k) => sel[k] === v);
	}

	if (q.multiSelect) {
		if (!(sel instanceof Set) || !Array.isArray(q.correctIndices) || sel.size !== q.correctIndices.length) return false;
		return q.correctIndices.every(ci => sel.has(ci));
	}

	return sel !== null && sel === q.correctIndex;
}

function computeScorePercent() {
	let correct = 0;
	for (let i = 0; i < quiz.length; i++) if (isCorrect(i)) correct++;
	return { pct: Math.round((correct / quiz.length) * 100), correct, total: quiz.length };
}

const getSubmitSlideSignature = () => JSON.stringify({ missing: getMissingIndices(), lastQuestionIndex: quizState.lastQuestionIndex });
const getResultsSlideSignature = () => {
	const { pct, correct, total } = computeScorePercent();
	return JSON.stringify({ locked: quizState.locked, pct, correct, total });
};

const NAV_TAB_PRESS_MS = 130;
const NAV_TAB_FALLBACK_CLEAR_MS = 320;

function clearNavTabPressState(tab) {
	if (!tab) return;
	if (tab.__quizPressClearTimer) {
		clearTimeout(tab.__quizPressClearTimer);
		tab.__quizPressClearTimer = 0;
	}
	delete tab.dataset.quizPressing;
	tab.classList.remove("is-pressing");
}

function setNavTabPressState(tab, on) {
	if (!tab) return;
	if (on) {
		if (tab.__quizPressClearTimer) {
			clearTimeout(tab.__quizPressClearTimer);
			tab.__quizPressClearTimer = 0;
		}
		tab.dataset.quizPressing = "1";
		tab.classList.add("is-pressing");
		tab.__quizPressClearTimer = window.setTimeout(() => clearNavTabPressState(tab), NAV_TAB_FALLBACK_CLEAR_MS);
		return;
	}
	clearNavTabPressState(tab);
}

const clearAllNavTabPressStates = () => {
	container.querySelectorAll(".quiz-tab").forEach(tab => clearNavTabPressState(tab));
};
const buildNavTabClass = (baseClass, tab) => `${baseClass}${tab?.dataset?.quizPressing === "1" ? " is-pressing" : ""}`.trim();

async function playNavTabPressAndNavigate(tab, navigateFn, { fromKeyboard = false } = {}) {
	if (!tab || typeof navigateFn !== "function") return;

	if (fromKeyboard || tab.dataset.quizPressing !== "1") {
		clearAllNavTabPressStates();
		setNavTabPressState(tab, true);
	}

	navigateFn();

	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			clearNavTabPressState(tab);
		});
	});
}

async function goToSlide(index, { forceRender = false } = {}) {
	closeHintModal();
	const next = clampSlideIndex(index);
	if (next === quizState.current && !quizState.isSliding) return;
	if (quizState.isSliding) return redirectSlide(next, { forceRender });
	++quizState.slideToken;
	const token = quizState.slideToken;
	quizState.prevCurrent = quizState.current;
	quizState.current = next;
	if (isQuestionSlideIndex(next)) quizState.lastQuestionIndex = next;
	updateNavHighlight();
	quizState.isSliding = true;
	setSlidingClass(true);
	if (forceRender) render();
	await Promise.allSettled([warmSlideForAccurateHeight(quizState.prevCurrent), warmSlideForAccurateHeight(quizState.current)]);
	if (token !== quizState.slideToken) return;
	animateTrackToIndex(quizState.current, {
		fromX: getSlideTranslateX(quizState.prevCurrent),
		fromHeight: Math.max(
			getSlideStableHeight(quizState.prevCurrent, { refresh: true }) || 0,
			Math.ceil(getTrackElements().viewport?.getBoundingClientRect?.().height || 0),
			Math.ceil(getTrackElements().viewport?.clientHeight || 0)
		),
		refreshTargetHeight: true
	});
}

async function redirectSlide(next, { forceRender = false } = {}) {
	const targetIndex = clampSlideIndex(next);
	if (targetIndex === quizState.current) return;
	const snapshot = cancelRunningTrackAnimation();
	++quizState.slideToken;
	const token = quizState.slideToken;
	quizState.prevCurrent = quizState.current;
	quizState.current = targetIndex;
	if (isQuestionSlideIndex(targetIndex)) quizState.lastQuestionIndex = targetIndex;
	updateNavHighlight();
	quizState.isSliding = true;
	setSlidingClass(true);
	if (forceRender) render();
	await warmSlideForAccurateHeight(quizState.current).catch(() => {});
	if (token !== quizState.slideToken) return;
	animateTrackToIndex(quizState.current, { fromX: snapshot.x, fromHeight: snapshot.height, refreshTargetHeight: true });
}

function updateNavHighlight() {
	container.querySelectorAll("[data-nav]").forEach(tab => {
		const i = Number(tab.dataset.nav);
		tab.className = buildNavTabClass(`quiz-tab ${tabClass(i)}`.trim(), tab);
	});
	const resultsTab = container.querySelector("[data-nav-results]");
	if (resultsTab) {
		const active = (isSubmitSlideIndex(quizState.current) || isResultsSlideIndex(quizState.current)) ? "active" : "";
		resultsTab.className = buildNavTabClass(`quiz-tab is-result ${active}`.trim(), resultsTab);
	}
}

const goToQuestion = index => {
	quizState.pendingResultsLock = false;
	goToSlide(clamp(index, 0, quiz.length - 1), { forceRender: false });
};
function goToSubmit() {
	if (isQuestionSlideIndex(quizState.current)) quizState.lastQuestionIndex = quizState.current;
	quizState.pendingResultsLock = false;
	goToSlide(SLIDE_SUBMIT_INDEX, { forceRender: false });
}
function goToResults() {
	if (isQuestionSlideIndex(quizState.current)) quizState.lastQuestionIndex = quizState.current;
	quizState.pendingResultsLock = true;

	// Si mode examen et que le timer tourne encore, on l'arrête (sans reset)
	if (isExamMode && examStarted && !examEnded) {
		examEnded = true;
		stopExamTimer();
		// Mettre à jour l'affichage du timer avec le temps restant figé
		updateExamTimerDisplay();
	}

	updateNavHighlight();
	goToSlide(SLIDE_RESULTS_INDEX, { forceRender: false });
}

function resetQuiz({ preserveSliding = false } = {}) {
	closeHintModal();
	clearTrackTransitionFallback();
	destroyActiveSlideResizeObserver();
	destroyAllSlidesResizeObserver();
	destroyViewportResizeObserver();
	clearBackgroundWarmIdleHandle();
	cancelEnsureTrackVisibleRaf();

	__quizBackgroundWarmStarted = false;

	quizState.selections = initSelections();
	quizState.current = 0;
	quizState.prevCurrent = 0;
	quizState.lastQuestionIndex = 0;
	quizState.locked = false;
	quizState.pendingResultsLock = false;
	quizState.shuffleMap = buildShuffleMap();
	quizState.orderingPick = initOrderingPicks();
	quizState.matchPick = initMatchPicks();
	quizState.slideToken++;

	if (!preserveSliding) quizState.isSliding = false;
	setSlidingClass(false);

	__quizSlideHeightCache.clear();
	__quizWarmSlidePromises.clear();

	// Réinitialiser l'état du mode examen
	examStarted = false;
	examEnded = false;
	examStartTime = 0;
	examTimeRemaining = examDurationMs;
	stopExamTimer();

	render();
}

const orderingSelectionIncludes = (qi, origIdx) => {
	const sel = quizState.selections[qi];
	return Array.isArray(sel) ? sel.includes(origIdx) : false;
};
function removeOrderingItemFromSlot(qi, slotIndex) {
	const sel = quizState.selections[qi];
	if (Array.isArray(sel) && slotIndex >= 0 && slotIndex < sel.length) sel[slotIndex] = null;
}
function placeOrderingItemInSlot(qi, slotIndex, origIdx) {
	const sel = quizState.selections[qi];
	if (!Array.isArray(sel) || slotIndex < 0 || slotIndex >= sel.length) return;
	const existingSlot = sel.indexOf(origIdx);
	const currentAtTarget = sel[slotIndex];
	if (existingSlot === slotIndex) return;
	if (existingSlot !== -1) sel[existingSlot] = null;
	if (currentAtTarget !== null && existingSlot !== -1) sel[existingSlot] = currentAtTarget;
	sel[slotIndex] = origIdx;
}

const QUIZ_RESOURCE_NOTICE_MS = { defaultApp: 3400, androidSystem: 7200, fallbackOpen: 2400, warning: 3200, error: 3200 };
function quizNotice(msg, timeout = 4000) {
	try { new Notice(String(msg), timeout); } catch (_) { console.log("[Quiz]", msg); }
}
function findVaultFilesByExactName(fileName) {
	const target = String(fileName ?? "").trim().toLowerCase();
	if (!target || typeof app === "undefined" || !app?.vault?.getFiles) return [];
	return app.vault.getFiles().filter(f => String(f?.name ?? "").trim().toLowerCase() === target);
}

async function revealFileInObsidianExplorer(file) {
	if (!file) return false;
	try {
		let leaf = (app.workspace?.getLeavesOfType?.("file-explorer") || [])[0];
		if (!leaf && typeof app.workspace?.getLeftLeaf === "function") {
			leaf = app.workspace.getLeftLeaf(false);
			if (leaf && typeof leaf.setViewState === "function") await leaf.setViewState({ type: "file-explorer", active: false });
		}
		if (!leaf) return false;
		await new Promise(r => setTimeout(r, 60));
		const view = leaf?.view;
		if (view && typeof view.revealInFolder === "function") {
			await view.revealInFolder(file);
			try { app.workspace?.revealLeaf?.(leaf); } catch (_) {}
			return true;
		}
	} catch (e) {
		console.warn("[Quiz] revealInFolder a échoué:", e);
	}
	return false;
}

async function openVaultFileFallback(file) {
	try {
		const leaf = app.workspace?.getLeaf?.(true);
		if (leaf && typeof leaf.openFile === "function") {
			await leaf.openFile(file);
			return true;
		}
	} catch (e) {
		console.warn("[Quiz] leaf.openFile a échoué:", e);
	}
	try {
		const url = app.vault?.getResourcePath?.(file);
		if (url) {
			window.open(url, "_blank");
			return true;
		}
	} catch (e) {
		console.warn("[Quiz] getResourcePath/window.open a échoué:", e);
	}
	return false;
}

async function openWithDefaultAppFromVault(file) {
	if (!file) return { ok: false, mode: "failed" };
	const isMobile = !!app?.isMobile;
	try {
		if (typeof app?.openWithDefaultApp === "function") {
			await app.openWithDefaultApp(file.path);
			return { ok: true, mode: isMobile ? "system-chooser" : "default-app" };
		}
	} catch (e) {
		console.warn("[Quiz] app.openWithDefaultApp a échoué:", e);
	}
	try {
		const adapter = app?.vault?.adapter;
		const absPath = adapter?.getFullPath?.(file.path);
		const shell = window.require?.("electron")?.shell;
		if (absPath && shell?.openPath) {
			const result = await shell.openPath(absPath);
			if (result === "") return { ok: true, mode: "default-app" };
		}
	} catch (e) {
		console.warn("[Quiz] fallback Electron openPath a échoué:", e);
	}
	return { ok: false, mode: "failed" };
}

async function handleQuizResourceButtonClick(fileName) {
	try {
		const rawName = String(fileName ?? "").trim();
		if (!rawName) return void quizNotice("Nom de fichier manquant.", QUIZ_RESOURCE_NOTICE_MS.warning);
		const matches = findVaultFilesByExactName(rawName);
		if (matches.length === 0) return void quizNotice(`Fichier introuvable dans le vault : ${rawName}`, QUIZ_RESOURCE_NOTICE_MS.warning);
		if (matches.length > 1) quizNotice(`Plusieurs fichiers portent ce nom (${rawName}). Premier résultat utilisé.`, QUIZ_RESOURCE_NOTICE_MS.warning);
		const file = matches[0];
		const revealed = await revealFileInObsidianExplorer(file);
		await new Promise(r => setTimeout(r, 180));
		const openResult = await openWithDefaultAppFromVault(file);
		if (openResult.ok && openResult.mode === "default-app") return void quizNotice(`Ouverture avec l'application par défaut : ${file.name}`, QUIZ_RESOURCE_NOTICE_MS.defaultApp);
		if (openResult.ok && openResult.mode === "system-chooser") return void quizNotice(`Ouverture via le système Android : ${file.name}`, QUIZ_RESOURCE_NOTICE_MS.androidSystem);
		const openedFallback = await openVaultFileFallback(file);
		if (openedFallback) return void quizNotice(`Ouverture interne (fallback) : ${file.name}`, QUIZ_RESOURCE_NOTICE_MS.fallbackOpen);
		quizNotice(
			revealed
				? `Fichier localisé, mais aucune application par défaut trouvée pour : ${file.name}`
				: `Impossible de révéler ou d'ouvrir le fichier : ${file.name}`,
			QUIZ_RESOURCE_NOTICE_MS.error
		);
	} catch (e) {
		console.error("[Quiz] handleQuizResourceButtonClick erreur:", e);
		quizNotice("Erreur pendant l'ouverture du fichier.", QUIZ_RESOURCE_NOTICE_MS.error);
	}
}

function bindQuizResourceButtons(rootEl = container) {
	if (!rootEl) return;

	rootEl.querySelectorAll(".quiz-resource-btn[data-resource-file]").forEach(btn => {
		const trigger = async e => {
			e.preventDefault();
			e.stopPropagation();
			await handleQuizResourceButtonClick(btn.dataset.resourceFile);
		};

		btn.addEventListener("click", trigger);
		btn.addEventListener("keydown", e => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				trigger(e);
			}
		});
	});
}

const escapeHtmlAttr = value => String(value ?? "")
	.replace(/&/g, "&amp;")
	.replace(/"/g, "&quot;")
	.replace(/'/g, "&#39;")
	.replace(/</g, "&lt;")
	.replace(/>/g, "&gt;");

const escapeHtmlText = value => String(value ?? "")
	.replace(/&/g, "&amp;")
	.replace(/</g, "&lt;")
	.replace(/>/g, "&gt;")
	.replace(/"/g, "&quot;")
	.replace(/'/g, "&#39;");

const QUIZ_HTML_ALLOWED_TAGS = new Set([
	"a", "b", "blockquote", "br", "center", "code", "details", "div", "em", "font",
	"h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "kbd", "li", "mark",
	"ol", "p", "pre", "samp", "small", "span", "strong", "sub", "summary", "sup",
	"table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul"
]);

const QUIZ_HTML_DROP_TAGS = new Set([
	"script", "style", "iframe", "object", "embed", "link", "meta"
]);

const QUIZ_HTML_GLOBAL_ATTRS = new Set([
	"class", "title", "role", "aria-label", "aria-hidden", "tabindex"
]);

const QUIZ_HTML_TAG_ATTRS = {
	a: new Set(["href", "target", "rel"]),
	img: new Set(["src", "alt", "width", "height"]),
	td: new Set(["colspan", "rowspan"]),
	th: new Set(["colspan", "rowspan"]),
	font: new Set(["color"])
};

function isSafeQuizUrl(value, { image = false } = {}) {
	const raw = String(value ?? "").trim();
	if (!raw) return false;

	if (
		raw.startsWith("#") ||
		raw.startsWith("/") ||
		raw.startsWith("./") ||
		raw.startsWith("../")
	) {
		return true;
	}

	if (/^(https?:|mailto:|tel:|obsidian:|app:|file:|blob:)/i.test(raw)) {
		return true;
	}

	if (image && /^data:image\//i.test(raw)) {
		return true;
	}

	return false;
}

function unwrapQuizHtmlElement(node) {
	const parent = node?.parentNode;
	if (!parent) return;

	while (node.firstChild) {
		parent.insertBefore(node.firstChild, node);
	}
	parent.removeChild(node);
}

function sanitizeQuizHtml(html) {
	const tpl = document.createElement("template");
	tpl.innerHTML = String(html ?? "");

	const walk = node => {
		if (!node) return;

		if (node.nodeType === Node.COMMENT_NODE) {
			node.remove();
			return;
		}

		if (node.nodeType !== Node.ELEMENT_NODE) return;

		const tag = node.tagName.toLowerCase();

		if (QUIZ_HTML_DROP_TAGS.has(tag)) {
			node.remove();
			return;
		}

		if (!QUIZ_HTML_ALLOWED_TAGS.has(tag)) {
			unwrapQuizHtmlElement(node);
			return;
		}

		const allowedAttrs = QUIZ_HTML_TAG_ATTRS[tag] || new Set();

		Array.from(node.attributes).forEach(attr => {
			const name = attr.name.toLowerCase();
			const value = attr.value;

			if (name.startsWith("on") || name === "style") {
				node.removeAttribute(attr.name);
				return;
			}

			if (!QUIZ_HTML_GLOBAL_ATTRS.has(name) && !allowedAttrs.has(name)) {
				node.removeAttribute(attr.name);
				return;
			}

			if (
				(name === "href" || name === "src") &&
				!isSafeQuizUrl(value, { image: name === "src" && tag === "img" })
			) {
				node.removeAttribute(attr.name);
				return;
			}

			if (
				(name === "width" || name === "height" || name === "colspan" || name === "rowspan") &&
				!/^\d{1,4}$/.test(String(value).trim())
			) {
				node.removeAttribute(attr.name);
				return;
			}

			if (name === "target" && !/^_(self|blank)$/.test(String(value).trim())) {
				node.removeAttribute(attr.name);
				return;
			}
		});

		if (tag === "a" && node.getAttribute("target") === "_blank") {
			node.setAttribute("rel", "noopener noreferrer");
		}

		Array.from(node.childNodes).forEach(walk);
	};

	Array.from(tpl.content.childNodes).forEach(walk);
	return tpl.innerHTML;
}	

function renderInlineQuizHtml(raw) {
	return restoreAllowedInlineTags(
		escapeHtmlText(String(raw ?? "")).replace(/\n/g, "<br>")
	);
}

function resourceButtonHtml(q) {
	const rb = q?.resourceButton;
	if (!rb || !rb.label || !rb.fileName) return "";
	return `<button class="quiz-resource-btn" type="button" data-resource-file="${escapeHtmlAttr(rb.fileName)}"><span class="quiz-resource-btn-icon" aria-hidden="true">⬇</span><span class="quiz-resource-btn-label">${escapeHtmlText(rb.label)}</span></button>`;
}

function resolveObsidianEmbedFile(linkPath) {
	const raw = String(linkPath ?? "").trim();
	if (!raw) return null;

	const currentFilePath = sourcePath || "";

	try {
		if (app?.metadataCache?.getFirstLinkpathDest) {
			const f = app.metadataCache.getFirstLinkpathDest(raw, currentFilePath);
			if (f) return f;
		}
	} catch (e) {
		console.warn("[Quiz] resolveObsidianEmbedFile erreur:", e);
	}

	try {
		const f2 = app?.vault?.getAbstractFileByPath?.(raw);
		if (f2) return f2;
	} catch (e) {
		console.warn("[Quiz] getAbstractFileByPath erreur:", e);
	}

	return null;
}

function parseObsidianEmbedSpec(spec) {
	const s = String(spec ?? "").trim();
	const parts = s.split("|");
	const linkPath = (parts[0] || "").trim();
	let width = null, height = null, alt = "";
	if (parts.length >= 2) {
		const p = (parts[1] || "").trim();
		if (/^\d+$/.test(p)) width = Number(p);
		else if (/^\d+x\d+$/i.test(p)) {
			const [w, h] = p.toLowerCase().split("x").map(n => Number(n));
			if (Number.isFinite(w)) width = w;
			if (Number.isFinite(h)) height = h;
		} else alt = p;
	}
	return { linkPath, width, height, alt };
}

function buildEmbedImgHtml(embedSpec, { wrapClass = "quiz-question-embed-wrap", imgClass = "quiz-question-embed" } = {}) {
	const parsed = parseObsidianEmbedSpec(embedSpec);
	const file = resolveObsidianEmbedFile(parsed.linkPath);
	if (file && typeof app?.vault?.getResourcePath === "function") {
		const src = app.vault.getResourcePath(file);
		const widthAttr = parsed.width ? ` width="${parsed.width}"` : "";
		const heightAttr = parsed.height ? ` height="${parsed.height}"` : "";
		const altAttr = escapeHtmlAttr(parsed.alt || file.name || "Image");
		return `<div class="${wrapClass}"><img class="${imgClass}" src="${src}" alt="${altAttr}" loading="eager"${widthAttr}${heightAttr}></div>`;
	}
	return `<code>${escapeHtmlText(`![[${embedSpec}]]`)}</code>`;
}

function restoreAllowedInlineTags(html) {
	return String(html ?? "")
		.replace(/&lt;br\s*\/?&gt;/gi, "<br>")
		.replace(/&lt;(\/?)code&gt;/gi, "<$1code>")
		.replace(/&lt;(\/?)(strong|b|em|i|u|mark|kbd|samp|small|sub|sup)&gt;/gi, "<$1$2>");
}

function renderTextWithEmbeds(raw, { wrapClass = "quiz-question-embed-wrap", imgClass = "quiz-question-embed" } = {}) {
	const text = String(raw ?? "");
	const embedRe = /!\[\[([^\]]+)\]\]/g;

	let html = "";
	let lastIndex = 0;
	let match;

	while ((match = embedRe.exec(text)) !== null) {
		const before = text.slice(lastIndex, match.index);

		if (before) {
			html += restoreAllowedInlineTags(
				escapeHtmlText(before).replace(/\n/g, "<br>")
			);
		}

		html += buildEmbedImgHtml(match[1], { wrapClass, imgClass });
		lastIndex = match.index + match[0].length;
	}

	const tail = text.slice(lastIndex);

	if (tail) {
		html += restoreAllowedInlineTags(
			escapeHtmlText(tail).replace(/\n/g, "<br>")
		);
	}

	return html;
}

function renderHintWithCodeAndEmbeds(raw) {
	return renderTextWithEmbeds(raw, {
		wrapClass: "quiz-hint-embed-wrap",
		imgClass: "quiz-hint-embed"
	});
}

const replaceObsidianEmbedsInHtml = (html, { wrapClass = "quiz-explain-embed-wrap", imgClass = "quiz-explain-embed" } = {}) =>
	String(html ?? "").replace(/!\[\[([^\]]+)\]\]/g, (_, spec) => buildEmbedImgHtml(spec, { wrapClass, imgClass }));

function tabClass(i) {
	const active = (isQuestionSlideIndex(quizState.current) && i === quizState.current) ? "active" : "";
	if (!hasAnyAnswer(i)) return active;
	if (!quizState.locked) return `${active} answered`.trim();
	return `${active} ${isCorrect(i) ? "correct" : "wrong"}`.trim();
}

function navHtml() {
	const resultsActive = (isSubmitSlideIndex(quizState.current) || isResultsSlideIndex(quizState.current)) ? "active" : "";
	return `<div class="quiz-nav">${quiz.map((_, i) => `<a class="quiz-tab ${tabClass(i)}" href="#" data-nav="${i}">Q${i + 1}</a>`).join("")}<a class="quiz-tab is-result ${resultsActive}" href="#" data-nav-results="1">Résultats</a></div>`;
}

function examTimerHtml() {
	if (!isExamMode || !examOptions.showTimer) return "";
	if (!examStarted) {
		return `<div class="quiz-exam-start-screen" data-exam-start-screen="1">
			<div class="quiz-exam-start-content">
				<div class="quiz-exam-start-icon">
					<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="10" x2="14" y1="2" y2="2"></line>
						<line x1="12" x2="15" y1="14" y2="11"></line>
						<circle cx="12" cy="14" r="8"></circle>
					</svg>
				</div>
				<div class="quiz-exam-start-title">Mode Examen</div>
				<div class="quiz-exam-start-duration">Durée : ${examOptions.durationMinutes} minutes</div>
				<button class="quiz-exam-start-btn" type="button">Commencer l'examen</button>
			</div>
		</div>`;
	}
	// Calculer le temps restant à afficher (minutes:secondes)
	const minutes = Math.floor(examTimeRemaining / 60000);
	const seconds = Math.floor((examTimeRemaining % 60000) / 1000);
	const timerDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;

	return `<div class="quiz-exam-timer" data-exam-timer="1">
		<div class="quiz-exam-timer-bar">
			<div class="quiz-exam-timer-progress" data-exam-progress="1"></div>
		</div>
		<div class="quiz-exam-timer-text" data-exam-text="1">${timerDisplay}</div>
	</div>`;
}

function startExamTimer() {
	// Ne pas lancer le timer si l'examen est terminé
	if (!isExamMode || examTimerId || !examStarted || examEnded) return;

	// Sécurité : arrêter tout timer existant avant d'en lancer un nouveau
	stopExamTimer();

	examStartTime = Date.now();
	examTimeRemaining = examDurationMs;
	updateExamTimerDisplay();

	let lastDisplayedSecond = Math.floor(examDurationMs / 1000);
	let animationFrameId = null;

	const tick = () => {
		if (examEnded) return;

		const elapsed = Date.now() - examStartTime;
		examTimeRemaining = Math.max(0, examDurationMs - elapsed);

		// Toujours mettre à jour l'affichage, même à 0:00
		updateExamTimerDisplay();

		if (examTimeRemaining <= 0) {
			// Le timer est arrêté dans handleExamTimeUp()
			handleExamTimeUp();
			return;
		}

		animationFrameId = requestAnimationFrame(tick);
	};

	animationFrameId = requestAnimationFrame(tick);
	examTimerId = animationFrameId;
}

function startExam() {
	if (!isExamMode || examStarted) return;
	examStarted = true;

	// Lancer le timer
	startExamTimer();

	// Faire le rendu complet du quiz
	render();
}

function updateExamTimerDisplay() {
	const progressEl = container.querySelector('[data-exam-progress="1"]');
	const textEl = container.querySelector('[data-exam-text="1"]');
	if (!progressEl || !textEl) return;

	const pct = Math.max(0, Math.min(100, (examTimeRemaining / examDurationMs) * 100));
	progressEl.style.width = `${pct}%`;

	const minutes = Math.floor(examTimeRemaining / 60000);
	const seconds = Math.floor((examTimeRemaining % 60000) / 1000);
	textEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

	const timerContainer = container.querySelector('[data-exam-timer="1"]');
	if (timerContainer) {
		timerContainer.classList.remove('quiz-exam-timer-warning', 'quiz-exam-timer-danger');
		if (pct <= 20) timerContainer.classList.add('quiz-exam-timer-danger');
		else if (pct <= 50) timerContainer.classList.add('quiz-exam-timer-warning');
	}
}

function handleExamTimeUp() {
	if (examEnded) return;
	examEnded = true;

	// Arrêter le timer et mettre à jour l'affichage avec le temps restant (0:00)
	stopExamTimer();
	updateExamTimerDisplay();

	// Verrouiller le quiz
	quizState.locked = true;

	// Aller directement aux résultats (comme un clic sur "Voir le score")
	goToResults();

	if (typeof Notice === 'function') {
		new Notice('Temps écoulé ! Le quiz a été verrouillé.', 5000);
	}
}

function stopExamTimer({ resetTimeRemaining = false } = {}) {
	if (examTimerId) {
		cancelAnimationFrame(examTimerId);
		examTimerId = null;
	}
	// Réinitialiser examStartTime pour éviter les calculs erronés
	examStartTime = 0;
	// Optionnel : reset aussi le temps restant (seulement pour resetQuiz)
	if (resetTimeRemaining) {
		examTimeRemaining = examDurationMs;
	}
}

function optionClass(qi, origIndex) {
	const q = quiz[qi], sel = quizState.selections[qi];

	if (isOrderingQuestion(q) || isMatchingQuestion(q) || isTextQuestion(q)) return "";

	if (q.multiSelect) {
		if (!(sel instanceof Set)) return "";
		if (!quizState.locked) return sel.has(origIndex) ? "selected" : "";
		if (sel.size === 0 || !sel.has(origIndex)) return "";
		return Array.isArray(q.correctIndices) && q.correctIndices.includes(origIndex) ? "correct" : "wrong";
	}

	if (!quizState.locked) return sel === origIndex ? "selected" : "";
	if (sel === null || origIndex !== sel) return "";
	return sel === q.correctIndex ? "correct" : "wrong";
}

function explanationHtml(qi) {
	if (!quizState.locked) return "";

	const rawHtml = replaceObsidianEmbedsInHtml(
		quiz[qi].explainHtml || "",
		{ wrapClass: "quiz-explain-embed-wrap", imgClass: "quiz-explain-embed" }
	);

	const safeHtml = sanitizeQuizHtml(rawHtml);

	return `<div class="quiz-explain ${isCorrect(qi) ? "good" : "bad"}">${safeHtml}</div>`;
}

function renderQuizPromptHtml(q) {
	if (q?.promptHtml && String(q.promptHtml).trim()) {
		const rawHtml = replaceObsidianEmbedsInHtml(q.promptHtml, {
			wrapClass: "quiz-question-embed-wrap",
			imgClass: "quiz-question-embed"
		});

		const safeHtml = sanitizeQuizHtml(rawHtml);

		return `<div class="quiz-question">${safeHtml}</div>`;
	}

	return `<div class="quiz-question">${renderRawHtmlWithEmbeds(q?.prompt ?? "", {
		wrapClass: "quiz-question-embed-wrap",
		imgClass: "quiz-question-embed"
	})}</div>`;
}

function orderingCardHtml(q, qi) {
	const items = getOrderingItems(q);
	const sel = quizState.selections[qi];
	const slotLabels = questions.getOrderingSlotLabels(q);
	const correctOrder = questions.getOrderingCorrectOrder(q);
	const shuffled = quizState.shuffleMap[qi] || [];
	const pick = quizState.orderingPick[qi];

	const slots = items.map((_, si) => {
		const oi = Array.isArray(sel) ? sel[si] : null;
		const filled = oi !== null;
		let cls = "quiz-slot";
		if (filled) cls += " filled";
		if (!quizState.locked && pick !== null) cls += " can-place";
		if (quizState.locked && filled) cls += oi === correctOrder[si] ? " correct" : " wrong";

		return `<div class="${cls}" data-order-slot="${si}" role="button" tabindex="0" ${(!quizState.locked && filled) ? `draggable="true" data-slot-item="${oi}"` : ""}>
			<div class="quiz-slot-label">${renderInlineQuizHtml(slotLabels[si] ?? String(si + 1))}</div>
			<div class="quiz-slot-value">${filled ? renderInlineQuizHtml(items[oi]) : "Glissez un élément ici"}</div>
		</div>`;
	}).join("");

	const possibilities = shuffled.map(oi => {
		const used = orderingSelectionIncludes(qi, oi);
		const picked = !used && pick === oi && !quizState.locked;
		let cls = "quiz-possibility";
		if (used) cls += " used";
		if (picked) cls += " selected-pick";

		return `<div class="${cls}" data-order-item="${oi}" role="button" tabindex="0" ${(!used && !quizState.locked) ? `draggable="true"` : ""}>
			${renderInlineQuizHtml(items[oi])}
		</div>`;
	}).join("");

	return `<div class="quiz-multi-indicator">Classez les éléments dans le bon ordre (glisser-déposer). Déposez un élément sur un emplacement déjà rempli pour échanger automatiquement les positions.</div>
	<div class="quiz-ordering">
		<div class="quiz-ordering-slots">${slots}</div>
		<div class="quiz-ordering-label">Éléments à placer</div>
		<div class="quiz-ordering-possibilities">${possibilities}</div>
	</div>`;
}

function matchingCardHtml(q, qi) {
	const rows = getMatchRows(q);
	const choices = getMatchChoices(q);
	const correctMap = questions.getMatchCorrectMap(q);
	const sel = quizState.selections[qi];
	const shuffleData = quizState.shuffleMap[qi] || {};
	const shuffledRows = Array.isArray(shuffleData.rows) ? shuffleData.rows : [...Array(rows.length).keys()];
	const shuffledChoices = Array.isArray(shuffleData.choices) ? shuffleData.choices : [...Array(choices.length).keys()];
	const pick = quizState.matchPick[qi];

	const slots = shuffledRows.map(rowIndex => {
		const chosen = Array.isArray(sel) ? sel[rowIndex] : null;
		const filled = chosen !== null;
		let cls = "quiz-slot";
		if (filled) cls += " filled";
		if (!quizState.locked && pick !== null) cls += " can-place";
		if (quizState.locked && filled && Array.isArray(correctMap) && correctMap.length === rows.length) {
			cls += chosen === correctMap[rowIndex] ? " correct" : " wrong";
		}

		return `<div class="${cls}" data-match-slot="${rowIndex}" role="button" tabindex="0" ${(!quizState.locked && filled) ? `draggable="true" data-slot-choice="${chosen}"` : ""}>
			<div class="quiz-slot-label">${renderInlineQuizHtml(rows[rowIndex])}</div>
			<div class="quiz-slot-value">${filled ? renderInlineQuizHtml(choices[chosen] ?? "Support inconnu") : "Déposez un support ici"}</div>
		</div>`;
	}).join("");

	const possibilities = shuffledChoices.map(ci => {
		const picked = !quizState.locked && pick === ci;
		let cls = "quiz-possibility";
		if (picked) cls += " selected-pick";

		return `<div class="${cls}" data-match-choice="${ci}" role="button" tabindex="0" ${!quizState.locked ? `draggable="true"` : ""}>
			${renderInlineQuizHtml(choices[ci])}
		</div>`;
	}).join("");

	return `<div class="quiz-multi-indicator">Associez chaque situation à un support (glisser-déposer). Un même support peut être utilisé plusieurs fois.</div>
	<div class="quiz-ordering">
		<div class="quiz-ordering-slots">${slots}</div>
		<div class="quiz-ordering-label">Supports disponibles</div>
		<div class="quiz-ordering-possibilities">${possibilities}</div>
	</div>`;
}

function submitSlideHtml() {
	const missing = getMissingIndices();
	const mc = missing.length;
	return `<div class="quiz-track-item" data-slide-kind="submit"><div class="quiz-submit-wrap"><div class="quiz-submit-card">${mc > 0 ? `<div class="quiz-warn">Il manque ${mc} réponse${mc > 1 ? "s" : ""}.</div><div class="quiz-submit-sub">Questions sans réponse :</div>` : `<div class="quiz-submit-sub">Revenir sur une question :</div>`}<div class="quiz-chip-row">${(mc > 0 ? missing : quiz.map((_, i) => i)).map(i => `<button class="quiz-chip ${mc > 0 ? "missing" : ""}" type="button" data-jump="${i}">Q${i + 1}</button>`).join("")}</div><div class="quiz-actions"><button class="quiz-action-btn quiz-back-btn" type="button">Retour</button><button class="quiz-action-btn success quiz-show-score-btn" type="button">Voir le score</button></div></div></div></div>`;
}

function resultsSlideHtml() {
	const { pct, correct, total } = computeScorePercent();
	return `<div class="quiz-track-item" data-slide-kind="results"><section class="quiz-result"><h2 class="quiz-result-title" style="font-weight:900;">Résultats</h2><p style="font-size:48px;font-weight:900;margin:18px 0 6px;">${pct}%</p><p>Bonnes réponses : <strong>${correct}/${total}</strong></p><div class="quiz-actions"><button class="quiz-action-btn success quiz-retry-btn" type="button">Recommencer</button></div></section></div>`;
}

function bindSubmitSlideControls(rootEl) {
	if (!rootEl) return;
	rootEl.querySelectorAll("[data-jump]").forEach(btn => btn.addEventListener("click", () => goToQuestion(Number(btn.dataset.jump))));
	const backBtn = rootEl.querySelector(".quiz-back-btn");
	if (backBtn) backBtn.addEventListener("click", () => goToQuestion(quizState.lastQuestionIndex));
	const showScoreBtn = rootEl.querySelector(".quiz-show-score-btn");
	if (showScoreBtn) showScoreBtn.addEventListener("click", () => goToResults());
}

function bindResultsSlideControls(rootEl) {
	if (!rootEl) return;
	const retryBtn = rootEl.querySelector(".quiz-retry-btn");
	if (retryBtn) retryBtn.addEventListener("click", e => {
		e.preventDefault();
		restartQuizWithZoomBlurTransition();
	});
}

function refreshMetaSlides({ force = false } = {}) {
	const nextSubmitSignature = getSubmitSlideSignature();
	const nextResultsSignature = getResultsSlideSignature();
	const shouldRefreshSubmit = force || nextSubmitSignature !== __quizSubmitSlideSignature;
	const shouldRefreshResults = force || nextResultsSignature !== __quizResultsSlideSignature;
	if (!shouldRefreshSubmit && !shouldRefreshResults) return;

	const refreshMetaSlide = ({ selector, index, html, binder }) => {
		const oldNode = container.querySelector(selector);
		if (!oldNode) return;
		unobserveTrackItemInAllSlidesResizeObserver(oldNode);
		bumpSlideGeneration(index);
		const tmp = document.createElement("div");
		tmp.innerHTML = html().trim();
		const newNode = tmp.firstElementChild;
		if (!newNode) return;
		oldNode.replaceWith(newNode);
		observeTrackItemInAllSlidesResizeObserver(newNode);
		binder(newNode);
	};

	if (shouldRefreshSubmit) {
		refreshMetaSlide({
			selector: '.quiz-track-item[data-slide-kind="submit"]',
			index: SLIDE_SUBMIT_INDEX,
			html: submitSlideHtml,
			binder: bindSubmitSlideControls
		});
		__quizSubmitSlideSignature = nextSubmitSignature;
	}
	if (shouldRefreshResults) {
		refreshMetaSlide({
			selector: '.quiz-track-item[data-slide-kind="results"]',
			index: SLIDE_RESULTS_INDEX,
			html: resultsSlideHtml,
			binder: bindResultsSlideControls
		});
		__quizResultsSlideSignature = nextResultsSignature;
	}

	applyTrackGeometry({ refreshWidth: false });
	syncTrackViewportIsolation();
	const { track } = getTrackElements();
	if (track && (quizState.current === SLIDE_SUBMIT_INDEX || quizState.current === SLIDE_RESULTS_INDEX)) {
		track.style.transition = "none";
		setTrackTransformPx(getSlideTranslateX(quizState.current));
		__quizSlideHeightCache.delete(quizState.current);
		scheduleViewportHeightSync({ index: quizState.current, animate: false, refresh: true });
	}
}

function splitTerminalVisualTokens(value, variant) {
	const raw = String(value ?? "");

	if (variant !== "powershell") {
		return {
			leading: "",
			command: raw,
			rest: ""
		};
	}

	const match = raw.match(/^([ \t]*)(\S+)?([\s\S]*)$/);

	return {
		leading: match?.[1] ?? "",
		command: match?.[2] ?? "",
		rest: match?.[3] ?? ""
	};
}

function textQuestionCardHtml(q, qi) {
	const value = typeof quizState.selections[qi] === "string" ? quizState.selections[qi] : "";
	const terminalVariant = terminal.getTerminalTextVariant(q);
	const isTerminal = !!terminalVariant;
	const isPowerShell = terminalVariant === "powershell";
	const maxLength = terminal.getTextMaxLength(q);

	const statusClass = quizState.locked
		? (isCorrect(qi) ? "correct" : "wrong")
		: (value.trim() ? "filled" : "");

	const readOnlyAttr = quizState.locked ? `readonly aria-readonly="true"` : "";
	const maxLengthAttr = Number.isFinite(maxLength) ? `maxlength="${maxLength}"` : "";

	const placeholder = escapeHtmlAttr(
		isTerminal ? (q?.placeholder || "") : (q?.placeholder || "Votre réponse...")
	);
	const textareaName = escapeHtmlAttr(q?.id || `q${qi + 1}`);

	if (isTerminal) {
		const promptPrefixHtml = terminal.renderTerminalPromptPrefixHtml(q);
		const variantClass = `quiz-terminal-variant-${escapeHtmlAttr(terminalVariant)}`;
		const variantAttr = escapeHtmlAttr(terminalVariant);

		const renderLayerHtml = isPowerShell
			? `<span class="quiz-command-render" aria-hidden="true"><span class="quiz-command-render-leading"></span><span class="quiz-command-render-command"></span><span class="quiz-command-render-rest"></span></span>`
			: "";

		return `
			<div class="qcm-options quiz-text-wrap quiz-text-wrap-command">
				<div class="quiz-command-shell ${variantClass} ${statusClass}" data-terminal-variant="${variantAttr}">
					${promptPrefixHtml}
					<div class="quiz-command-input-wrap">
						${renderLayerHtml}
						<span class="quiz-command-measure" aria-hidden="true"></span>
						<textarea
							class="quiz-textarea quiz-textarea-command"
							data-text-answer="1"
							data-command-answer="1"
							data-terminal-answer="1"
							data-terminal-variant="${variantAttr}"
							name="${textareaName}"
							placeholder="${placeholder}"
							spellcheck="false"
							autocapitalize="off"
							autocomplete="off"
							autocorrect="off"
							rows="1"
							wrap="off"
							${maxLengthAttr}
							${readOnlyAttr}
						>${escapeHtmlText(value)}</textarea>
						<span class="quiz-command-selection" aria-hidden="true"></span>
						<span class="quiz-command-inline-char" aria-hidden="true"></span>
						<span class="quiz-command-caret" aria-hidden="true"></span>
					</div>
				</div>
			</div>`;
	}

	return `
		<div class="qcm-options quiz-text-wrap">
			<textarea
				class="quiz-textarea ${statusClass}"
				data-text-answer="1"
				name="${textareaName}"
				placeholder="${placeholder}"
				spellcheck="${q?.spellcheck === true ? "true" : "false"}"
				autocapitalize="off"
				autocomplete="off"
				autocorrect="off"
				${maxLengthAttr}
				${readOnlyAttr}
			>${escapeHtmlText(value)}</textarea>
		</div>`;
}

function bindTextQuestion(trackItem, qi) {
	if (!trackItem) return;

	if (typeof trackItem.__quizTextQuestionCleanup === "function") {
		try { trackItem.__quizTextQuestionCleanup(); } catch (_) {}
		trackItem.__quizTextQuestionCleanup = null;
	}

	const textarea = trackItem.querySelector(".quiz-textarea[data-text-answer]");
	if (!textarea) return;

	const q = quiz[qi];
	const terminalVariant = terminal.getTerminalTextVariant(q);
	const isCommand = terminal.isCommandTextQuestion(q);
	const isPowerShell = terminalVariant === "powershell";

	const shell = trackItem.querySelector(".quiz-command-shell");
	const inputWrap = trackItem.querySelector(".quiz-command-input-wrap");
	const measure = trackItem.querySelector(".quiz-command-measure");
	const inlineChar = trackItem.querySelector(".quiz-command-inline-char");
	const selectionOverlay = trackItem.querySelector(".quiz-command-selection");

	const renderLayer = trackItem.querySelector(".quiz-command-render");
	const renderLeading = trackItem.querySelector(".quiz-command-render-leading");
	const renderCommand = trackItem.querySelector(".quiz-command-render-command");
	const renderRest = trackItem.querySelector(".quiz-command-render-rest");

	const measureWidth = text => {
		if (!isCommand || !measure) return 0;
		measure.textContent = text || "";
		return measure.getBoundingClientRect().width || 0;
	};

	const normalizeTextareaValue = ({ preserveSelection = true } = {}) => {
		const rawValue = textarea.value ?? "";
		const rawStart = typeof textarea.selectionStart === "number" ? textarea.selectionStart : rawValue.length;
		const rawEnd = typeof textarea.selectionEnd === "number" ? textarea.selectionEnd : rawStart;

		const sanitized = terminal.sanitizeTextAnswerValue(q, rawValue);

		if (sanitized !== rawValue) {
			textarea.value = sanitized;

			if (preserveSelection) {
				const maxPos = sanitized.length;
				const nextStart = Math.max(0, Math.min(rawStart, maxPos));
				const nextEnd = Math.max(0, Math.min(rawEnd, maxPos));

				try {
					textarea.setSelectionRange(nextStart, nextEnd);
				} catch (_) {}
			}
		}

		return textarea.value ?? "";
	};

	const getLiveTextStatus = () => {
		const currentValue = String(textarea.value ?? "");

		if (quizState.locked) {
			return terminal.isTextAnswerCorrect(q, currentValue) ? "correct" : "wrong";
		}

		return currentValue.trim().length > 0 ? "filled" : "";
	};

	const applyLiveTextStatusClasses = () => {
		const status = getLiveTextStatus();

		[textarea, shell].filter(Boolean).forEach(el => {
			el.classList.remove("filled", "correct", "wrong");
			if (status) el.classList.add(status);
		});
	};

	const updateTerminalRenderLayer = () => {
		if (!isPowerShell || !shell || !renderLayer) return;

		const value = String(textarea.value ?? "");
		const parts = splitTerminalVisualTokens(value, terminalVariant);

		if (renderLeading) renderLeading.textContent = parts.leading || "";
		if (renderCommand) renderCommand.textContent = parts.command || "";
		if (renderRest) renderRest.textContent = parts.rest || "";

		renderLayer.style.transform = `translate3d(${-Math.max(0, textarea.scrollLeft || 0)}px, 0, 0)`;

		const hasCommandToken = !!(parts.command && parts.command.length > 0);

		shell.setAttribute("data-ps-render", hasCommandToken ? "1" : "0");
		shell.setAttribute("data-render-ready", hasCommandToken ? "1" : "0");

		renderLayer.style.opacity = hasCommandToken ? "1" : "0";
		renderLayer.style.visibility = hasCommandToken ? "visible" : "hidden";
	};

	const ensureCommandVisualRangeVisible = () => {
		if (!isCommand || !textarea || !measure) return;

		const value = textarea.value ?? "";
		const rawStart = typeof textarea.selectionStart === "number" ? textarea.selectionStart : value.length;
		const rawEnd = typeof textarea.selectionEnd === "number" ? textarea.selectionEnd : rawStart;

		const start = Math.max(0, Math.min(rawStart, value.length));
		const end = Math.max(0, Math.min(rawEnd, value.length));

		const rangeStart = Math.min(start, end);
		const rangeEnd = Math.max(start, end);

		const startPx = measureWidth(value.slice(0, rangeStart));
		const endPx = measureWidth(value.slice(0, rangeEnd));

		const visibleWidth = Math.max(0, textarea.clientWidth || 0);
		const leftVisible = textarea.scrollLeft || 0;
		const rightVisible = leftVisible + visibleWidth;

		const fontSize = parseFloat(getComputedStyle(textarea).fontSize) || 16;
		const rightSafety = Math.max(12, fontSize);
		const leftSafety = 2;

		if (rangeEnd > rangeStart) {
			if (endPx + rightSafety > rightVisible) {
				textarea.scrollLeft = Math.max(0, endPx - visibleWidth + rightSafety);
			}
			else if (startPx - leftSafety < leftVisible) {
				textarea.scrollLeft = Math.max(0, startPx - leftSafety);
			}
			return;
		}

		if (startPx + rightSafety > rightVisible) {
			textarea.scrollLeft = Math.max(0, startPx - visibleWidth + rightSafety);
		}
		else if (startPx - leftSafety < leftVisible) {
			textarea.scrollLeft = Math.max(0, startPx - leftSafety);
		}
	};

	const updateCommandVisuals = () => {
		if (!isCommand || !shell || !inputWrap || !measure) return;

		const value = textarea.value ?? "";
		const rawStart = typeof textarea.selectionStart === "number" ? textarea.selectionStart : value.length;
		const rawEnd = typeof textarea.selectionEnd === "number" ? textarea.selectionEnd : rawStart;

		const start = Math.max(0, Math.min(rawStart, value.length));
		const end = Math.max(0, Math.min(rawEnd, value.length));
		const rangeStart = Math.min(start, end);
		const rangeEnd = Math.max(start, end);
		const isSelectionRange = rangeEnd > rangeStart;

		const beforeRange = value.slice(0, rangeStart);
		const selectedText = value.slice(rangeStart, rangeEnd);
		const scrollLeft = textarea.scrollLeft || 0;
		const visibleWidth = Math.max(0, textarea.clientWidth || inputWrap.clientWidth || 0);

		const computedShell = getComputedStyle(shell);
		const computedTextarea = getComputedStyle(textarea);
		const fontSize = parseFloat(computedTextarea.fontSize) || 16;
		const fallbackCharWidth = Math.max(8, fontSize * 0.62);

		const caretWidthEndRaw = parseFloat(computedShell.getPropertyValue("--cmd-caret-width-end"));
		const caretWidthInlineRaw = parseFloat(computedShell.getPropertyValue("--cmd-caret-width-inline"));

		const caretWidthEnd = Number.isFinite(caretWidthEndRaw) && caretWidthEndRaw > 0
			? caretWidthEndRaw
			: fallbackCharWidth;

		const caretWidthInline = Number.isFinite(caretWidthInlineRaw) && caretWidthInlineRaw > 0
			? caretWidthInlineRaw
			: fallbackCharWidth;

		const beforeRangeWidth = measureWidth(beforeRange);
		const selectedWidth = isSelectionRange ? Math.max(1, measureWidth(selectedText)) : 0;

		const isFocused = document.activeElement === textarea && !quizState.locked;
		const isCollapsed = rangeStart === rangeEnd;
		const hasInlineChar = rangeStart < value.length;

		let visualWidth = caretWidthEnd;
		if (isSelectionRange) visualWidth = selectedWidth;
		else if (hasInlineChar) visualWidth = caretWidthInline;

		const rawVisualX = beforeRangeWidth - scrollLeft;
		const maxX = Math.max(0, visibleWidth - Math.max(1, visualWidth));
		const visualX = Math.max(0, Math.min(rawVisualX, maxX));

		inputWrap.style.setProperty("--cmd-caret-x", `${visualX}px`);
		inputWrap.style.setProperty("--cmd-inline-char-x", `${visualX}px`);
		inputWrap.style.setProperty("--cmd-selection-x", `${visualX}px`);

		shell.classList.remove("is-focused", "is-caret-end", "is-caret-inline", "is-selection-range");

		if (selectionOverlay) {
			selectionOverlay.textContent = isSelectionRange ? selectedText : "";
		}

		if (inlineChar) {
			inlineChar.textContent = (!isSelectionRange && rangeStart < value.length)
				? value.charAt(rangeStart)
				: "";
		}

		updateTerminalRenderLayer();

		if (!isFocused) return;

		shell.classList.add("is-focused");

		if (!isCollapsed) {
			shell.classList.add("is-selection-range");
			return;
		}

		if (hasInlineChar) shell.classList.add("is-caret-inline");
		else shell.classList.add("is-caret-end");
	};

	let commandSelectionSyncRaf = 0;
	let commandSelectionTracking = false;

	const sync = () => {
		normalizeTextareaValue({ preserveSelection: true });
		applyLiveTextStatusClasses();

		if (isCommand) {
			const style = getComputedStyle(textarea);
			const fontSize = parseFloat(style.fontSize) || 16;
			const lineHeight = parseFloat(style.lineHeight) || fontSize;
			const pxHeight = Math.max(1, Math.ceil(lineHeight));

			textarea.style.height = `${pxHeight}px`;
			textarea.style.minHeight = `${pxHeight}px`;
			textarea.style.maxHeight = `${pxHeight}px`;

			ensureCommandVisualRangeVisible();
			updateCommandVisuals();
		}
		else {
			terminal.syncTextAreaHeight(textarea);
		}

		__quizSlideHeightCache.delete(qi);
		if (qi === quizState.current) {
			scheduleViewportHeightSync({ index: qi, animate: false, refresh: true });
		}
	};

	const queueSync = () => {
		if (commandSelectionSyncRaf) return;
		commandSelectionSyncRaf = requestAnimationFrame(() => {
			commandSelectionSyncRaf = 0;
			if (__quizDestroyed) return;
			sync();
		});
	};

	const onDocumentSelectionMove = () => {
		if (!commandSelectionTracking) return;
		queueSync();
	};

	const stopCommandSelectionTracking = () => {
		if (!commandSelectionTracking) return;

		commandSelectionTracking = false;

		document.removeEventListener("pointermove", onDocumentSelectionMove, true);
		document.removeEventListener("mousemove", onDocumentSelectionMove, true);
		document.removeEventListener("selectionchange", onDocumentSelectionMove, true);
		document.removeEventListener("pointerup", stopCommandSelectionTracking, true);
		document.removeEventListener("mouseup", stopCommandSelectionTracking, true);
		window.removeEventListener("blur", stopCommandSelectionTracking, true);

		queueSync();
	};

	const startCommandSelectionTracking = e => {
		if (!isCommand || quizState.locked) return;
		if (e && typeof e.button === "number" && e.button !== 0) return;
		if (commandSelectionTracking) return;

		commandSelectionTracking = true;

		document.addEventListener("pointermove", onDocumentSelectionMove, true);
		document.addEventListener("mousemove", onDocumentSelectionMove, true);
		document.addEventListener("selectionchange", onDocumentSelectionMove, true);
		document.addEventListener("pointerup", stopCommandSelectionTracking, true);
		document.addEventListener("mouseup", stopCommandSelectionTracking, true);
		window.addEventListener("blur", stopCommandSelectionTracking, true);

		queueSync();
	};

	const cleanupTextQuestionBinding = () => {
		stopCommandSelectionTracking();

		if (commandSelectionSyncRaf) {
			cancelAnimationFrame(commandSelectionSyncRaf);
			commandSelectionSyncRaf = 0;
		}
	};

	trackItem.__quizTextQuestionCleanup = cleanupTextQuestionBinding;

	const commitValue = () => {
		const finalValue = normalizeTextareaValue({ preserveSelection: true });
		quizState.selections[qi] = finalValue;
		applyLiveTextStatusClasses();
		updateNavHighlight();
		refreshMetaSlides();
		sync();
	};

	textarea.addEventListener("input", () => {
		queueSync();

		if (quizState.isSliding || quizState.locked) return;
		commitValue();
	});

	textarea.addEventListener("paste", () => {
		requestAnimationFrame(() => {
			queueSync();

			if (quizState.isSliding || quizState.locked) return;
			commitValue();
		});
	});

	textarea.addEventListener("focus", () => queueSync());
	textarea.addEventListener("blur", () => {
		stopCommandSelectionTracking();
		queueSync();
	});
	textarea.addEventListener("click", () => queueSync());
	textarea.addEventListener("mouseup", () => queueSync());
	textarea.addEventListener("keyup", () => queueSync());
	textarea.addEventListener("select", () => queueSync());
	textarea.addEventListener("scroll", () => queueSync());

	textarea.addEventListener("pointerdown", startCommandSelectionTracking);
	textarea.addEventListener("mousedown", startCommandSelectionTracking);

	textarea.addEventListener("keydown", e => {
		if (isCommand && e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();

			if (quizState.isSliding || quizState.locked) return;

			commitValue();

			if (qi < quiz.length - 1) {
				goToQuestion(qi + 1);
			}
			return;
		}

		if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && qi < quiz.length - 1) {
			e.preventDefault();
			goToQuestion(qi + 1);
		}

		queueSync();
	});

	sync();
}


function questionCardHtml(qi) {
	const q = quiz[qi];
	const isTxt = isTextQuestion(q);
	const isOrd = isOrderingQuestion(q);
	const isMatch = isMatchingQuestion(q);
	const isMulti = !!q.multiSelect;

	let body = "";

	if (isTxt) {
		body = textQuestionCardHtml(q, qi);
	}
	else if (isOrd) {
		body = orderingCardHtml(q, qi);
	}
	else if (isMatch) {
		body = matchingCardHtml(q, qi);
	}
	else {
		const smap = quizState.shuffleMap[qi] || [];
		const mi = isMulti ? `<div class="quiz-multi-indicator">Sélectionnez une ou plusieurs réponses</div>` : "";
		const optionsHtml = smap.map((oi) => {
			let optionContentHtml = "";
			if (q.optionHtml?.[oi]) {
				// Use rich HTML content, resolve image paths
				optionContentHtml = q.optionHtml[oi];
				if (typeof app?.vault?.adapter?.getResourcePath === "function") {
					// Resolve image paths that are not already resource URLs
					optionContentHtml = optionContentHtml.replace(/src="([^"]+)"/g, (match, src) => {
						if (src.startsWith("http") || src.startsWith("data:") || src.startsWith("app://")) {
							return match;
						}
						try {
							const resolved = app.vault.adapter.getResourcePath(src);
							return `src="${escapeHtmlAttr(resolved)}"`;
						} catch {
							return match;
						}
					});
				}
			} else {
				// Fallback to plain text with embeds
				optionContentHtml = renderRawHtmlWithEmbeds(q.options[oi], { wrapClass: "quiz-option-embed-wrap", imgClass: "quiz-option-embed" });
			}
			return `<div class="quiz-option ${isMulti ? "multi" : ""} ${optionClass(qi, oi)}" role="button" tabindex="0" data-orig="${oi}">${optionContentHtml}</div>`;
		}).join("");
		const hasImg = /<img[\s>]/i.test(optionsHtml);
		body = mi + `<div class="quiz-options-wrap${hasImg ? " quiz-options-image-grid" : ""}">${optionsHtml}</div>`;
	}

	const hintBtn = (q.hint && String(q.hint).trim()) ? `<button class="quiz-hint-btn" type="button">Indice</button>` : "";
	const sectionIdAttr = (typeof q?.id === "string" && q.id.trim().length > 0)
		? ` id="${escapeHtmlAttr(q.id)}"`
		: "";

	return `<div class="quiz-track-item" data-slide-kind="question" data-qi="${qi}">
		<section class="quiz-card"${sectionIdAttr}>
			<h2>${escapeHtmlText(q.title)}</h2>
			${resourceButtonHtml(q)}
			${renderQuizPromptHtml(q)}
			${body}
			${hintBtn}
			${explanationHtml(qi)}
		</section>
		<div class="quiz-actions">
			<button class="quiz-action-btn quiz-prev-btn" type="button" ${qi === 0 ? "disabled" : ""}>◀ Précédent</button>
			<button class="quiz-action-btn quiz-next-btn" type="button" ${qi === quiz.length - 1 ? "disabled" : ""}>Suivant ▶</button>
		</div>
	</div>`;
}

async function restartQuizWithZoomBlurTransition() {
	if (quizState.isSliding) return;

	let epoch = currentAsyncEpoch();

	closeHintModal();
	clearTrackTransitionFallback();
	destroyActiveSlideResizeObserver();
	destroyAllSlidesResizeObserver();
	destroyViewportResizeObserver();
	clearBackgroundWarmIdleHandle();
	cancelEnsureTrackVisibleRaf();

	quizState.isSliding = true;
	setSlidingClass(true);
	quizState.slideToken++;

	const OUT_VIEW_DUR = 560;
	const OUT_OVERLAY_DUR = 260;
	const OUT_OVERLAY_DELAY = 160;

	const IN_VIEW_DUR = 560;
	const IN_CARD_DUR = 560;
	const IN_OVERLAY_DUR = 300;

	const EASE_OUT = "cubic-bezier(0.2, 0.8, 0.2, 1)";
	const EASE_IN = "cubic-bezier(0.16, 1, 0.3, 1)";
	const OUT_TOTAL = Math.max(OUT_VIEW_DUR, OUT_OVERLAY_DELAY + OUT_OVERLAY_DUR);

	const body = document.body;
	const root = document.documentElement;
	const isLight =
		body?.classList.contains("theme-light") ||
		root?.classList.contains("theme-light");

	const viewport = container.querySelector(".quiz-track-viewport");
	const resultsSlide = container.querySelector('.quiz-track-item[data-slide-kind="results"]');
	const resultsCard = container.querySelector('.quiz-track-item[data-slide-kind="results"] .quiz-result');

	const prevContainerOverflow = container.style.overflow;
	const prevContainerPointerEvents = container.style.pointerEvents;
	const prevViewportOverflow = viewport ? viewport.style.overflow : "";

	container.style.overflow = "hidden";
	container.style.pointerEvents = "none";
	if (viewport) viewport.style.overflow = "hidden";

	const overlay = document.createElement("div");
	overlay.className = "quiz-restart-zoom-overlay";
	Object.assign(overlay.style, {
		position: "fixed",
		inset: "0",
		zIndex: "999999",
		pointerEvents: "none",
		opacity: "0",
		willChange: "opacity, backdrop-filter, -webkit-backdrop-filter",
		backdropFilter: "blur(0px)",
		webkitBackdropFilter: "blur(0px)",
		background: isLight ? "rgba(255,255,255,0.08)" : "rgba(2,6,23,0.10)"
	});
	body.appendChild(overlay);

	if (resultsSlide) {
		Object.assign(resultsSlide.style, {
			willChange: "transform, opacity, filter",
			transformOrigin: "center center",
			transition: "none",
			transform: "scale(1)",
			opacity: "1",
			filter: "blur(0px)"
		});
	}

	if (resultsCard) {
		Object.assign(resultsCard.style, {
			willChange: "transform, opacity, filter",
			transformOrigin: "center center",
			transition: "none",
			transform: "scale(1)",
			opacity: "1",
			filter: "blur(0px)"
		});
	}

	const cleanup = () => {
		try { overlay.remove(); } catch (_) {}

		const cleanupSelectors = [
			".quiz-track-viewport",
			'.quiz-track-item[data-slide-kind="results"]',
			'.quiz-track-item[data-slide-kind="results"] .quiz-result',
			'.quiz-track-item[data-slide-kind="question"][data-qi="0"]',
			'.quiz-track-item[data-slide-kind="question"][data-qi="0"] .quiz-card',
			'.quiz-track-item[data-slide-kind="question"][data-qi="0"] .quiz-actions'
		];

		cleanupSelectors.forEach(sel => {
			const el = container.querySelector(sel);
			if (!el) return;
			el.style.transition = "";
			el.style.transform = "";
			el.style.opacity = "";
			el.style.filter = "";
			el.style.willChange = "";
			el.style.transformOrigin = "";
		});

		const q1SlideCleanup = container.querySelector('.quiz-track-item[data-slide-kind="question"][data-qi="0"]');
		if (q1SlideCleanup) {
			delete q1SlideCleanup.dataset.quizTransitionLock;
		}

		const vp = container.querySelector(".quiz-track-viewport");
		if (vp) vp.style.overflow = prevViewportOverflow || "";

		container.style.overflow = prevContainerOverflow || "";
		container.style.pointerEvents = prevContainerPointerEvents || "";

		quizState.isSliding = false;
		setSlidingClass(false);

		syncTrackViewportIsolation();
		scheduleViewportHeightSync({ index: quizState.current, animate: false, refresh: true });
	};

	const outReady = await waitFrames(1, epoch);
	if (!outReady || !isQuizInstanceAlive(epoch)) {
		cleanup();
		return;
	}

	if (resultsSlide) {
		Object.assign(resultsSlide.style, {
			transition: `transform ${OUT_VIEW_DUR}ms ${EASE_OUT}, opacity ${OUT_VIEW_DUR}ms ${EASE_OUT}, filter ${OUT_VIEW_DUR}ms ${EASE_OUT}`,
			transform: "scale(0.965)",
			opacity: "0",
			filter: "blur(10px)"
		});
	}

	if (resultsCard) {
		Object.assign(resultsCard.style, {
			transition: `transform ${OUT_VIEW_DUR}ms ${EASE_OUT}, opacity ${OUT_VIEW_DUR}ms ${EASE_OUT}, filter ${OUT_VIEW_DUR}ms ${EASE_OUT}`,
			transform: "scale(0.94) translateY(8px)",
			opacity: "0",
			filter: "blur(8px)"
		});
	}

	Object.assign(overlay.style, {
		transition: `opacity ${OUT_OVERLAY_DUR}ms ${EASE_OUT} ${OUT_OVERLAY_DELAY}ms, backdrop-filter ${OUT_OVERLAY_DUR}ms ${EASE_OUT} ${OUT_OVERLAY_DELAY}ms, -webkit-backdrop-filter ${OUT_OVERLAY_DUR}ms ${EASE_OUT} ${OUT_OVERLAY_DELAY}ms`,
		opacity: "1",
		backdropFilter: "blur(12px)",
		webkitBackdropFilter: "blur(12px)"
	});

	const outTransitions = [
		resultsSlide ? { target: resultsSlide, properties: ["transform", "opacity", "filter"] } : null,
		resultsCard ? { target: resultsCard, properties: ["transform", "opacity", "filter"] } : null,
		{ target: overlay, properties: ["opacity"] }
	].filter(Boolean);

	const outOk = await waitForManagedTransitions(outTransitions, OUT_TOTAL + 120, epoch);

	if (!outOk || !isQuizInstanceAlive(epoch)) {
		cleanup();
		return;
	}

	resetQuiz({ preserveSliding: false });

	/* IMPORTANT :
	   render() a relancé restartAsyncLifecycle(),
	   donc l'ancien epoch n'est plus valide.
	   On repart sur le NOUVEL epoch. */
	epoch = currentAsyncEpoch();

	quizState.isSliding = false;
	setSlidingClass(false);

	if (__quizBootstrapRaf1) {
		cancelAnimationFrame(__quizBootstrapRaf1);
		__quizBootstrapRaf1 = 0;
	}
	if (__quizBootstrapRaf2) {
		cancelAnimationFrame(__quizBootstrapRaf2);
		__quizBootstrapRaf2 = 0;
	}
	cancelEnsureTrackVisibleRaf();

	const q1Slide = container.querySelector('.quiz-track-item[data-slide-kind="question"][data-qi="0"]');
	const q1Card = container.querySelector('.quiz-track-item[data-slide-kind="question"][data-qi="0"] .quiz-card');
	const q1Actions = container.querySelector('.quiz-track-item[data-slide-kind="question"][data-qi="0"] .quiz-actions');

	if (!q1Slide || !isQuizInstanceAlive(epoch)) {
		cleanup();
		return;
	}

	q1Slide.dataset.quizTransitionLock = "1";

	applyTrackPositionAndHeightInstant();
	primeAllSlideHeights({ retries: 4, syncCurrent: true });
	setTrackTransformPx(getSlideTranslateX(0));
	settleViewportHeightToIndex(0, { animate: false, refresh: true });
	syncTrackViewportIsolation();

	void q1Slide.offsetWidth;
	if (q1Card) void q1Card.offsetWidth;
	if (q1Actions) void q1Actions.offsetWidth;

	Object.assign(q1Slide.style, {
		willChange: "transform, opacity, filter",
		transformOrigin: "center center",
		transition: "none",
		transform: "scale(0.965)",
		opacity: "0",
		filter: "blur(10px)"
	});

	if (q1Card) {
		Object.assign(q1Card.style, {
			willChange: "transform, opacity, filter",
			transformOrigin: "center center",
			transition: "none",
			transform: "scale(0.94) translateY(8px)",
			opacity: "0",
			filter: "blur(8px)"
		});
	}

	if (q1Actions) {
		Object.assign(q1Actions.style, {
			willChange: "transform, opacity, filter",
			transformOrigin: "center center",
			transition: "none",
			transform: "scale(0.94) translateY(8px)",
			opacity: "0",
			filter: "blur(8px)"
		});
	}

	void q1Slide.offsetWidth;
	if (q1Card) void q1Card.offsetWidth;
	if (q1Actions) void q1Actions.offsetWidth;

	const inReady = await waitFrames(2, epoch);
	if (!inReady || !isQuizInstanceAlive(epoch)) {
		cleanup();
		return;
	}

	Object.assign(overlay.style, {
		transition: `opacity ${IN_OVERLAY_DUR}ms ${EASE_IN}, backdrop-filter ${IN_OVERLAY_DUR}ms ${EASE_IN}, -webkit-backdrop-filter ${IN_OVERLAY_DUR}ms ${EASE_IN}`,
		opacity: "0",
		backdropFilter: "blur(0px)",
		webkitBackdropFilter: "blur(0px)"
	});

	Object.assign(q1Slide.style, {
		transition: `transform ${IN_VIEW_DUR}ms ${EASE_IN}, opacity ${IN_VIEW_DUR}ms ${EASE_IN}, filter ${IN_VIEW_DUR}ms ${EASE_IN}`,
		transform: "scale(1)",
		opacity: "1",
		filter: "blur(0px)"
	});

	if (q1Card) {
		Object.assign(q1Card.style, {
			transition: `transform ${IN_CARD_DUR}ms ${EASE_IN}, opacity ${IN_CARD_DUR}ms ${EASE_IN}, filter ${IN_CARD_DUR}ms ${EASE_IN}`,
			transform: "scale(1) translateY(0)",
			opacity: "1",
			filter: "blur(0px)"
		});
	}

	if (q1Actions) {
		Object.assign(q1Actions.style, {
			transition: `transform ${IN_CARD_DUR}ms ${EASE_IN}, opacity ${IN_CARD_DUR}ms ${EASE_IN}, filter ${IN_CARD_DUR}ms ${EASE_IN}`,
			transform: "scale(1) translateY(0)",
			opacity: "1",
			filter: "blur(0px)"
		});
	}

	const inTransitions = [
		{ target: overlay, properties: ["opacity"] },
		{ target: q1Slide, properties: ["transform", "opacity", "filter"] },
		q1Card ? { target: q1Card, properties: ["transform", "opacity", "filter"] } : null,
		q1Actions ? { target: q1Actions, properties: ["transform", "opacity", "filter"] } : null
	].filter(Boolean);

	await waitForManagedTransitions(
		inTransitions,
		Math.max(IN_VIEW_DUR, IN_CARD_DUR, IN_OVERLAY_DUR) + 140,
		epoch
	);

	cleanup();
}

function destroyViewportResizeObserver() {
	if (__quizViewportResizeObserver) {
		try { __quizViewportResizeObserver.disconnect(); } catch (_) {}
		__quizViewportResizeObserver = null;
	}
	if (__quizViewportResizeRaf) {
		cancelAnimationFrame(__quizViewportResizeRaf);
		__quizViewportResizeRaf = 0;
	}
	if (__quizViewportResizeSettleTimer) {
		clearTimeout(__quizViewportResizeSettleTimer);
		__quizViewportResizeSettleTimer = 0;
	}
}

function bindViewportResizeObserver() {
	destroyViewportResizeObserver();
	if (typeof ResizeObserver === "undefined") return;
	const { viewport } = getTrackElements();
	if (!viewport) return;
	let lastWidth = Math.round(viewport.getBoundingClientRect().width || viewport.clientWidth || 0);

	const realignViewportAndTrack = ({ settle = false } = {}) => {
		const { track, viewport: vp } = getTrackElements();
		if (!track || !vp) return;
		applyTrackGeometry({ refreshWidth: true });
		if (quizState.isSliding) {
			const snapshot = cancelRunningTrackAnimation();
			animateTrackToIndex(quizState.current, { fromX: snapshot.x, fromHeight: snapshot.height, refreshTargetHeight: true });
			return;
		}
		track.style.transition = "none";
		track.style.willChange = "";
		track.style.backfaceVisibility = "hidden";
		track.style.transformStyle = "preserve-3d";
		setTrackTransformPx(getSlideTranslateX(quizState.current));
		__quizSlideHeightCache.delete(quizState.current);
		syncViewportHeight({ index: quizState.current, animate: false, refresh: true });
		primeAllSlideHeights({ retries: settle ? 4 : 2, syncCurrent: true });
		bindCurrentSlideMediaHeightSync();
		bindActiveSlideResizeObserver();
		resyncCommandTextareasOnSlide(quizState.current);
		updateNavHighlight();
	};

	__quizViewportResizeObserver = new ResizeObserver(entries => {
		const entry = entries[0];
		if (!entry) return;
		const rect = entry.contentRect || viewport.getBoundingClientRect();
		const width = Math.round(rect.width || viewport.clientWidth || 0);
		if (width === lastWidth) return;
		lastWidth = width;
		if (__quizViewportResizeRaf) {
			cancelAnimationFrame(__quizViewportResizeRaf);
			__quizViewportResizeRaf = 0;
		}
		if (__quizViewportResizeSettleTimer) {
			clearTimeout(__quizViewportResizeSettleTimer);
			__quizViewportResizeSettleTimer = 0;
		}
		__quizViewportResizeRaf = requestAnimationFrame(() => {
			__quizViewportResizeRaf = 0;
			realignViewportAndTrack({ settle: false });
		});
		__quizViewportResizeSettleTimer = window.setTimeout(() => {
			__quizViewportResizeSettleTimer = 0;
			realignViewportAndTrack({ settle: true });
		}, 340);
	});
	try { __quizViewportResizeObserver.observe(viewport); } catch (_) {}
}

function syncTrackViewportIsolation() {
	const { viewport, track } = getTrackElements();
	if (!viewport || !track) return;

	applyTrackGeometry({ refreshWidth: false });

	if (viewport.dataset.quizIsoInit !== "1") {
		viewport.dataset.quizIsoInit = "1";
		viewport.style.position = "relative";
		viewport.style.overflow = "hidden";
		viewport.style.overflowX = "hidden";
		viewport.style.overflowY = "hidden";
		viewport.style.clipPath = "none";
		viewport.style.setProperty("-webkit-clip-path", "none");
		viewport.style.isolation = "isolate";
		viewport.style.contain = "layout style";
	}

	track.style.backfaceVisibility = "hidden";
	track.style.transformStyle = "preserve-3d";

	const items = track.children ? Array.from(track.children) : [];
	const { from, to } = getSlidingWindow();

	items.forEach((item, index) => {
		if (item.dataset.quizTrackItemInit !== "1") {
			item.dataset.quizTrackItemInit = "1";
			item.style.boxSizing = "border-box";
			item.style.overflow = "visible";
			item.style.contain = "layout style";
			item.style.transform = "none";
		}

		const transitionLocked = item.dataset.quizTransitionLock === "1";

		let mode = "idle-hidden";

		if (quizState.isSliding) {
			if (index >= from && index <= to) {
				if (index === quizState.prevCurrent) mode = "sliding-from";
				else if (index === quizState.current) mode = "sliding-to";
				else mode = "sliding-middle";
			}
		} else {
			mode = index === quizState.current ? "idle-active" : "idle-hidden";
		}

		item.dataset.quizIsoMode = mode;

		if (mode === "idle-hidden") {
			item.style.visibility = "hidden";
			if (!transitionLocked) item.style.opacity = "0";
			item.style.pointerEvents = "none";
			item.style.zIndex = "0";
			item.setAttribute("aria-hidden", "true");
			return;
		}

		if (mode === "idle-active") {
			item.style.visibility = "visible";
			if (!transitionLocked) item.style.opacity = "1";
			item.style.pointerEvents = "auto";
			item.style.zIndex = "2";
			item.setAttribute("aria-hidden", "false");
			return;
		}

		item.style.visibility = "visible";
		if (!transitionLocked) item.style.opacity = "1";
		item.style.pointerEvents = index === quizState.current ? "auto" : "none";
		item.style.zIndex = (index === quizState.prevCurrent || index === quizState.current) ? "1" : "0";
		item.setAttribute("aria-hidden", index === quizState.current ? "false" : "true");
	});
}

function destroyQuiz() {
	__quizDestroyed = true;
	__quizAsyncEpoch++;

	container.querySelectorAll('.quiz-track-item[data-slide-kind="question"]').forEach(item => {
		if (typeof item.__quizTextQuestionCleanup === "function") {
			try { item.__quizTextQuestionCleanup(); } catch (_) {}
		}
	});

	closeHintModal();
	clearTrackTransitionFallback();
	destroyActiveSlideResizeObserver();
	destroyAllSlidesResizeObserver();
	destroyViewportResizeObserver();
	clearBackgroundWarmIdleHandle();
	cancelEnsureTrackVisibleRaf();
	resolveAllPendingAsync(false);

	if (__quizHeightRaf) { cancelAnimationFrame(__quizHeightRaf); __quizHeightRaf = 0; }
	if (__quizHeightResyncTimer) { clearTimeout(__quizHeightResyncTimer); __quizHeightResyncTimer = 0; }
	if (__quizHintCloseTimer) { clearTimeout(__quizHintCloseTimer); __quizHintCloseTimer = 0; }
	if (__quizHintOpenRaf1) { cancelAnimationFrame(__quizHintOpenRaf1); __quizHintOpenRaf1 = 0; }
	if (__quizHintOpenRaf2) { cancelAnimationFrame(__quizHintOpenRaf2); __quizHintOpenRaf2 = 0; }
	if (__quizHintFocusTimer) { clearTimeout(__quizHintFocusTimer); __quizHintFocusTimer = 0; }
	if (__quizBootstrapRaf1) { cancelAnimationFrame(__quizBootstrapRaf1); __quizBootstrapRaf1 = 0; }
	if (__quizBootstrapRaf2) { cancelAnimationFrame(__quizBootstrapRaf2); __quizBootstrapRaf2 = 0; }
	stopExamTimer();

	const hintOverlay = document.getElementById(HINT_OVERLAY_ID);
	if (hintOverlay) {
		try { hintOverlay.remove(); } catch (_) {}
	}

	for (const fn of __quizGlobalCleanups) {
		try { fn(); } catch (_) {}
	}
	__quizGlobalCleanups.length = 0;

	__quizSlideHeightCache.clear();
	__quizWarmSlidePromises.clear();
	__quizBackgroundWarmStarted = false;
	__quizTrackFixBound = false;
	__quizTrackViewportWidth = 0;
	__quizTrackAppliedWidth = 0;
	__quizTrackAppliedSlideCount = 0;
	__quizSubmitSlideSignature = "";
	__quizResultsSlideSignature = "";

	if (container.__quizDestroy === destroyQuiz) delete container.__quizDestroy;
	destroyZoomFixHandlers();
}

container.__quizDestroy = destroyQuiz;

function refreshQuestionSlide(qi, { syncHeight = true } = {}) {
	const oldItem = container.querySelector(`.quiz-track-item[data-slide-kind="question"][data-qi="${qi}"]`);
	if (!oldItem) return null;

	if (typeof oldItem.__quizTextQuestionCleanup === "function") {
		try { oldItem.__quizTextQuestionCleanup(); } catch (_) {}
	}

	const focusDescriptor = getQuestionFocusDescriptor(oldItem);
	unobserveTrackItemInAllSlidesResizeObserver(oldItem);
	bumpSlideGeneration(qi);

	const tmp = document.createElement("div");
	tmp.innerHTML = questionCardHtml(qi).trim();
	const newItem = tmp.firstElementChild;
	if (!newItem) return null;

	oldItem.replaceWith(newItem);
	applyTrackGeometry({ refreshWidth: false });
	bindQuizResourceButtons(newItem);
	bindTrackItemImages(newItem, qi);
	bindQuestionTrackItem(newItem);
	observeTrackItemInAllSlidesResizeObserver(newItem);
	updateNavHighlight();
	syncTrackViewportIsolation();

	const { track } = getTrackElements();
	if (track) {
		track.style.transition = "none";
		setTrackTransformPx(getSlideTranslateX(quizState.current));
	}

	restoreQuestionFocus(newItem, focusDescriptor);

	if (syncHeight && qi === quizState.current) {
		requestAnimationFrame(() => {
			if (__quizDestroyed) return;
			__quizSlideHeightCache.delete(qi);
			bindCurrentSlideMediaHeightSync();
			bindActiveSlideResizeObserver();
			scheduleViewportHeightSync({ index: qi, animate: false, refresh: true });
		});
	}

	return newItem;
}

function commitQuestionInteraction(qi, { syncHeight = true } = {}) {
	__quizSlideHeightCache.delete(qi);
	refreshQuestionSlide(qi, { syncHeight });
	refreshMetaSlides();
}

function bindBinaryQuestion(trackItem, qi, isMulti) {
	trackItem.querySelectorAll(".quiz-option").forEach(el => {
		const oi = Number(el.dataset.orig);
		const trySelect = () => {
			if (quizState.isSliding || quizState.locked) return;
			if (isMulti) {
				const s = quizState.selections[qi];
				if (!(s instanceof Set)) return;
				if (s.has(oi)) s.delete(oi);
				else s.add(oi);
			} else quizState.selections[qi] = oi;
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
	const qItems = getOrderingItems(q);
	if (!Array.isArray(quizState.selections[qi]) || quizState.selections[qi].length !== qItems.length) quizState.selections[qi] = Array(qItems.length).fill(null);

	trackItem.querySelectorAll("[data-order-item]").forEach(el => {
		const oi = Number(el.dataset.orderItem);
		const pickItem = () => {
			if (quizState.isSliding || quizState.locked || orderingSelectionIncludes(qi, oi)) return;
			quizState.orderingPick[qi] = quizState.orderingPick[qi] === oi ? null : oi;
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
			if (quizState.isSliding || quizState.locked || orderingSelectionIncludes(qi, oi)) return void e.preventDefault();
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
			if (quizState.isSliding || quizState.locked) return;
			const sel = quizState.selections[qi];
			const picked = quizState.orderingPick[qi];
			if (!Array.isArray(sel)) return;
			if (picked !== null) {
				placeOrderingItemInSlot(qi, si, picked);
				quizState.orderingPick[qi] = null;
				return commitQuestionInteraction(qi, { syncHeight: true });
			}
			if (sel[si] !== null) {
				removeOrderingItemFromSlot(qi, si);
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
			if (quizState.isSliding || quizState.locked) return void e.preventDefault();
			const sel = quizState.selections[qi];
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
			if (quizState.isSliding || quizState.locked) return;
			e.preventDefault();
			const sel = quizState.selections[qi];
			el.classList.add("dragover");
			if (Array.isArray(sel) && sel[si] !== null) el.classList.add("swap-target");
			else el.classList.remove("swap-target");
		});
		el.addEventListener("dragleave", () => el.classList.remove("dragover", "swap-target"));
		el.addEventListener("drop", e => {
			e.preventDefault();
			el.classList.remove("dragover", "swap-target");
			if (quizState.locked || quizState.isSliding) return;
			const sel = quizState.selections[qi];
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
				quizState.orderingPick[qi] = null;
				return commitQuestionInteraction(qi, { syncHeight: true });
			}
			sel[targetSlot] = oi;
			quizState.orderingPick[qi] = null;
			commitQuestionInteraction(qi, { syncHeight: true });
		});
	});
}

function bindMatchingQuestion(trackItem, qi, q) {
	const rows = getMatchRows(q);
	if (!Array.isArray(quizState.selections[qi]) || quizState.selections[qi].length !== rows.length) quizState.selections[qi] = Array(rows.length).fill(null);

	trackItem.querySelectorAll("[data-match-choice]").forEach(el => {
		const ci = Number(el.dataset.matchChoice);
		const pickChoice = () => {
			if (quizState.isSliding || quizState.locked) return;
			quizState.matchPick[qi] = quizState.matchPick[qi] === ci ? null : ci;
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
			if (quizState.isSliding || quizState.locked) return void e.preventDefault();
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
			if (quizState.isSliding || quizState.locked) return;
			const picked = quizState.matchPick[qi];
			const sel = quizState.selections[qi];
			if (!Array.isArray(sel)) return;
			if (picked !== null) {
				sel[si] = picked;
				quizState.matchPick[qi] = null;
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
			if (quizState.isSliding || quizState.locked) return void e.preventDefault();
			const sel = quizState.selections[qi];
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
			if (quizState.isSliding || quizState.locked) return;
			e.preventDefault();
			const sel = quizState.selections[qi];
			el.classList.add("dragover");
			if (Array.isArray(sel) && sel[si] !== null) el.classList.add("swap-target");
			else el.classList.remove("swap-target");
		});
		el.addEventListener("dragleave", () => el.classList.remove("dragover", "swap-target"));
		el.addEventListener("drop", e => {
			e.preventDefault();
			el.classList.remove("dragover", "swap-target");
			if (quizState.locked || quizState.isSliding) return;
			const sel = quizState.selections[qi];
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
				quizState.matchPick[qi] = null;
				return commitQuestionInteraction(qi, { syncHeight: true });
			}
			sel[targetSlot] = ci;
			quizState.matchPick[qi] = null;
			commitQuestionInteraction(qi, { syncHeight: true });
		});
	});
}

function bindQuestionTrackItem(trackItem) {
	if (!trackItem) return;

	const qi = Number(trackItem.dataset.qi);
	if (!Number.isFinite(qi) || qi < 0 || qi >= quiz.length) return;

	const q = quiz[qi];
	const isTxt = isTextQuestion(q);
	const isOrd = isOrderingQuestion(q);
	const isMatch = isMatchingQuestion(q);
	const isMulti = !!q.multiSelect;

	if (isTxt) bindTextQuestion(trackItem, qi);
	if (!isTxt && !isOrd && !isMatch) bindBinaryQuestion(trackItem, qi, isMulti);
	if (isOrd) bindOrderingQuestion(trackItem, qi, q);
	if (isMatch) bindMatchingQuestion(trackItem, qi, q);

	const hintBtn = trackItem.querySelector(".quiz-hint-btn");
	if (hintBtn) {
		hintBtn.addEventListener("click", e => {
			e.preventDefault();
			e.stopPropagation();
			openHintModal(q.hint);
		});
	}

	const prevBtn = trackItem.querySelector(".quiz-prev-btn");
	if (prevBtn) prevBtn.addEventListener("click", () => goToQuestion(qi - 1));

	const nextBtn = trackItem.querySelector(".quiz-next-btn");
	if (nextBtn) nextBtn.addEventListener("click", () => goToQuestion(qi + 1));
}

function bindExamStartButton() {
	const startBtn = container.querySelector('.quiz-exam-start-btn');
	if (startBtn) {
		startBtn.addEventListener('click', () => startExam());
	}
}

function bindStaticControls() {
	bindSubmitSlideControls(container.querySelector('.quiz-track-item[data-slide-kind="submit"]'));
	bindResultsSlideControls(container.querySelector('.quiz-track-item[data-slide-kind="results"]'));
	const bindNavTab = (tab, navigateFn) => {
		if (!tab) return;
		tab.addEventListener("pointerdown", e => {
			if (e.button !== 0) return;
			clearAllNavTabPressStates();
			setNavTabPressState(tab, true);
		});
		tab.addEventListener("pointercancel", () => clearNavTabPressState(tab));
		tab.addEventListener("click", async e => {
			e.preventDefault();
			e.stopPropagation();
			await playNavTabPressAndNavigate(tab, navigateFn);
		});
		tab.addEventListener("keydown", async e => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				e.stopPropagation();
				await playNavTabPressAndNavigate(tab, navigateFn, { fromKeyboard: true });
			}
		});
	};
	container.querySelectorAll("[data-nav]").forEach(a => bindNavTab(a, () => goToQuestion(Number(a.dataset.nav))));
	const resultsTab = container.querySelector("[data-nav-results]");
	if (resultsTab) bindNavTab(resultsTab, () => {
		if (quizState.locked) goToSlide(SLIDE_RESULTS_INDEX, { forceRender: false });
		else goToSubmit();
	});
}

function renderRawHtmlWithEmbeds(raw, { wrapClass = "quiz-question-embed-wrap", imgClass = "quiz-question-embed" } = {}) {
	return renderTextWithEmbeds(raw, {
		wrapClass,
		imgClass
	});
}

let __quizZoomFixBound = false;
let __quizZoomFixRaf = 0;
let __quizZoomFixSettleTimer = 0;
let __quizZoomLastDpr = window.devicePixelRatio || 1;
let __quizZoomFixHandler = null;

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
		if (__quizDestroyed) return;

		if (__quizZoomFixRaf) return;
		__quizZoomFixRaf = requestAnimationFrame(() => {
			__quizZoomFixRaf = 0;
			if (__quizDestroyed) return;

			// Invalider les caches liés au layout/zoom
			__quizTrackViewportWidth = 0;
			__quizSlideHeightCache.delete(quizState.current);

			// Recalage géométrie + position
			applyTrackGeometry({ refreshWidth: true });
			syncTrackViewportIsolation();

			// Si on est en slide, on repart proprement depuis l’état courant
			if (quizState.isSliding) {
				const snap = cancelRunningTrackAnimation();
				animateTrackToIndex(quizState.current, {
					fromX: snap.x,
					fromHeight: snap.height,
					refreshTargetHeight: true
				});
			} else {
				const { track } = getTrackElements();
				if (track) {
					track.style.transition = "none";
					track.style.willChange = "";
					setTrackTransformPx(getSlideTranslateX(quizState.current));
				}
				primeAllSlideHeights({ retries: settle ? 4 : 2, syncCurrent: true });
				scheduleViewportHeightSync({ index: quizState.current, animate: false, refresh: true });
			}

			// Re-sync spécifique des textareas terminal (caret/overlay/scrollLeft)
			resyncCommandTextareasOnSlide(quizState.current);

			updateNavHighlight();
		});
	};

	const onZoomOrResize = () => {
		const dpr = window.devicePixelRatio || 1;
		const dprChanged = Math.abs(dpr - __quizZoomLastDpr) > 0.001;
		if (dprChanged) __quizZoomLastDpr = dpr;

		requestResync(false);

		// “settle” : après stabilisation des layouts/fonts
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

function render() {
	restartAsyncLifecycle();
	cancelEnsureTrackVisibleRaf();

	container.querySelectorAll('.quiz-track-item[data-slide-kind="question"]').forEach(item => {
		if (typeof item.__quizTextQuestionCleanup === "function") {
			try { item.__quizTextQuestionCleanup(); } catch (_) {}
		}
	});

	bumpAllSlideGenerations();
	destroyActiveSlideResizeObserver();
	destroyAllSlidesResizeObserver();
	destroyViewportResizeObserver();
	clearTrackTransitionFallback();

	container.innerHTML = `${examTimerHtml()}${navHtml()}<div class="quiz-track-viewport" data-quiz-height-ready="0"><div class="quiz-track">${quiz.map((_, i) => questionCardHtml(i)).join("")}${submitSlideHtml()}${resultsSlideHtml()}</div></div>`;
	__quizSubmitSlideSignature = getSubmitSlideSignature();
	__quizResultsSlideSignature = getResultsSlideSignature();

	const { viewport, track } = getTrackElements();
	bindTrackFirstLoadFix();
	bindViewportResizeObserver();
	bindZoomFixHandlers();

	if (!track || !viewport) return;

	track.style.transition = "none";
	track.style.willChange = "";
	track.style.backfaceVisibility = "hidden";
	track.style.transformStyle = "preserve-3d";

	applyTrackGeometry({ refreshWidth: true });
	setTrackTransformPx(getSlideTranslateX(quizState.current));

	viewport.style.willChange = "";
	viewport.style.transform = "";
	viewport.style.opacity = "";

	if (!applyTrackPositionAndHeightInstant()) {
		ensureTrackVisibleAfterLayout(24, currentAsyncEpoch());
	}

	bindAllSlidesResizeObserver();
	bindAllTrackImages();
	bindQuizResourceButtons(container);
	container.querySelectorAll('.quiz-track-item[data-slide-kind="question"]').forEach(bindQuestionTrackItem);
	bindStaticControls();

	if (isExamMode && !examStarted) {
		// En mode examen, tant que l'examen n'a pas commencé,
		// on affiche seulement l'écran de démarrage (pas de navigation, pas de quiz)
		container.innerHTML = `${examTimerHtml()}<div class="quiz-exam-placeholder" data-exam-placeholder="1"><p>Commencez l'examen pour afficher le quiz.</p></div>`;
		bindExamStartButton();
		return;
	}

	primeAllSlideHeights({ retries: 6, syncCurrent: true });
	warmSlidesAroundIndex(quizState.current, 3);
	startFullBackgroundWarm();
	updateNavHighlight();
	setSlidingClass(quizState.isSliding);

	if (isExamMode) {
		startExamTimer();
	}
}

render();

const __quizBootstrapEpoch = currentAsyncEpoch();
__quizBootstrapRaf1 = requestAnimationFrame(() => {
	__quizBootstrapRaf1 = 0;
	if (!isQuizInstanceAlive(__quizBootstrapEpoch)) return;

	__quizBootstrapRaf2 = requestAnimationFrame(async () => {
		__quizBootstrapRaf2 = 0;
		if (!isQuizInstanceAlive(__quizBootstrapEpoch)) return;

		primeAllSlideHeights({ retries: 6, syncCurrent: true });
		ensureTrackVisibleAfterLayout(24, __quizBootstrapEpoch);
		await warmSlideForAccurateHeight(quizState.current).catch(() => {});
		if (!isQuizInstanceAlive(__quizBootstrapEpoch)) return;

		warmSlidesAroundIndex(quizState.current, 3);
		startFullBackgroundWarm();
	});
});
}

module.exports = {
	parseQuizSource,
	renderInteractiveQuiz
};