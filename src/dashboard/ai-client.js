'use strict';

/* ══════════════════════════════════════════════════════════
   AI CLIENT — Anthropic + Ollama + API Compatible
   Utilise obsidian.requestUrl() pour éviter les problèmes CORS.
══════════════════════════════════════════════════════════ */

function createAiClient(plugin) {
	const DEFAULT_MODELS = {
		anthropic: "claude-sonnet-4-20250514",
		ollama: "llama3",
		compatible: "llama3"
	};

	async function generate(prompt, options = {}) {
		const { count = 5, type = "Mixte", source = "topic" } = options;
		const provider = plugin.settings.aiProvider || "anthropic";
		const apiKey = plugin.settings.aiApiKey || "";
		const model = plugin.settings.aiModel || DEFAULT_MODELS[provider];

		// Ollama local ne nécessite pas de clé API
		if (provider === "ollama" && !apiKey) {
			// OK, pas besoin de clé pour Ollama local
		} else if (!apiKey) {
			throw new Error("Clé API non configurée. Allez dans les paramètres du plugin.");
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
		} else if (provider === "compatible") {
			return callCompatible(apiKey, model, systemPrompt, userPrompt);
		} else {
			return callAnthropic(apiKey, model, systemPrompt, userPrompt);
		}
	}

	async function callAnthropic(apiKey, model, systemPrompt, userPrompt) {
		const { requestUrl } = require("obsidian");

		const response = await requestUrl({
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

		const content = response.json.content?.[0]?.text || "";
		return parseQuizResponse(content);
	}

	async function callOllama(model, systemPrompt, userPrompt) {
		const { requestUrl } = require("obsidian");

		const ollamaUrl = (plugin.settings.aiOllamaUrl || "http://localhost:11434").replace(/\/+$/, "");

		const response = await requestUrl({
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

		const content = response.json.response || "";
		return parseQuizResponse(content);
	}

	async function callCompatible(apiKey, model, systemPrompt, userPrompt) {
		const { requestUrl } = require("obsidian");

		// URL de base configurable : Groq, Together, OpenRouter, Mistral, etc.
		const baseUrl = (plugin.settings.aiCompatibleUrl || "https://api.groq.com/openai/v1").replace(/\/+$/, "");

		const response = await requestUrl({
			url: `${baseUrl}/chat/completions`,
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model,
				messages: [
					{ role: "system", content: systemPrompt },
					{ role: "user", content: userPrompt }
				],
				temperature: 0.7,
				max_tokens: 4096
			})
		});

		const content = response.json.choices?.[0]?.message?.content || "";
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