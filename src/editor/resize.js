'use strict';

module.exports = function createResizeHandlers(ctx) {
	const view = ctx.view;

	function _setupResizer(resizerEl, leftPanel, rightPanel, type) {
		const dragState = { active: false, startX: 0, startLeftWidth: 0, startRightWidth: 0, rafId: 0, needsUpdate: false, delta: 0, mainEl: null };

		const updateSizes = () => {
			if (!dragState.needsUpdate || !dragState.mainEl) return;
			const main = dragState.mainEl;
			const { delta } = dragState;
			let newLeftWidth, newRightWidth;

			if (type === 'editor-preview') {
				const sidebarWidth = parseFloat(main.style.getPropertyValue('--qb-sidebar-w')) || ctx._savedWidths.sidebar;
				const editorWidth = parseFloat(main.style.getPropertyValue('--qb-editor-w')) || ctx._savedWidths.editor;
				const currentTotal = sidebarWidth + editorWidth;
				newLeftWidth = editorWidth + delta;
				const minPreviewWidth = 200;
				const maxLeft = currentTotal - minPreviewWidth;
				if (newLeftWidth <= ctx._hideThreshold && delta < 0) {
					view._closeLeftPanel('editor', main);
					dragState.needsUpdate = false;
					return;
				}
				if (newLeftWidth >= maxLeft && delta > 0) {
					view._closeRightPanel('preview', main);
					dragState.needsUpdate = false;
					return;
				}
				if (newLeftWidth >= ctx._minPanelWidth && newRightWidth >= minPreviewWidth) {
					main.style.setProperty('--qb-editor-w', `${Math.round(newLeftWidth)}px`);
				}
			} else if (type === 'preview-code') {
				const previewWidth = parseFloat(main.style.getPropertyValue('--qb-preview-w')) || ctx._savedWidths.preview;
				const codeWidth = parseFloat(main.style.getPropertyValue('--qb-code-w')) || ctx._savedWidths.code;
				newRightWidth = codeWidth - delta;
				newLeftWidth = previewWidth + delta;
				if (newRightWidth <= ctx._hideThreshold && delta > 0) {
					view._closeRightPanel('code', main);
					dragState.needsUpdate = false;
					return;
				}
				if (newLeftWidth <= ctx._hideThreshold && delta < 0) {
					view._closeLeftPanel('preview', main);
					dragState.needsUpdate = false;
					return;
				}
				if (newLeftWidth >= ctx._minPanelWidth && newRightWidth >= ctx._minPanelWidth) {
					main.style.setProperty('--qb-preview-w', `${Math.round(newLeftWidth)}px`);
					main.style.setProperty('--qb-code-w', `${Math.round(newRightWidth)}px`);
				}
			} else if (type === 'sidebar-editor') {
				const sidebarWidth = parseFloat(main.style.getPropertyValue('--qb-sidebar-w')) || ctx._savedWidths.sidebar;
				const editorWidth = parseFloat(main.style.getPropertyValue('--qb-editor-w')) || ctx._savedWidths.editor;
				newLeftWidth = sidebarWidth + delta;
				newRightWidth = editorWidth - delta;
				if (newLeftWidth <= ctx._hideThreshold && delta < 0) {
					view._closeLeftPanel('sidebar', main);
					dragState.needsUpdate = false;
					return;
				}
				if (newRightWidth <= ctx._hideThreshold && delta > 0) {
					view._closeRightPanel('editor', main);
					dragState.needsUpdate = false;
					return;
				}
				if (newLeftWidth >= ctx._minPanelWidth && newRightWidth >= ctx._minPanelWidth) {
					main.style.setProperty('--qb-sidebar-w', `${Math.round(newLeftWidth)}px`);
					main.style.setProperty('--qb-editor-w', `${Math.round(newRightWidth)}px`);
				}
			}
			dragState.needsUpdate = false;
		};

		const scheduleUpdate = () => {
			if (!dragState.needsUpdate) return;
			if (dragState.rafId) cancelAnimationFrame(dragState.rafId);
			dragState.rafId = requestAnimationFrame(() => {
				dragState.rafId = 0;
				updateSizes();
			});
		};

		resizerEl.addEventListener('mousedown', (e) => {
			if (e.button !== 0) return;
			dragState.active = true;
			dragState.startX = e.clientX;
			dragState.mainEl = view.contentEl.querySelector('.qb-main');
			if (!dragState.mainEl) return;

			if (type === 'sidebar-editor') {
				dragState.startLeftWidth = parseFloat(dragState.mainEl.style.getPropertyValue('--qb-sidebar-w')) || ctx._savedWidths.sidebar;
				dragState.startRightWidth = parseFloat(dragState.mainEl.style.getPropertyValue('--qb-editor-w')) || ctx._savedWidths.editor;
			} else if (type === 'editor-preview') {
				dragState.startLeftWidth = parseFloat(dragState.mainEl.style.getPropertyValue('--qb-editor-w')) || ctx._savedWidths.editor;
			} else if (type === 'preview-code') {
				dragState.startLeftWidth = parseFloat(dragState.mainEl.style.getPropertyValue('--qb-preview-w')) || ctx._savedWidths.preview;
				dragState.startRightWidth = parseFloat(dragState.mainEl.style.getPropertyValue('--qb-code-w')) || ctx._savedWidths.code;
			}

			document.body.style.cursor = type === 'sidebar-editor' ? 'col-resize' : type === 'editor-preview' ? 'col-resize' : 'col-resize';
			if (dragState.mainEl) dragState.mainEl.classList.add('is-resizing');
			e.preventDefault();
		});

		document.addEventListener('mousemove', (e) => {
			if (!dragState.active) return;
			dragState.delta = e.clientX - dragState.startX;
			dragState.needsUpdate = true;
			scheduleUpdate();
		});

		document.addEventListener('mouseup', () => {
			if (!dragState.active) return;
			dragState.active = false;
			document.body.style.cursor = '';
			if (dragState.rafId) {
				cancelAnimationFrame(dragState.rafId);
				dragState.rafId = 0;
			}
			if (dragState.needsUpdate) {
				updateSizes();
			}
			if (dragState.mainEl) dragState.mainEl.classList.remove('is-resizing');
			dragState.mainEl = null;
		});
	}

	function _closeLeftPanel(type, mainEl) {
		const panel = type === 'sidebar' ? 'sidebar' : type === 'editor' ? 'editor' : 'preview';
		ctx.panels[panel] = false;
		if (mainEl) {
			mainEl.style.setProperty(`--qb-${panel}-w`, '0px');
		}
		if (!Object.values(ctx.panels).some(Boolean)) {
			ctx.panels.preview = true;
			if (mainEl) {
				mainEl.style.setProperty('--qb-preview-w', `${ctx._savedWidths.preview}px`);
			}
		}
		view.syncPanels();
	}

	function _closeRightPanel(type, mainEl) {
		const panel = type === 'editor' ? 'editor' : type === 'preview' ? 'preview' : 'code';
		ctx.panels[panel] = false;
		if (mainEl) {
			mainEl.style.setProperty(`--qb-${panel}-w`, '0px');
		}
		if (!Object.values(ctx.panels).some(Boolean)) {
			ctx.panels.sidebar = true;
			if (mainEl) {
				mainEl.style.setProperty('--qb-sidebar-w', `${ctx._savedWidths.sidebar}px`);
			}
		}
		view.syncPanels();
	}

	return {
		_setupResizer,
		_closeLeftPanel,
		_closeRightPanel
	};
};
