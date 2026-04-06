'use strict';

const obsidian = require("obsidian");

const Q_TYPES = [
	{ key: "single", label: "Choix unique", lucide: "circle-dot", desc: "Une seule bonne réponse" },
	{ key: "multi", label: "Choix multiple", lucide: "check-square", desc: "Plusieurs bonnes réponses" },
	{ key: "ordering", label: "Classement", lucide: "arrow-up-down", desc: "Ordonner les éléments" },
	{ key: "matching", label: "Association", lucide: "link", desc: "Associer lignes et choix" },
	{ key: "text", label: "Texte libre", lucide: "type", desc: "Textarea classique" },
	{ key: "cmd", label: "Terminal CMD", lucide: "terminal", desc: "Invite de commandes Windows" },
	{ key: "powershell", label: "PowerShell", lucide: "terminal-square", desc: "Terminal PowerShell" },
	{ key: "bash", label: "Terminal Bash", lucide: "terminal", desc: "Terminal Linux/Bash" },
];

function loadReact() {
	if (typeof window.React !== 'undefined' && typeof window.ReactDOM !== 'undefined') {
		return { React: window.React, ReactDOM: window.ReactDOM };
	}
	return { React: null, ReactDOM: null };
}

function _setIcon(el, name) {
	console.log(`[QuizEditor] _setIcon: setting icon="${name}"`);
	try { obsidian.setIcon(el, name); } catch (_) {}
}
function _iconSpan(parent, name, cls) {
	console.log(`[QuizEditor] _iconSpan: creating icon span name="${name}"`);
	const s = parent.createSpan({ cls: cls || "qb-icon" }); _setIcon(s, name); return s;
}

function makeDefault(type) {
	console.log(`[QuizEditor] makeDefault: creating default question type="${type}"`);
	const b = { _type: type, _id: Math.random().toString(36).slice(2, 10), title: "", prompt: "", hint: "", explain: "", resourceButton: null };
	switch (type) {
		case "single": return { ...b, options: ["", ""], correctIndex: 0 };
		case "multi": return { ...b, options: ["", ""], correctIndices: [] };
		case "ordering": return { ...b, slots: ["Étape 1", "Étape 2"], possibilities: ["", ""], correctOrder: [0, 1] };
		case "matching": return { ...b, rows: ["", ""], choices: ["", ""], correctMap: [0, 0] };
		case "text": return { ...b, placeholder: "Votre réponse...", acceptedAnswers: [""], caseSensitive: false };
		case "cmd": return { ...b, placeholder: "", acceptedAnswers: [""], caseSensitive: false, commandPrefix: "C:\\>" };
		case "powershell": return { ...b, placeholder: "", acceptedAnswers: [""], caseSensitive: false, commandPrefix: "PS>" };
		case "bash": return { ...b, placeholder: "", acceptedAnswers: [""], caseSensitive: false };
		default: return b;
	}
}

function md2html(src) {
	if (!src) return "";
	console.log(`[QuizEditor] md2html: converting markdown, length=${src.length}`);
	return String(src)
		.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
		.replace(/^### (.+)$/gm, "<h3>$1</h3>")
		.replace(/^## (.+)$/gm, "<h2>$1</h2>")
		.replace(/^# (.+)$/gm, "<h1>$1</h1>")
		.replace(/`([^`\n]+)`/g, "<code>$1</code>")
		.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
		.replace(/\*(.+?)\*/g, "<em>$1</em>")
		.replace(/^- (.+)$/gm, "<li>$1</li>")
		.replace(/(<li>.*<\/li>\n?)+/g, m => "<ul>" + m + "</ul>")
		.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
		.replace(/(<blockquote>.*<\/blockquote>\n?)+/g, m => m.replace(/<\/blockquote>\n?<blockquote>/g, "\n"))
		.replace(/```(\w*)\n([\s\S]*?)```/g, (_, l, c) => "<pre><code>" + c.trim() + "</code></pre>")
		.replace(/!\[\[([^\]]+)\]\]/g, "<img src=\"$1\" class=\"qb-md-img\" />")
		.replace(/\n{2,}/g, "</p><p>")
		.replace(/\n/g, "<br>");
}

function escHtml(s) { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }

function esc5(s) { return String(s ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n"); }

module.exports = { Q_TYPES, loadReact, _setIcon, _iconSpan, makeDefault, md2html, escHtml, esc5 };
