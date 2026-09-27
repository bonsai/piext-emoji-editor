import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { homedir } from "node:os";

const AGENT_DIR = join(homedir(), ".pi/agent");
const GLOBAL_EXT_DIR = join(AGENT_DIR, "extensions");
const NPM_MODULES = join(AGENT_DIR, "npm/node_modules");

/* ------------------------------------------------------------------ */
/* ディレクトリスキャナ                                                */
/* ------------------------------------------------------------------ */
function scanDir(dir: string): string[] {
	if (!existsSync(dir)) return [];
	const out: string[] = [];
	for (const entry of readdirSync(dir)) {
		if (entry.startsWith(".")) continue;
		const full = join(dir, entry);
		try {
			const st = statSync(full);
			if (st.isFile() && (extname(entry) === ".ts" || extname(entry) === ".js")) {
				out.push(basename(entry, extname(entry)));
			} else if (
				st.isDirectory() &&
				(existsSync(join(full, "index.ts")) || existsSync(join(full, "index.js")))
			) {
				out.push(entry);
			}
		} catch {
			/* ignore */
		}
	}
	return out.sort();
}

function scanNpmPackages(): string[] {
	if (!existsSync(NPM_MODULES)) return [];
	const out: string[] = [];
	for (const entry of readdirSync(NPM_MODULES)) {
		if (entry.startsWith(".")) continue;
		const pkgPath = join(NPM_MODULES, entry, "package.json");
		try {
			if (!existsSync(pkgPath)) continue;
			const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
				keywords?: string[];
				pi?: unknown;
			};
			if (pkg.keywords?.includes("pi-package") || pkg.pi) {
				out.push(entry);
			}
		} catch {
			/* ignore */
		}
	}
	return out.sort();
}

function getExtensions(cwd: string, trusted: boolean): string[] {
	const all = new Set<string>();
	scanDir(GLOBAL_EXT_DIR).forEach((e) => all.add(e));
	if (trusted) {
		scanDir(join(cwd, ".pi/extensions")).forEach((e) => all.add(e));
	}
	scanNpmPackages().forEach((e) => all.add(e));
	return [...all].sort();
}

function grep(items: string[], pat?: string): string[] {
	if (!pat) return items;
	const p = pat.toLowerCase();
	return items.filter((x) => x.toLowerCase().includes(p));
}

/* ------------------------------------------------------------------ */
/* Extension 本体                                                       */
/* ------------------------------------------------------------------ */
export default function (pi: ExtensionAPI) {
	/* ---- ヘッダーを最小化（Context/Skills/Extensions の羅列を消す） ---- */
	pi.on("session_start", async (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		ctx.ui.setHeader((_tui, theme) => ({
			render(_w: number) {
				const logo = theme.fg("accent", "π ") + theme.fg("text", "pi coding agent");
				const hint = theme.fg(
					"muted",
					"  /soubi で装備確認 | ctrl+o help | /hotkeys",
				);
				return ["", logo, hint, ""];
			},
			invalidate() {},
		}));
	});

	/* ---- /soubi コマンド ---- */
	pi.registerCommand("soubi", {
		description: "スキル・コンテキスト・拡張機能をgrep的に表示",
		handler: async (args, ctx) => {
			const pat = args?.trim() || undefined;
			const opts = ctx.getSystemPromptOptions();

			const contexts = grep(
				(opts.contextFiles || []).map((f: any) => f.path),
				pat,
			);
			const skills = grep(
				(opts.skills || []).map((s: any) => s.name),
				pat,
			);
			const tools = grep(opts.selectedTools || [], pat);
			const extensions = grep(
				getExtensions(ctx.cwd, ctx.isProjectTrusted()),
				pat,
			);

			const lines: string[] = [];
			lines.push(pat ? `=== 装備検索: "${pat}" ===` : "=== 装備一覧 ===");

			const sections = [
				{ name: "Context", items: contexts },
				{ name: "Skills", items: skills },
				{ name: "Extensions", items: extensions },
				{ name: "Tools", items: tools },
			];

			let total = 0;
			for (const sec of sections) {
				// grep 時に該当0件のセクションはスキップ
				if (sec.items.length === 0 && pat) continue;
				lines.push(`\n[${sec.name}] (${sec.items.length})`);
				for (const item of sec.items) {
					lines.push(`  ${item}`);
				}
				total += sec.items.length;
			}

			if (total === 0) {
				lines.push("\n  (該当なし)");
			}

			ctx.ui.notify(lines.join("\n"), "info");
		},
	});

	/* ---- デフォルトヘッダーに戻すコマンド（必要なら） ---- */
	pi.registerCommand("soubi-off", {
		description: "デフォルトの起動ヘッダーに戻す",
		handler: async (_args, ctx) => {
			ctx.ui.setHeader(undefined);
			ctx.ui.notify("デフォルトヘッダーに戻しました。/reload で再適用", "info");
		},
	});
}
