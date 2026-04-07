import esbuild from "esbuild";
import fs from "fs";
import path from "path";

const production = process.argv.includes("production");
const watch = !production;

const vaultPluginDir = "C:/Obsidian/.obsidian/plugins/quiz-blocks";

function copyManifest() {
	fs.mkdirSync(vaultPluginDir, { recursive: true });
	fs.copyFileSync(
		path.resolve("src/assets/manifest.json"),
		path.join(vaultPluginDir, "manifest.json")
	);
	console.log("manifest.json copié.");
}

async function bundleCSS() {
	await esbuild.build({
		entryPoints: ["src/assets/css/index.css"],
		outfile: path.join(vaultPluginDir, "styles.css"),
		bundle: true,
		minify: production,
		logLevel: "info",
	});
	console.log("styles.css bundlé (tous les @import inlinés).");
}

const ctx = await esbuild.context({
	entryPoints: ["src/main.js"],
	outfile: path.join(vaultPluginDir, "main.js"),
	bundle: true,
	format: "cjs",
	platform: "node",
	target: "es2020",
	sourcemap: production ? false : "inline",
	external: [
		"obsidian",
		"electron"
	],
	logLevel: "info",
});

if (watch) {
	await ctx.watch();

	copyManifest();
	await bundleCSS();

	let cssRebuildTimer = null;

	fs.watch(path.resolve("src/assets"), { recursive: true, persistent: true }, (_eventType, filename) => {
		if (!filename) return;

		if (filename === "manifest.json") {
			try {
				copyManifest();
			} catch (error) {
				console.error("Erreur copie manifest :", error);
			}
		} else if (filename.endsWith(".css")) {
			// Debounce : éviter les rebuilds multiples sur des saves rapides
			if (cssRebuildTimer) clearTimeout(cssRebuildTimer);
			cssRebuildTimer = setTimeout(async () => {
				try {
					await bundleCSS();
				} catch (error) {
					console.error("Erreur bundle CSS :", error);
				}
			}, 80);
		}
	});

	console.log("Build en mode watch démarré.");
} else {
	await ctx.rebuild();
	copyManifest();
	await bundleCSS();
	await ctx.dispose();
	console.log("Build terminé.");
}
