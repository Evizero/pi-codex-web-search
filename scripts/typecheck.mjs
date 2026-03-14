import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import Module from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync, spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const tempDir = mkdtempSync(join(tmpdir(), "pi-codex-web-search-tsc-"));
const tempConfigPath = join(tempDir, "tsconfig.json");

function getPiPackageCandidates() {
	const candidates = new Set();

	if (process.env.PI_CODING_AGENT_PATH) {
		candidates.add(process.env.PI_CODING_AGENT_PATH);
	}

	candidates.add(join(repoRoot, "node_modules", "@mariozechner", "pi-coding-agent"));

	for (const globalPath of Module.globalPaths) {
		candidates.add(join(globalPath, "@mariozechner", "pi-coding-agent"));
	}

	try {
		const npmRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
		if (npmRoot) {
			candidates.add(join(npmRoot, "@mariozechner", "pi-coding-agent"));
		}
	} catch {
		// Ignore npm lookup failures and keep trying other locations.
	}

	return [...candidates];
}

function findPiPackageRoot() {
	return getPiPackageCandidates().find((candidate) => existsSync(join(candidate, "dist", "index.d.ts")));
}

let exitCode = 1;

try {
	const piPackageRoot = findPiPackageRoot();
	if (!piPackageRoot) {
		console.error(
			"Could not find @mariozechner/pi-coding-agent types. Install pi locally, make it available globally, or set PI_CODING_AGENT_PATH.",
		);
	} else {
		const piTypesPath = join(piPackageRoot, "dist", "index.d.ts");
		const nodeTypeRoots = join(piPackageRoot, "node_modules", "@types");

		if (!existsSync(nodeTypeRoots)) {
			console.error(`Could not find Node type roots at ${nodeTypeRoots}`);
		} else {
			const tsconfig = {
				compilerOptions: {
					noEmit: true,
					strict: true,
					module: "NodeNext",
					moduleResolution: "NodeNext",
					target: "ES2022",
					allowSyntheticDefaultImports: true,
					skipLibCheck: true,
					types: ["node"],
					typeRoots: [nodeTypeRoots],
					baseUrl: repoRoot,
					paths: {
						"@mariozechner/pi-coding-agent": [piTypesPath],
					},
				},
				include: [join(repoRoot, "extensions", "**", "*.ts")],
			};

			writeFileSync(tempConfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`, "utf8");

			const result = spawnSync(
				"npx",
				["--yes", "-p", "typescript", "tsc", "-p", tempConfigPath],
				{
					cwd: repoRoot,
					stdio: "inherit",
				},
			);

			exitCode = result.status ?? 1;
		}
	}
} finally {
	rmSync(tempDir, { recursive: true, force: true });
}

process.exit(exitCode);
