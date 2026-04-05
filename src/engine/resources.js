'use strict';

module.exports = function createResourceHandlers(ctx) {
	const QUIZ_RESOURCE_NOTICE_MS = { defaultApp: 3400, androidSystem: 7200, fallbackOpen: 2400, warning: 3200, error: 3200 };

	function quizNotice(msg, timeout = 4000) {
		try { new ctx.Notice(String(msg), timeout); } catch (_) { console.log("[Quiz]", msg); }
	}

	function findVaultFilesByExactName(fileName) {
		const target = String(fileName ?? "").trim().toLowerCase();
		if (!target || typeof ctx.app === "undefined" || !ctx.app?.vault?.getFiles) return [];
		return ctx.app.vault.getFiles().filter(f => String(f?.name ?? "").trim().toLowerCase() === target);
	}

	async function revealFileInObsidianExplorer(file) {
		if (!file) return false;
		try {
			let leaf = (ctx.app.workspace?.getLeavesOfType?.("file-explorer") || [])[0];
			if (!leaf && typeof ctx.app.workspace?.getLeftLeaf === "function") {
				leaf = ctx.app.workspace.getLeftLeaf(false);
				if (leaf && typeof leaf.setViewState === "function") await leaf.setViewState({ type: "file-explorer", active: false });
			}
			if (!leaf) return false;
			await new Promise(r => setTimeout(r, 60));
			const view = leaf?.view;
			if (view && typeof view.revealInFolder === "function") {
				await view.revealInFolder(file);
				try { ctx.app.workspace?.revealLeaf?.(leaf); } catch (_) {}
				return true;
			}
		} catch (e) {
			console.warn("[Quiz] revealInFolder a échoué:", e);
		}
		return false;
	}

	async function openVaultFileFallback(file) {
		try {
			const leaf = ctx.app.workspace?.getLeaf?.(true);
			if (leaf && typeof leaf.openFile === "function") {
				await leaf.openFile(file);
				return true;
			}
		} catch (e) {
			console.warn("[Quiz] leaf.openFile a échoué:", e);
		}
		try {
			const url = ctx.app.vault?.getResourcePath?.(file);
			if (url) {
				window.open(url, "_blank");
				return true;
			}
		} catch (e) {
			console.warn("[Quiz] getResourcePath/window.open a échoué:", e);
		}
		return false;
	}

	async function openWithDefaultAppFromVault(file) {
		if (!file) return { ok: false, mode: "failed" };
		const isMobile = !!ctx.app?.isMobile;
		try {
			if (typeof ctx.app?.openWithDefaultApp === "function") {
				await ctx.app.openWithDefaultApp(file.path);
				return { ok: true, mode: isMobile ? "system-chooser" : "default-app" };
			}
		} catch (e) {
			console.warn("[Quiz] app.openWithDefaultApp a échoué:", e);
		}
		try {
			const adapter = ctx.app?.vault?.adapter;
			const absPath = adapter?.getFullPath?.(file.path);
			const shell = window.require?.("electron")?.shell;
			if (absPath && shell?.openPath) {
				const result = await shell.openPath(absPath);
				if (result === "") return { ok: true, mode: "default-app" };
			}
		} catch (e) {
			console.warn("[Quiz] fallback Electron openPath a échoué:", e);
		}
		return { ok: false, mode: "failed" };
	}

	async function handleQuizResourceButtonClick(fileName) {
		try {
			const rawName = String(fileName ?? "").trim();
			if (!rawName) return void quizNotice("Nom de fichier manquant.", QUIZ_RESOURCE_NOTICE_MS.warning);
			const matches = findVaultFilesByExactName(rawName);
			if (matches.length === 0) return void quizNotice(`Fichier introuvable dans le vault : ${rawName}`, QUIZ_RESOURCE_NOTICE_MS.warning);
			if (matches.length > 1) quizNotice(`Plusieurs fichiers portent ce nom (${rawName}). Premier résultat utilisé.`, QUIZ_RESOURCE_NOTICE_MS.warning);
			const file = matches[0];
			const revealed = await revealFileInObsidianExplorer(file);
			await new Promise(r => setTimeout(r, 180));
			const openResult = await openWithDefaultAppFromVault(file);
			if (openResult.ok && openResult.mode === "default-app") return void quizNotice(`Ouverture avec l'application par défaut : ${file.name}`, QUIZ_RESOURCE_NOTICE_MS.defaultApp);
			if (openResult.ok && openResult.mode === "system-chooser") return void quizNotice(`Ouverture via le système Android : ${file.name}`, QUIZ_RESOURCE_NOTICE_MS.androidSystem);
			const openedFallback = await openVaultFileFallback(file);
			if (openedFallback) return void quizNotice(`Ouverture interne (fallback) : ${file.name}`, QUIZ_RESOURCE_NOTICE_MS.fallbackOpen);
			quizNotice(
				revealed
					? `Fichier localisé, mais aucune application par défaut trouvée pour : ${file.name}`
					: `Impossible de révéler ou d'ouvrir le fichier : ${file.name}`,
				QUIZ_RESOURCE_NOTICE_MS.error
			);
		} catch (e) {
			console.error("[Quiz] handleQuizResourceButtonClick erreur:", e);
			quizNotice("Erreur pendant l'ouverture du fichier.", QUIZ_RESOURCE_NOTICE_MS.error);
		}
	}

	function bindQuizResourceButtons(rootEl = ctx.container) {
		if (!rootEl) return;

		rootEl.querySelectorAll(".quiz-resource-btn[data-resource-file]").forEach(btn => {
			const trigger = async e => {
				e.preventDefault();
				e.stopPropagation();
				await handleQuizResourceButtonClick(btn.dataset.resourceFile);
			};

			btn.addEventListener("click", trigger);
			btn.addEventListener("keydown", e => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					trigger(e);
				}
			});
		});
	}

	return {
		quizNotice,
		findVaultFilesByExactName,
		revealFileInObsidianExplorer,
		openVaultFileFallback,
		openWithDefaultAppFromVault,
		handleQuizResourceButtonClick,
		bindQuizResourceButtons
	};
};
