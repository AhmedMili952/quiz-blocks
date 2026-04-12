'use strict';

/* ══════════════════════════════════════════════════════════
   AI CLIENT — Anthropic + Ollama
   Aucun recours à OpenAI. Utilise obsidian.requestUrl() pour CORS.
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

		// Construire le prompt système
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

	function extractAnthropicError(err) {
		// obsidian.requestUrl throws an error on non-2xx.
		// The response body is accessible via different properties depending on the version.
		let detail = "";
		let status = 0;

		// Try all possible ways to get the status code
		status = err?.status || err?.httpStatus || err?.statusCode || 0;

		// Try all possible ways to get the response body
		const tryParse = (obj) => {
			if (!obj) return null;
			if (typeof obj === "object" && obj.error) return obj;
			if (typeof obj === "string") {
				try { return JSON.parse(obj); } catch (_) { return null; }
			}
			return null;
		};

		// Check various properties where the response body might be
		const candidates = [
			err?.json,
			err?.data,
			err?.response?.json,
			err?.response?.data,
			err?.body,
			err?.responseText,
		];

		for (const candidate of candidates) {
			const parsed = tryParse(candidate);
			if (parsed?.error?.message) {
				detail = parsed.error.message;
				break;
			}
		}

		// Last resort: try to parse from error message
		if (!detail && err?.message) {
			const jsonMatch = err.message.match(/\{[\s\S]*"error"[\s\S]*\}/);
			if (jsonMatch) {
				const parsed = tryParse(jsonMatch[0]);
				if (parsed?.error?.message) {
					detail = parsed.error.message;
				}
			}
		}

		return { status, detail };
	}

	async function callAnthropic(apiKey, model, systemPrompt, userPrompt) {
		const { requestUrl } = require("obsidian");

		const requestBody = {
			model,
			max_tokens: 4096,
			system: systemPrompt,
			messages: [
				{ role: "user", content: userPrompt }
			]
		};

		console.log("[quiz-blocks] Anthropic request:", {
			url: "https://api.anthropic.com/v1/messages",
			model,
			apiKeyPrefix: apiKey.substring(0, 8) + "...",
			messageLength: userPrompt.length
		});

		let response;
		try {
			response = await requestUrl({
				url: "https://api.anthropic.com/v1/messages",
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"anthropic-version": "2023-06-01",
					"x-api-key": apiKey
				},
				body: JSON.stringify(requestBody)
			});
		} catch (err) {
			const { status, detail } = extractAnthropicError(err);
			console.error("[quiz-blocks] Anthropic error:", { status, detail, errMessage: err?.message, errKeys: Object.keys(err || {}) });

			if (status === 401 || status === 403) {
				throw new Error("Clé API Anthropic invalide. Vérifiez votre clé dans les paramètres.");
			}
			if (status === 429) {
				throw new Error("Limite de requêtes atteinte (rate limit). Réessayez dans quelques instants.");
			}
			if (status === 404) {
				throw new Error("Modèle " + model + " non trouvé. Vérifiez le nom du modèle dans les paramètres.");
			}
			if (status === 400) {
				throw new Error("Requête invalide (400)" + (detail ? " : " + detail : "") + ". Modèle utilisé : " + model);
			}
			throw new Error("Erreur Anthropic (" + (status || "réseau") + ")" + (detail ? " : " + detail : "") + " — " + (err.message || "Connexion impossible"));
		}

		const data = response.json;
		console.log("[quiz-blocks] Anthropic response keys:", Object.keys(data || {}));

		if (data.error) {
			throw new Error("Erreur Anthropic : " + (data.error.message || data.error.type || JSON.stringify(data.error)));
		}

		const content = data.content?.[0]?.text || "";
		if (!content.trim()) {
			throw new Error("L'IA n'a retourné aucune réponse. Réessayez ou changez de modèle.");
		}
		return parseQuizResponse(content);
	}

	async function callOllama(model, systemPrompt, userPrompt) {
		const { requestUrl } = require("obsidian");

		const ollamaUrl = (plugin.settings.aiOllamaUrl || "http://localhost:11434").replace(/\/+$/, "");

		let response;
		try {
			response = await requestUrl({
				url: `${ollamaUrl}/api/generate`,
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					model,
					prompt: `${systemPrompt}\n\n${userPrompt}`,
					stream: false,
					format: "json"
				})
			});
		} catch (err) {
			throw new Error("Impossible de contacter Ollama sur " + ollamaUrl + ". Vérifiez que le serveur est démarré et que l'URL est correcte.");
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
		// Nettoyer le contenu pour extraire le JSON
		let cleaned = content.trim();

		// Retirer les balises de code markdown si présentes
		const jsonMatch = cleaned.match(/```(?:json5?|json)?\s*\n?([\s\S]*?)\n?```/);
		if (jsonMatch) {
			cleaned = jsonMatch[1].trim();
		}

		// Essayer de parser avec JSON5
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