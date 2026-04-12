'use strict';

/* ══════════════════════════════════════════════════════════
   STATS STORE — Stockage persistant des scores et progression
   Utilise plugin.settings.quizStats pour la persistance.
   Mises à jour en mémoire synchrones, sauvegarde debouncée.
══════════════════════════════════════════════════════════ */

function createStatsStore(plugin) {
	const DEBOUNCE_MS = 500;
	let saveTimer = null;
	let data = {}; // path → { bestScore, questionsDone, totalQuestions, lastPlayed, attempts }

	/* ── Charger les stats depuis les settings ── */
	function load() {
		data = plugin.settings.quizStats || {};
	}

	/* ── Debounced save ── */
	function scheduleSave() {
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			plugin.settings.quizStats = data;
			plugin.saveSettings().catch(() => {});
			saveTimer = null;
		}, DEBOUNCE_MS);
	}

	/* ── Mettre à jour un enregistrement ── */
	function updateRecord(path, { bestScore, questionsDone, totalQuestions }) {
		const existing = data[path] || {
			bestScore: 0,
			questionsDone: 0,
			totalQuestions: 0,
			lastPlayed: 0,
			attempts: 0
		};

		data[path] = {
			bestScore: Math.max(existing.bestScore, bestScore || 0),
			questionsDone: Math.max(existing.questionsDone, questionsDone || 0),
			totalQuestions: totalQuestions || existing.totalQuestions,
			lastPlayed: Date.now(),
			attempts: existing.attempts + 1
		};

		scheduleSave();
		return data[path];
	}

	/* ── Récupérer les stats d'un quiz ── */
	function getRecord(path) {
		return data[path] || null;
	}

	/* ── Récupérer toutes les stats ── */
	function getAll() {
		return { ...data };
	}

	/* ── Supprimer les stats d'un quiz ── */
	function deleteRecord(path) {
		if (data[path]) {
			delete data[path];
			scheduleSave();
		}
	}

	/* ── Formater un timestamp en temps relatif ── */
	function formatRelativeTime(timestamp) {
		if (!timestamp) return "—";
		const diff = Date.now() - timestamp;
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		if (minutes < 1) return "À l'instant";
		if (minutes < 60) return `il y a ${minutes} min`;
		if (hours < 24) return `il y a ${hours}h`;
		if (days < 30) return `il y a ${days}j`;
		if (days < 365) return `il y a ${Math.floor(days / 30)} mois`;
		return "il y a plus d'un an";
	}

	function destroy() {
		if (saveTimer) {
			clearTimeout(saveTimer);
			// Sauvegarde immédiate des données en attente
			plugin.settings.quizStats = data;
			plugin.saveSettings().catch(() => {});
		}
	}

	return {
		load,
		updateRecord,
		getRecord,
		getAll,
		deleteRecord,
		formatRelativeTime,
		destroy
	};
}

module.exports = createStatsStore;