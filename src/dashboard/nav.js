'use strict';

/* ══════════════════════════════════════════════════════════
   NAVIGATION SIDEBAR — Dashboard
   Sidebar avec brand, nav items stylisés, note active.
══════════════════════════════════════════════════════════ */

function createNavHandlers(ctx) {
	let activeNav = "home";

	const NAV_ITEMS = [
		{ key: "home", label: "Accueil", icon: "home" },
		{ key: "quizzes", label: "Mes quiz", icon: "layers" },
		{ key: "ai", label: "Générer", icon: "sparkles" }
	];

	function render(container) {
		container.empty();

		// Brand header
		const brand = container.createDiv({ cls: "qbd-nav-brand" });
		const brandRow = brand.createDiv({ cls: "qbd-nav-brand-row" });
		const brandIcon = brandRow.createSpan({ cls: "qbd-nav-brand-icon" });
		obsidian.setIcon(brandIcon, "graduation-cap");
		brandRow.createEl("span", { cls: "qbd-nav-brand-title", text: "Quiz Blocks" });

		// Separator
		container.createDiv({ cls: "qbd-nav-sep" });

		// Nav items
		const navList = container.createDiv({ cls: "qbd-nav-items" });
		const quizzes = ctx.scanner ? ctx.scanner.getQuizzes() : [];

		for (const item of NAV_ITEMS) {
			const btn = navList.createEl("button", {
				cls: `qbd-nav-item ${activeNav === item.key ? "qbd-nav-item--active" : ""}`
			});

			const iconWrap = btn.createSpan({ cls: "qbd-nav-icon" });
			obsidian.setIcon(iconWrap, item.icon);

			btn.createSpan({ cls: "qbd-nav-label", text: item.label });

			if (item.key === "quizzes" && quizzes.length > 0) {
				btn.createSpan({ cls: "qbd-nav-badge", text: String(quizzes.length) });
			}

			btn.addEventListener("click", () => {
				activeNav = item.key;
				ctx.navigate(item.key);
			});
		}

		// Spacer pushes footer down
		container.createDiv({ cls: "qbd-nav-spacer" });

		// Footer — Active note
		const footer = container.createDiv({ cls: "qbd-nav-footer" });
		const footerLabel = footer.createDiv({ cls: "qbd-nav-footer-label-row" });
		const footerIcon = footerLabel.createSpan({ cls: "qbd-nav-footer-icon" });
		obsidian.setIcon(footerIcon, "file-text");
		footerLabel.createSpan({ text: "Note active" });

		const activeFile = ctx.getActiveFile();
		const notePath = activeFile ? activeFile.path : "Aucune note ouverte";
		footer.createEl("p", { cls: "qbd-nav-footer-path", text: notePath });
	}

	function setActive(key) {
		activeNav = key;
	}

	function updateActiveNote() {
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