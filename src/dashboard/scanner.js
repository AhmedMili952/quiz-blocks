'use strict';

/* ══════════════════════════════════════════════════════════
   QUIZ SCANNER — Indexeur de vault
   Scanne les fichiers markdown pour trouver les blocs quiz-blocks,
   extrait les métadonnées (titre, nombre de questions, types),
   et maintient un cache à jour via les events vault.
══════════════════════════════════════════════════════════ */

const JSON5 = require("json5");

const QUIZ_FENCE_START = "```quiz-blocks";
const QUIZ_FENCE_END = "```";

function createScanner(app) {
	const cache = new Map(); // path → { title, questions, types, mtime }
	const listeners = [];
	let scanning = false;

	/* ── Parse un bloc quiz-blocks pour extraire les métadonnées ── */
	function parseQuizMeta(source) {
		try {
			const parsed = JSON5.parse(source);
			if (!Array.isArray(parsed)) return null;

			// Ignorer l'objet examMode final s'il existe
			const questions = parsed.filter(q =>
				q && typeof q === "object" && !q.examMode
			);

			if (questions.length === 0) return null;

			// Détecter les types de questions
			const typeSet = new Set();
			for (const q of questions) {
				if (q.multiSelect) typeSet.add("multiple");
				else if (q.type === "text") typeSet.add("text");
				else if (q.type === "ordering") typeSet.add("ordering");
				else if (q.type === "matching") typeSet.add("matching");
				else typeSet.add("single");
			}

			// Déterminer le type global du quiz
			let quizType;
			if (typeSet.size > 1) quizType = "Mixte";
			else if (typeSet.has("single")) quizType = "Choix unique";
			else if (typeSet.has("multiple")) quizType = "Choix multiple";
			else if (typeSet.has("text")) quizType = "Texte libre";
			else if (typeSet.has("ordering")) quizType = "Ordonnancement";
			else if (typeSet.has("matching")) quizType = "Association";
			else quizType = "Mixte";

			// Premier titre comme titre du quiz
			const title = questions[0]?.title || questions[0]?.prompt?.slice(0, 50) || "Quiz sans titre";

			return {
				title: title.slice(0, 80),
				questions: questions.length,
				types: Array.from(typeSet),
				quizType
			};
		} catch {
			return null;
		}
	}

	/* ── Extrait le premier bloc quiz-blocks d'un contenu markdown ── */
	function extractQuizSource(content) {
		const startIdx = content.indexOf(QUIZ_FENCE_START);
		if (startIdx === -1) return null;

		const afterStart = startIdx + QUIZ_FENCE_START.length;
		// Le contenu commence après le saut de ligne suivant
		const contentStart = content.indexOf('\n', afterStart);
		if (contentStart === -1) return null;

		// Trouver la fermeture
		const closingFence = content.indexOf('\n' + QUIZ_FENCE_END, contentStart + 1);
		if (closingFence === -1) return null;

		return content.substring(contentStart + 1, closingFence).trim();
	}

	/* ── Scan complet du vault ── */
	async function scanVault() {
		scanning = true;
		cache.clear();

		const markdownFiles = app.vault.getMarkdownFiles();

		for (const file of markdownFiles) {
			try {
				const content = await app.vault.read(file);
				const quizSource = extractQuizSource(content);
				if (!quizSource) continue;

				const meta = parseQuizMeta(quizSource);
				if (!meta) continue;

				cache.set(file.path, {
					path: file.path,
					basename: file.basename,
					...meta,
					mtime: file.stat?.mtime || 0
				});
			} catch {
				// Ignorer les erreurs de lecture
			}
		}

		scanning = false;
		notifyListeners();
	}

	/* ── Scan incrémental d'un seul fichier ── */
	async function scanFile(file) {
		try {
			const content = await app.vault.read(file);
			const quizSource = extractQuizSource(content);

			if (!quizSource) {
				const removed = cache.delete(file.path);
				if (removed) notifyListeners();
				return;
			}

			const meta = parseQuizMeta(quizSource);
			if (!meta) {
				const removed = cache.delete(file.path);
				if (removed) notifyListeners();
				return;
			}

			cache.set(file.path, {
				path: file.path,
				basename: file.basename,
				...meta,
				mtime: file.stat?.mtime || 0
			});

			notifyListeners();
		} catch {
			// Fichier inaccessible, on l'enlève du cache
			const removed = cache.delete(file.path);
			if (removed) notifyListeners();
		}
	}

	/* ── Récupérer les quiz indexés ── */
	function getQuizzes() {
		return Array.from(cache.values());
	}

	/* ── Récupérer un quiz par chemin ── */
	function getQuiz(path) {
		return cache.get(path) || null;
	}

	/* ── Récupérer le nombre total de questions ── */
	function getTotalQuestions() {
		let total = 0;
		for (const quiz of cache.values()) {
			total += quiz.questions;
		}
		return total;
	}

	/* ── Écouteurs de changements ── */
	function onChange(callback) {
		listeners.push(callback);
		return () => {
			const idx = listeners.indexOf(callback);
			if (idx >= 0) listeners.splice(idx, 1);
		};
	}

	function notifyListeners() {
		for (const cb of listeners) {
			try { cb(getQuizzes()); } catch { /* ignore */ }
		}
	}

	/* ── Setup des events vault ── */
	function setupVaultListeners() {
		app.vault.on("create", (file) => {
			if (file.extension === "md" && !scanning) {
				scanFile(file);
			}
		});

		app.vault.on("modify", (file) => {
			if (file.extension === "md" && !scanning) {
				scanFile(file);
			}
		});

		app.vault.on("delete", (file) => {
			if (cache.has(file.path)) {
				cache.delete(file.path);
				notifyListeners();
			}
		});

		app.vault.on("rename", (file, oldPath) => {
			if (cache.has(oldPath)) {
				cache.delete(oldPath);
				scanFile(file);
			} else if (file.extension === "md" && !scanning) {
				scanFile(file);
			}
		});
	}

	/* ── Initialisation ── */
	async function init() {
		setupVaultListeners();
		await scanVault();
	}

	function destroy() {
		listeners.length = 0;
		cache.clear();
	}

	return {
		init,
		destroy,
		scanVault,
		scanFile,
		getQuizzes,
		getQuiz,
		getTotalQuestions,
		onChange
	};
}

module.exports = createScanner;