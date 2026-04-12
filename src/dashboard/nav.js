'use strict';

/* ══════════════════════════════════════════════════════════
   NAVIGATION SIDEBAR — Dashboard
══════════════════════════════════════════════════════════ */

function createNavHandlers(ctx) {
	let activeNav = "home";

	const NAV_ITEMS = [
		{ key: "home", label: "Accueil", icon: "home" },
		{ key: "quizzes", label: "Mes quiz", icon: "layers" },
		{ key: "ai", label: "Générer un quiz", icon: "sparkles" }
	];

	function render(container) {
		container.empty();

		// Brand
		const brand = container.createDiv({ cls: "qbd-nav-brand" });
		brand.createEl("p", { cls: "qbd-nav-brand-title", text: "Quiz Blocks" });
		brand.createEl("p", { cls: "qbd-nav-brand-sub", text: "dashboard · obsidian" });

		// Nav items
		const navList = container.createDiv({ cls: "qbd-nav-items" });
		const quizzes = ctx.scanner ? ctx.scanner.getQuizzes() : [];

		for (const item of NAV_ITEMS) {
			const btn = navList.createEl("button", {
				cls: `qbd-nav-item ${activeNav === item.key ? "qbd-nav-item--active" : ""}`
			});

			const iconSpan = btn.createSpan({ cls: "qbd-nav-icon" });
			obsidian.setIcon(iconSpan, item.icon);

			btn.createSpan({ cls: "qbd-nav-label", text: item.label });

			if (item.key === "quizzes" && quizzes.length > 0) {
				btn.createSpan({ cls: "qbd-nav-badge", text: String(quizzes.length) });
			}

			btn.addEventListener("click", () => {
				activeNav = item.key;
				ctx.navigate(item.key);
			});
		}

		// Footer — Note active
		const footer = container.createDiv({ cls: "qbd-nav-footer" });
		footer.createEl("p", { cls: "qbd-nav-footer-label", text: "Note active" });
		const activeFile = ctx.getActiveFile();
		const notePath = activeFile ? activeFile.path : "Aucune note ouverte";
		footer.createEl("p", { cls: "qbd-nav-footer-path", text: notePath });
	}

	function setActive(key) {
		activeNav = key;
	}

	function updateActiveNote() {
		// Re-render le footer si le view est ouvert
		const footerEl = ctx.navEl.querySelector(".qbd-nav-footer");
		if (footerEl) {
			const pathEl = footerEl.querySelector(".qbd-nav-footer-path");
			if (pathEl) {
				const activeFile = ctx.getActiveFile();
				pathEl.textContent = activeFile ? activeFile.path : "Aucune note ouverte";
			}
		}
	}

	return { render, setActive, updateActiveNote };
}

const obsidian = require("obsidian");
module.exports = createNavHandlers;