'use strict';

/* ══════════════════════════════════════════════════════════
   AI CLIENT — Anthropic + Ollama
   Utilise obsidian.requestUrl() pour bypasser CORS.
   Passe body comme objet (pas JSON.stringify) pour Obsidian.
══════════════════════════════════════════════════════════ */

function createAiClient(plugin) {
	const DEFAULT_MODELS = {
		anthropic: "claude-sonnet-4-20250514",
		ollama: "qwen3:14b",
	};

	async function generate(prompt, options = {}) {
		const { count = 5, type = "Mixte", source = "topic" } = options;
		const provider = plugin.settings.aiProvider || "anthropic";
		const apiKey = (plugin.settings.aiApiKey || "").trim();
		const model = plugin.settings.aiModel || DEFAULT_MODELS[provider];

		if (provider === "anthropic" && !apiKey) {
			throw new Error("Clé API Anthropic non configurée. Allez dans les paramètres du plugin.");
		}

		const typeInstruction = type === "Mixte"
			? "un mélange de questions à choix unique, choix multiple et texte libre"
			: type === "Choix unique"
			? "des questions à choix unique (une seule bonne réponse)"
			: type === "Choix multiple"
			? "des questions à choix multiple (plusieurs bonnes réponses)"
			: "des questions à réponse texte libre";

		const systemPrompt = `Tu es un générateur de quiz. Génère exactement ${count} questions de quiz sous forme de tableau JSON5. Chaque question doit avoir :
- title: titre court de la question
- prompt: énoncé complet de la question
- options: tableau des options (pour choix unique/multiple, 3-5 options)
- correctIndex: index de la bonne réponse (pour choix unique)
- correctIndexes: tableau des index des bonnes réponses (pour choix multiple)
- multiSelect: true si choix multiple
- type: "text" pour texte libre, absent sinon
- answer: réponse attendue (pour texte libre)

Génère ${typeInstruction}. Réponds UNIQUEMENT avec le tableau JSON5, sans explication ni formatage.`;

		const userPrompt = source === "topic"
			? `Génère un quiz sur le sujet : ${prompt}`
			: source === "text"
			? `Génère un quiz basé sur ce texte :\n\n${prompt}`
			: `Génère un quiz basé sur les images fournies : ${prompt}`;

		if (provider === "ollama") {
			return callOllama(model, systemPrompt, userPrompt);
		} else {
			return callAnthropic(apiKey, model, systemPrompt, userPrompt);
		}
	}

	async function callAnthropic(apiKey, model, systemPrompt, userPrompt) {
		const { requestUrl } = require("obsidian");

		const headers = {
			"anthropic-version": "2023-06-01",
			"anthropic-dangerous-direct-browser-access": "true",
			"x-api-key": apiKey
		};

		// ── Step 1: Verify API key and check available models ──
		let availableModels = [];
		try {
			const modelsResp = await requestUrl({
				url: "https://api.anthropic.com/v1/models?limit=100",
				method: "GET",
				headers
			});
			const modelsData = modelsResp.json;
			availableModels = (modelsData?.data || []).map(m => m.id);
			console.log("[quiz-blocks] Available models:", availableModels.join(", "));

			if (!availableModels.includes(model)) {
				const fallback = availableModels.find(m => m.includes("sonnet")) || availableModels[0];
				console.log("[quiz-blocks] Model", model, "not available, falling back to:", fallback);
				model = fallback;
			}
		} catch (err) {
			console.warn("[quiz-blocks] Could not list models:", err?.status, err?.message);
			if (err?.status === 401 || err?.status === 403) {
				throw new Error("Clé API Anthropic invalide. Vérifiez sur console.anthropic.com/settings/keys");
			}
			// Continue anyway — the key might work for messages even if listing fails
		}

		// ── Step 2: Call Messages API ──
		// Try first with system param, then without as fallback
		const attempts = [
			{
				label: "with system param",
				body: {
					model,
					max_tokens: 4096,
					system: systemPrompt,
					messages: [{ role: "user", content: userPrompt }]
				}
			},
			{
				label: "system merged into user message",
				body: {
					model,
					max_tokens: 4096,
					messages: [{ role: "user", content: systemPrompt + "\n\n" + userPrompt }]
				}
			}
		];

		for (let i = 0; i < attempts.length; i++) {
			const attempt = attempts[i];
			console.log("[quiz-blocks] Attempt", i + 1, "(", attempt.label, ") with model:", model);

			try {
				const response = await requestUrl({
					url: "https://api.anthropic.com/v1/messages",
					method: "POST",
					headers,
					contentType: "application/json",
					body: attempt.body
				});

				const data = response.json;

				if (data?.error) {
					throw new Error("Erreur Anthropic : " + (data.error.message || data.error.type || JSON.stringify(data.error)));
				}

				const content = data?.content?.[0]?.text || "";
				if (!content.trim()) {
					throw new Error("L'IA n'a retourné aucune réponse. Réessayez ou changez de modèle.");
				}

				console.log("[quiz-blocks] Success with", attempt.label, "- response length:", content.length);
				return parseQuizResponse(content);

			} catch (err) {
				const status = err?.status || 0;
				console.error("[quiz-blocks] Attempt", i + 1, "failed:", status, err?.message);

				// Auth errors — no point retrying
				if (status === 401 || status === 403) {
					throw new Error("Clé API Anthropic invalide ou sans crédits. Vérifiez sur console.anthropic.com");
				}
				if (status === 429) {
					throw new Error("Limite de requêtes atteinte. Réessayez dans quelques instants.");
				}

				// 400 — try next attempt
				if (status === 400 && i < attempts.length - 1) {
					continue;
				}

				// Last attempt or non-retryable error
				throw new Error(
					"Erreur Anthropic (" + status + ") : " + (err?.message || "Connexion impossible") +
					". Modèle : " + model +
					(availableModels.length > 0 ? ". Modèles disponibles : " + availableModels.slice(0, 5).join(", ") : "")
				);
			}
		}
	}

	async function callOllama(model, systemPrompt, userPrompt) {
		const { requestUrl } = require("obsidian");

		const ollamaUrl = (plugin.settings.aiOllamaUrl || "http://localhost:11434").replace(/\/+$/, "");

		let response;
		try {
			response = await requestUrl({
				url: `${ollamaUrl}/api/generate`,
				method: "POST",
				contentType: "application/json",
				body: {
					model,
					prompt: `${systemPrompt}\n\n${userPrompt}`,
					stream: false,
					format: "json"
				}
			});
		} catch (err) {
			throw new Error("Impossible de contacter Ollama sur " + ollamaUrl + ". Vérifiez que le serveur est démarré.");
		}

		const data = response.json;

		if (data.error) {
			throw new Error("Erreur Ollama : " + data.error + ". Exécutez \"ollama pull " + model + "\" pour télécharger le modèle.");
		}

		const content = data.response || "";
		if (!content.trim()) {
			throw new Error("Ollama n'a retourné aucune réponse. Vérifiez que le modèle est installé.");
		}
		return parseQuizResponse(content);
	}

	function parseQuizResponse(content) {
		let cleaned = content.trim();

		const jsonMatch = cleaned.match(/```(?:json5?|json)?\s*\n?([\s\S]*?)\n?```/);
		if (jsonMatch) {
			cleaned = jsonMatch[1].trim();
		}

		const JSON5 = require("json5");
		const parsed = JSON5.parse(cleaned);

		if (!Array.isArray(parsed)) {
			throw new Error("La réponse IA n'est pas un tableau de questions.");
		}

		return parsed;
	}

	return { generate };
}

module.exports = createAiClient;