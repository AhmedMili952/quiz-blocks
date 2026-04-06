'use strict';

/**
 * Utilitaires généraux pour le moteur de quiz
 * Fonctions pures sans dépendances au contexte
 */

function firstArray(...candidates) {
	for (const c of candidates) if (Array.isArray(c)) return c;
	return [];
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function nextFrame() {
	return new Promise(resolve => requestAnimationFrame(resolve));
}

async function waitFrames(count = 1) {
	for (let i = 0; i < count; i++) await nextFrame();
	return true;
}

module.exports = {
	firstArray,
	sleep,
	nextFrame,
	waitFrames
};
