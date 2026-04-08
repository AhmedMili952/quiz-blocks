'use strict';

module.exports = function createSanitizer(ctx) {
	const QUIZ_HTML_ALLOWED_TAGS = new Set([
		"a", "b", "blockquote", "br", "center", "code", "details", "div", "em", "font",
		"h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "kbd", "li", "mark",
		"ol", "p", "pre", "samp", "small", "span", "strong", "sub", "summary", "sup",
		"table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul"
	]);

	const QUIZ_HTML_DROP_TAGS = new Set([
		"script", "style", "iframe", "object", "embed", "link", "meta"
	]);

	const QUIZ_HTML_GLOBAL_ATTRS = new Set([
		"class", "title", "role", "aria-label", "aria-hidden", "tabindex"
	]);

	const QUIZ_HTML_TAG_ATTRS = {
		a: new Set(["href", "target", "rel"]),
		img: new Set(["src", "alt", "width", "height"]),
		td: new Set(["colspan", "rowspan"]),
		th: new Set(["colspan", "rowspan"]),
		font: new Set(["color"])
	};

	function escapeHtmlAttr(value) {
		return String(value ?? "")
			.replace(/\&/g, "\&amp;")
			.replace(/"/g, "\&quot;")
			.replace(/'/g, "\&#39;")
			.replace(/\</g, "\&lt;")
			.replace(/\>/g, "\&gt;");
	}

	function escapeHtmlText(value) {
		return String(value ?? "")
			.replace(/\&/g, "\&amp;")
			.replace(/\</g, "\&lt;")
			.replace(/\>/g, "\&gt;")
			.replace(/"/g, "\&quot;")
			.replace(/'/g, "\&#39;");
	}

	function unescapeHtmlText(value) {
		return String(value ?? "")
			.replace(/\&lt;/g, "<")
			.replace(/\&gt;/g, ">")
			.replace(/\&quot;/g, '"')
			.replace(/\&#39;/g, "'")
			.replace(/\&amp;/g, "&");
	}

	function isSafeQuizUrl(value, { image = false } = {}) {
		const raw = String(value ?? "").trim();
		if (!raw) return false;

		if (
			raw.startsWith("#") ||
			raw.startsWith("/") ||
			raw.startsWith("./") ||
			raw.startsWith("../")
		) {
			return true;
		}

		if (/^(https?:|mailto:|tel:|obsidian:|app:|file:|blob:)/i.test(raw)) {
			return true;
		}

		if (image && /^data:image\//i.test(raw)) {
			return true;
		}

		return false;
	}

	function unwrapQuizHtmlElement(node) {
		const parent = node?.parentNode;
		if (!parent) return;

		while (node.firstChild) {
			parent.insertBefore(node.firstChild, node);
		}
		parent.removeChild(node);
	}

	function sanitizeQuizHtml(html) {
		const tpl = document.createElement("template");
		tpl.innerHTML = String(html ?? "");

		const walk = node => {
			if (!node) return;

			if (node.nodeType === Node.COMMENT_NODE) {
				node.remove();
				return;
			}

			if (node.nodeType !== Node.ELEMENT_NODE) return;

			const tag = node.tagName.toLowerCase();

			if (QUIZ_HTML_DROP_TAGS.has(tag)) {
				node.remove();
				return;
			}

			if (!QUIZ_HTML_ALLOWED_TAGS.has(tag)) {
				unwrapQuizHtmlElement(node);
				return;
			}

			const allowedAttrs = QUIZ_HTML_TAG_ATTRS[tag] || new Set();

			Array.from(node.attributes).forEach(attr => {
				const name = attr.name.toLowerCase();
				const value = attr.value;

				if (name.startsWith("on") || name === "style") {
					node.removeAttribute(attr.name);
					return;
				}

				if (!QUIZ_HTML_GLOBAL_ATTRS.has(name) && !allowedAttrs.has(name)) {
					node.removeAttribute(attr.name);
					return;
				}

				if (
					(name === "href" || name === "src") &&
					!isSafeQuizUrl(value, { image: name === "src" && tag === "img" })
				) {
					node.removeAttribute(attr.name);
					return;
				}

				if (
					(name === "width" || name === "height" || name === "colspan" || name === "rowspan") &&
					!/^\d{1,4}$/.test(String(value).trim())
				) {
					node.removeAttribute(attr.name);
					return;
				}

				if (name === "target" && !/^_(self|blank)$/.test(String(value).trim())) {
					node.removeAttribute(attr.name);
					return;
				}
			});

			if (tag === "a" && node.getAttribute("target") === "_blank") {
				node.setAttribute("rel", "noopener noreferrer");
			}

			Array.from(node.childNodes).forEach(walk);
		};

		Array.from(tpl.content.childNodes).forEach(walk);
		return tpl.innerHTML;
	}

	function renderInlineQuizHtml(raw) {
		return restoreAllowedInlineTags(
			escapeHtmlText(String(raw ?? "")).replace(/\n/g, "<br>")
		);
	}

	function resourceButtonHtml(q) {
		const rb = q?.resourceButton;
		if (!rb || !rb.label || !rb.fileName) return "";
		return `<button class="quiz-resource-btn" type="button" data-resource-file="${escapeHtmlAttr(rb.fileName)}"><span class="quiz-resource-btn-icon" aria-hidden="true">${ctx.lucideIcons?.paperclip || "⬇" }</span><span class="quiz-resource-btn-label">${escapeHtmlText(rb.label)}</span></button>`;
	}

	function resolveObsidianEmbedFile(linkPath) {
		const raw = String(linkPath ?? "").trim();
		if (!raw) return null;

		const currentFilePath = ctx.sourcePath || "";

		try {
			if (ctx.app?.metadataCache?.getFirstLinkpathDest) {
				const f = ctx.app.metadataCache.getFirstLinkpathDest(raw, currentFilePath);
				if (f) return f;
			}
		} catch (e) {
			console.warn("[Quiz] resolveObsidianEmbedFile erreur:", e);
		}

		try {
			const f2 = ctx.app?.vault?.getAbstractFileByPath?.(raw);
			if (f2) return f2;
		} catch (e) {
			console.warn("[Quiz] getAbstractFileByPath erreur:", e);
		}

		return null;
	}

	function parseObsidianEmbedSpec(spec) {
		const s = String(spec ?? "").trim();
		const parts = s.split("|");
		const linkPath = (parts[0] || "").trim();
		let width = null, height = null, alt = "";
		if (parts.length >= 2) {
			const p = (parts[1] || "").trim();
			if (/^\d+$/.test(p)) width = Number(p);
			else if (/^\d+x\d+$/i.test(p)) {
				const [w, h] = p.toLowerCase().split("x").map(n => Number(n));
				if (Number.isFinite(w)) width = w;
				if (Number.isFinite(h)) height = h;
			} else alt = p;
		}
		return { linkPath, width, height, alt };
	}

	function buildEmbedImgHtml(embedSpec, { wrapClass = "quiz-question-embed-wrap", imgClass = "quiz-question-embed" } = {}) {
		const parsed = parseObsidianEmbedSpec(embedSpec);
		const file = resolveObsidianEmbedFile(parsed.linkPath);
		if (file && typeof ctx.app?.vault?.getResourcePath === "function") {
			const src = ctx.app.vault.getResourcePath(file);
			const widthAttr = parsed.width ? ` width="${parsed.width}"` : "";
			const heightAttr = parsed.height ? ` height="${parsed.height}"` : "";
			const altAttr = escapeHtmlAttr(parsed.alt || file.name || "Image");
			return `<div class="${wrapClass}"><img class="${imgClass}" src="${src}" alt="${altAttr}" loading="eager"${widthAttr}${heightAttr}></div>`;
		}
		return `<code>${escapeHtmlText(`![[${embedSpec}]]`)}</code>`;
	}

	function restoreAllowedInlineTags(html) {
		return String(html ?? "")
			.replace(/\&lt;br\s*\/?\&gt;/gi, "<br>")
			.replace(/\&lt;(\/?)code\&gt;/gi, "<$1code>")
			.replace(/\&lt;(\/?)(strong|b|em|i|u|mark|kbd|samp|small|sub|sup)\&gt;/gi, "<$1$2>");
	}

	function renderTextWithEmbeds(raw, { wrapClass = "quiz-question-embed-wrap", imgClass = "quiz-question-embed" } = {}) {
		const text = String(raw ?? "");
		const embedRe = /!\[\[([^\]]+)\]\]/g;

		let html = "";
		let lastIndex = 0;
		let match;

		while ((match = embedRe.exec(text)) !== null) {
			const before = text.slice(lastIndex, match.index);

			if (before) {
				html += restoreAllowedInlineTags(
					escapeHtmlText(before).replace(/\n/g, "<br>")
				);
			}

			html += buildEmbedImgHtml(match[1], { wrapClass, imgClass });
			lastIndex = match.index + match[0].length;
		}

		const tail = text.slice(lastIndex);

		if (tail) {
			html += restoreAllowedInlineTags(
				escapeHtmlText(tail).replace(/\n/g, "<br>")
			);
		}

		return html;
	}

	function renderHintWithCodeAndEmbeds(raw) {
		return renderTextWithEmbeds(raw, {
			wrapClass: "quiz-hint-embed-wrap",
			imgClass: "quiz-hint-embed"
		});
	}

	function renderRawHtmlWithEmbeds(raw, { wrapClass = "quiz-question-embed-wrap", imgClass = "quiz-question-embed" } = {}) {
		return renderTextWithEmbeds(raw, { wrapClass, imgClass });
	}

	function replaceObsidianEmbedsInHtml(html, { wrapClass = "quiz-explain-embed-wrap", imgClass = "quiz-explain-embed" } = {}) {
		// NE PAS faire unescapeHtmlText ici car cela casserait l'affichage
		// des entités HTML comme &gt; qui doivent rester comme &gt; pour être
		// affichées comme > par le navigateur, pas interprétées comme des balises
		const content = String(html ?? "");
		return content.replace(/!\[\[([^\]]+)\]\]/g, (_, spec) => buildEmbedImgHtml(spec, { wrapClass, imgClass }));
	}

	return {
		escapeHtmlAttr,
		escapeHtmlText,
		unescapeHtmlText,
		isSafeQuizUrl,
		unwrapQuizHtmlElement,
		sanitizeQuizHtml,
		renderInlineQuizHtml,
		resourceButtonHtml,
		resolveObsidianEmbedFile,
		parseObsidianEmbedSpec,
		buildEmbedImgHtml,
		restoreAllowedInlineTags,
		renderTextWithEmbeds,
		renderHintWithCodeAndEmbeds,
		renderRawHtmlWithEmbeds,
		replaceObsidianEmbedsInHtml
	};
};