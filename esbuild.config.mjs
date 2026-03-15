import esbuild from "esbuild";
import fs from "fs";
import path from "path"; 

const production = process.argv.includes("production");
const watch = !production;

const vaultPluginDir = "C:/Obsidian/.obsidian/plugins/quiz-blocks";

const copyStaticFiles = () => {
	fs.mkdirSync(vaultPluginDir, { recursive: true });

	fs.copyFileSync(
		path.resolve("src/assets/manifest.json"),
		path.join(vaultPluginDir, "manifest.json")
	);

	fs.copyFileSync(
		path.resolve("src/assets/styles.css"),
		path.join(vaultPluginDir, "styles.css")
	);

	console.log("manifest.json et styles.css copiés.");
};

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

	copyStaticFiles();

	fs.watch(path.resolve("src/assets"), { persistent: true }, (_eventType, filename) => {
		if (!filename) return;

		if (filename === "manifest.json" || filename === "styles.css") {
			try {
				copyStaticFiles();
			} catch (error) {
				console.error("Erreur pendant la copie des fichiers statiques :", error);
			}
		}
	});

	console.log("Build en mode watch démarré.");
} else {
	await ctx.rebuild();
	copyStaticFiles();
	await ctx.dispose();
	console.log("Build terminé.");
}