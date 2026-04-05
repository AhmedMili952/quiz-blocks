'use strict';

const JSON5 = require("json5");

function parseQuizSource(source) {
	const raw = String(source ?? "").trim();

	if (raw.length === 0) return [];

	let parsed;
	try {
		parsed = JSON5.parse(raw);
	} catch (error) {
		throw new Error("Le bloc ```quiz-blocks doit contenir un tableau JSON5 valide.");
	}

	if (!Array.isArray(parsed)) {
		throw new Error("Le contenu du bloc quiz-blocks doit être un tableau.");
	}

	return parsed;
}

function extractExamOptions(quizArray) {
	if (!Array.isArray(quizArray) || quizArray.length === 0) return { questions: quizArray, examOptions: null };

	const lastItem = quizArray[quizArray.length - 1];
	if (lastItem && typeof lastItem === "object" && lastItem.examMode === true) {
		return {
			questions: quizArray.slice(0, -1),
			examOptions: {
				durationMinutes: Math.max(1, Math.min(180, Number(lastItem.examDurationMinutes) || 10)),
				autoSubmit: lastItem.examAutoSubmit !== false,
				showTimer: lastItem.examShowTimer !== false
			}
		};
	}

	return { questions: quizArray, examOptions: null };
}

function renderParagraph(container, text) {
	return container.createEl("p", {
		text: String(text ?? "")
	});
}

module.exports = { parseQuizSource, extractExamOptions, renderParagraph };
