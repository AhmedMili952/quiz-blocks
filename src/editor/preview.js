'use strict';

module.exports = function createPreviewHandlers(ctx) {
	const { md2html } = ctx;
	const view = ctx.view;

	function renderCode() {
		if (view.codeOutputEl) {
			view.codeOutputEl.textContent = ctx.exportAllWithFence(ctx.questions, ctx.examOptions);
		}
	}

	function _resolveImagesInHtml(html) {
		if (!html) return html;
		const temp = document.createElement('div');
		temp.innerHTML = html;
		temp.querySelectorAll("img.qb-md-img").forEach(img => {
			const fileName = img.getAttribute("src");
			if (fileName) {
				const attachFolder = view.app.vault.getConfig("attachmentFolderPath") || "";
				const folderPath = attachFolder.replace("${file}", "").replace(/\/$/, "") || ".";
				const filePath = folderPath === "." ? fileName : `${folderPath}/${fileName}`;
				const file = view.app.vault.getAbstractFileByPath(filePath);
				if (file) {
					img.src = view.app.vault.adapter.getResourcePath(filePath);
				}
			}
		});
		return temp.innerHTML;
	}

	return {
		renderCode,
		_resolveImagesInHtml
	};
};
