'use strict';

const { escHtml, esc5, md2html } = require("./builder-utils");

function exportQuestion(q, idx) {
	const id = q.title ? q.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20) : `q${idx + 1}`;
	const e = esc5;
	const L = [];
	L.push("\t{");
	L.push(`\t\tid: '${e(id)}',`);
	L.push(`\t\ttitle: '${e(q.title || `Question ${idx + 1}`)}',`);
	if (q.resourceButton) L.push(`\t\tresourceButton: {\n\t\t\tlabel: '${e(q.resourceButton.label)}',\n\t\t\tfileName: '${e(q.resourceButton.fileName)}'\n\t\t},`);
	if (q._promptHtml) {
		L.push(`\t\tpromptHtml: '${e(q._promptHtml)}',`);
	} else if (q.prompt) {
		const hasMd = q.prompt && (/[*#`>\-]/.test(q.prompt) || q.prompt.includes("\n"));
		if (hasMd) L.push(`\t\tpromptHtml: '${e(md2html(q.prompt))}',`);
		else L.push(`\t\tprompt: '${e(q.prompt)}',`);
	}
	const t = q._type;
	if (t === "single") {
		L.push(`\t\toptions: [\n${q.options.map(o => `\t\t\t'${e(o)}',`).join("\n")}\n\t\t],`);
		L.push(`\t\tcorrectIndex: ${q.correctIndex ?? 0},`);
	}
	if (t === "multi") {
		L.push(`\t\toptions: [\n${q.options.map(o => `\t\t\t'${e(o)}',`).join("\n")}\n\t\t],`);
		L.push("\t\tmultiSelect: true,");
		L.push(`\t\tcorrectIndices: [${(q.correctIndices || []).join(", ")}],`);
	}
	if (t === "ordering") { L.push("\t\tordering: true,"); L.push(`\t\tslots: [${(q.slots || []).map(s => `'${e(s)}'`).join(", ")}],`); L.push(`\t\tpossibilities: [\n${(q.possibilities || []).map(p => `\t\t\t'${e(p)}',`).join("\n")}\n\t\t],`); L.push(`\t\tcorrectOrder: [${(q.correctOrder || []).join(", ")}]`); }
	if (t === "matching") { L.push("\t\tmatching: true,"); L.push(`\t\trows: [\n${(q.rows || []).map(r => `\t\t\t'${e(r)}',`).join("\n")}\n\t\t],`); L.push(`\t\tchoices: [\n${(q.choices || []).map(c => `\t\t\t'${e(c)}',`).join("\n")}\n\t\t],`); L.push(`\t\tcorrectMap: [${(q.correctMap || []).join(", ")}]`); }
	if (["text", "cmd", "powershell", "bash"].includes(t)) {
		L.push("\t\ttype: 'text',");
		if (t === "cmd") L.push("\t\tterminalVariant: 'cmd',");
		if (t === "powershell") L.push("\t\ttextVariant: 'powershell',");
		if (t === "bash") L.push("\t\ttextVariant: 'bash',");
		if (q.commandPrefix && (t === "cmd" || t === "powershell")) L.push(`\t\tcommandPrefix: '${e(q.commandPrefix)}',`);
		if (q.placeholder) L.push(`\t\tplaceholder: '${e(q.placeholder)}',`);
		if (q.caseSensitive) L.push("\t\tcaseSensitive: true,");
		L.push(`\t\tacceptedAnswers: [\n${(q.acceptedAnswers || []).filter(Boolean).map(a => `\t\t\t'${e(a)}',`).join("\n")}\n\t\t]`);
	}
	if (q.hint) {
		const hasExplain = q.explain || q._explainHtml;
		L.push(`\t\thint: '${e(q.hint)}'${hasExplain ? ',' : ''}`);
	}
	if (q._explainHtml) {
		L.push(`\t\texplainHtml: '${e(q._explainHtml)}'`);
	} else if (q.explain) {
		L.push(`\t\texplainHtml: '${e(md2html(q.explain))}'`);
	}

	if (q._extraFields && Object.keys(q._extraFields).length > 0) {
		for (const [key, val] of Object.entries(q._extraFields)) {
			if (typeof val === 'string') {
				L.push(`\t\t${key}: '${e(val)}',`);
			} else if (typeof val === 'number') {
				L.push(`\t\t${key}: ${val},`);
			} else if (typeof val === 'boolean') {
				L.push(`\t\t${key}: ${val},`);
			} else if (Array.isArray(val)) {
				const items = val.map(v => typeof v === 'string' ? `'${e(v)}'` : v).join(", ");
				L.push(`\t\t${key}: [${items}],`);
			}
		}
	}

	L.push("\t}");
	return L.join("\n");
}

function exportAll(questions, examOptions = null) {
	let result = "[\n" + questions.map((q, i) => exportQuestion(q, i)).join(",\n\n") + "\n]";
	if (examOptions && examOptions.enabled) {
		result += `,\n\n\t// Options mode examen\n\t{\n\t\texamMode: true,\n\t\texamDurationMinutes: ${examOptions.durationMinutes},\n\t\texamAutoSubmit: ${examOptions.autoSubmit},\n\t\texamShowTimer: ${examOptions.showTimer}\n\t}`;
	}
	return result;
}
function exportAllWithFence(questions, examOptions = null) { return "```quiz-blocks\n" + exportAll(questions, examOptions) + "\n```"; }

module.exports = { exportQuestion, exportAll, exportAllWithFence };
