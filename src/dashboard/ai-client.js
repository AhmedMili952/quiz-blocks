'use strict';

/* ══════════════════════════════════════════════════════════
   AI CLIENT — Anthropic + Ollama
   Utilise obsidian.requestUrl() pour bypasser CORS.
   Anthropic: header anthropic-dangerous-direct-browser-access requis.
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

	async function callAnthropic(apiKey, model, systemPrompt, userPrompt) {
		const { requestUrl } = require("obsidian");

		const commonHeaders = {
			"anthropic-version": "2023-06-01",
			"anthropic-dangerous-direct-browser-access": "true",
			"x-api-key": apiKey
		};

		// ── Step 1: Verify API key by listing models ──
		console.log("[quiz-blocks] Step 1: Verifying API key...");
		try {
			const modelsResp = await requestUrl({
				url: "https://api.anthropic.com/v1/models?limit=20",
				method: "GET",
				headers: commonHeaders
			});
			const modelsData = modelsResp.json;
			const availableModels = (modelsData?.data || []).map(m => m.id);
			console.log("[quiz-blocks] API key valid. Available models:", availableModels);

			// Check if requested model is available
			if (!availableModels.includes(model)) {
				const fallback = availableModels.find(m => m.includes("sonnet")) || availableModels[0];
				console.log("[quiz-blocks] Model " + model + " not in list, falling back to:", fallback);
				model = fallback;
			}
		} catch (err) {
			const status = err?.status || 0;
			console.error("[quiz-blocks] Model list failed:", status, err?.message);
			if (status === 401 || status === 403) {
				throw new Error("Clé API Anthropic invalide. Vérifiez votre clé sur console.anthropic.com/settings/keys");
			}
			// If we can't list models, just continue with the requested model
		}

		// ── Step 2: Call the Messages API ──
		console.log("[quiz-blocks] Step 2: Calling Messages API with model:", model);

		// Try with system as a content block array (newer format)
		let requestBody = {
			model,
			max_tokens: 4096,
			system: [{ type: "text", text: systemPrompt }],
			messages: [
				{ role: "user", content: userPrompt }
			]
		};

		let response;
		try {
			response = await requestUrl({
				url: "https://api.anthropic.com/v1/messages",
				method: "POST",
				headers: {
					...commonHeaders,
					"Content-Type": "application/json"
				},
				body: JSON.stringify(requestBody)
			});
		} catch (err) {
			const status = err?.status || 0;
			const errHeaders = err?.headers || {};
			console.error("[quiz-blocks] Messages API error:", {
				status,
				errMessage: err?.message,
				responseHeaders: errHeaders
			});

			// If system as array failed, try as string (older format)
			if (status === 400) {
				console.log("[quiz-blocks] Retrying with system as string...");
				requestBody.system = systemPrompt;

				try {
					response = await requestUrl({
						url: "https://api.anthropic.com/v1/messages",
						method: "POST",
						headers: {
							...commonHeaders,
							"Content-Type": "application/json"
						},
						body: JSON.stringify(requestBody)
					});
				} catch (retryErr) {
					const retryStatus = retryErr?.status || 0;
					console.error("[quiz-blocks] Retry also failed:", retryStatus, retryErr?.message);

					// Last resort: merge system prompt into user message
					if (retryStatus === 400) {
						console.log("[quiz-blocks] Last resort: merging system into user message...");
						const fallbackBody = {
							model,
							max_tokens: 4096,
							messages: [
								{ role: "user", content: systemPrompt + "\n\n" + userPrompt }
							]
						};

						try {
							response = await requestUrl({
								url: "https://api.anthropic.com/v1/messages",
								method: "POST",
								headers: {
									...commonHeaders,
									"Content-Type": "application/json"
								},
								body: JSON.stringify(fallbackBody)
							});
						} catch (finalErr) {
							const finalStatus = finalErr?.status || 0;
							throw new Error(
								"Toutes les tentatives ont échoué (" + finalStatus + "). " +
								"Vérifiez votre clé API et vos crédits sur console.anthropic.com. " +
								"Modèle : " + model
							);
						}
					} else {
						throw new Error("Erreur Anthropic (" + retryStatus + ") : " + (retryErr?.message || "Connexion impossible"));
					}
				}
			} else {
				throw new Error("Erreur Anthropic (" + status + ") : " + (err?.message || "Connexion impossible"));
			}
		}

		const data = response.json;

		if (data?.error) {
			throw new Error("Erreur Anthropic : " + (data.error.message || data.error.type || JSON.stringify(data.error)));
		}

		const content = data?.content?.[0]?.text || "";
		if (!content.trim()) {
			throw new Error("L'IA n'a retourné aucune réponse. Réessayez ou changez de modèle.");
		}
		console.log("[quiz-blocks] Success! Response length:", content.length);
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