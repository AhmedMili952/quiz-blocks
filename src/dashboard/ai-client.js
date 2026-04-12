'use strict';

/* ══════════════════════════════════════════════════════════
   AI CLIENT — Anthropic + Ollama
   Aucun recours à OpenAI. Utilise obsidian.requestUrl() pour CORS.
══════════════════════════════════════════════════════════ */

function createAiClient(plugin) {
	const DEFAULT_MODELS = {
		anthropic: "claude-sonnet-4-6",
		ollama: "qwen3:14b",
	};

	async function generate(prompt, options = {}) {
		const { count = 5, type = "Mixte", source = "topic" } = options;
		const provider = plugin.settings.aiProvider || "anthropic";
		const apiKey = plugin.settings.aiApiKey || "";
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
				body: JSON.stringify({
					model,
					max_tokens: 4096,
					system: systemPrompt,
					messages: [
						{ role: "user", content: userPrompt }
					]
				})
			});
		} catch (err) {
			const status = err?.status || err?.httpStatus;
			// Try to extract Anthropic error details
			let detail = "";
			try {
				const errBody = typeof err?.json === "object" ? err.json : (typeof err?.data === "object" ? err.data : null);
				if (errBody?.error?.message) {
					detail = errBody.error.message;
				}
			} catch (_) { /* ignore parse errors */ }

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
				throw new Error("Requête invalide (400)" + (detail ? " : " + detail : "") + ". Vérifiez le modèle sélectionné.");
			}
			throw new Error("Erreur Anthropic (" + (status || "réseau") + ")" + (detail ? " : " + detail : "") + " — " + (err.message || "Connexion impossible"));
		}

		const data = response.json;

		if (data.error) {
			throw new Error("Erreur Anthropic : " + (data.error.message || data.error.type || "Erreur inconnue"));
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