'use strict';

module.exports = function createQuestionHandlers(ctx) {
	function firstArray(...args) {
		for (const a of args) if (Array.isArray(a)) return a;
		return [];
	}

	function getOrderingItems(q) {
		return firstArray(q?.possibilities, q?.orderingItems, q?.ordering?.items, q?.options);
	}

	function getOrderingCorrectOrder(q) {
		return firstArray(q?.correctOrder, q?.ordering?.correctOrder, [...Array(getOrderingItems(q).length).keys()]);
	}

	function getOrderingSlotLabels(q) {
		return firstArray(q?.slots, q?.slotLabels, q?.ordering?.slotLabels, getOrderingItems(q).map((_, i) => String(i + 1)));
	}

	function getMatchRows(q) {
		return firstArray(q?.rows, q?.matching?.rows);
	}

	function getMatchChoices(q) {
		return firstArray(q?.choices, q?.matching?.choices);
	}

	function getMatchCorrectMap(q) {
		return firstArray(q?.correctMap, q?.matching?.correctMap);
	}

	const orderingSelectionIncludes = (qi, origIdx) => {
		const sel = ctx.quizState.selections[qi];
		return Array.isArray(sel) ? sel.includes(origIdx) : false;
	};

	function removeOrderingItemFromSlot(qi, slotIndex) {
		const sel = ctx.quizState.selections[qi];
		if (Array.isArray(sel) && slotIndex >= 0 && slotIndex < sel.length) sel[slotIndex] = null;
	}

	function placeOrderingItemInSlot(qi, slotIndex, origIdx) {
		const sel = ctx.quizState.selections[qi];
		if (!Array.isArray(sel) || slotIndex < 0 || slotIndex >= sel.length) return;
		const existingSlot = sel.indexOf(origIdx);
		const currentAtTarget = sel[slotIndex];
		if (existingSlot === slotIndex) return;
		if (existingSlot !== -1) sel[existingSlot] = null;
		if (currentAtTarget !== null && existingSlot !== -1) sel[existingSlot] = currentAtTarget;
		sel[slotIndex] = origIdx;
	}

	const matchingSelectionIncludes = (qi, choiceIdx) => {
		const sel = ctx.quizState.selections[qi];
		return Array.isArray(sel) ? sel.includes(choiceIdx) : false;
	};

	return {
		getOrderingItems,
		getOrderingCorrectOrder,
		getOrderingSlotLabels,
		getMatchRows,
		getMatchChoices,
		getMatchCorrectMap,
		orderingSelectionIncludes,
		removeOrderingItemFromSlot,
		placeOrderingItemInSlot,
		matchingSelectionIncludes
	};
};
