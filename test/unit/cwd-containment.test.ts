import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { CwdEscapeError, resolveChildCwd, resolveContainedCwd } from "../../src/shared/utils.ts";

describe("resolveChildCwd (silent clamp)", () => {
	const base = "/workspace";

	it("returns the base when no child cwd is given", () => {
		assert.equal(resolveChildCwd(base, undefined), base);
	});

	it("resolves a contained relative child", () => {
		assert.equal(resolveChildCwd(base, "pkg/sub"), path.join(base, "pkg/sub"));
	});

	it("clamps a relative traversal escape back to the base", () => {
		assert.equal(resolveChildCwd(base, "../../etc"), base);
	});

	it("clamps an absolute out-of-base path back to the base", () => {
		assert.equal(resolveChildCwd(base, "/etc"), base);
	});
});

describe("resolveContainedCwd (throwing)", () => {
	const base = "/workspace";

	it("returns the base when no child cwd is given", () => {
		assert.equal(resolveContainedCwd(base, undefined), base);
	});

	it("returns a contained path unchanged", () => {
		assert.equal(resolveContainedCwd(base, "pkg/sub"), path.join(base, "pkg/sub"));
	});

	it("throws CwdEscapeError on a relative traversal escape", () => {
		assert.throws(() => resolveContainedCwd(base, "../../etc"), CwdEscapeError);
	});

	it("throws CwdEscapeError on an absolute out-of-base path", () => {
		assert.throws(() => resolveContainedCwd(base, "/host/etc"), CwdEscapeError);
	});
});

describe("cwd containment resolves symlinks", () => {
	let root: string;
	let workspace: string;
	let outside: string;

	before(() => {
		root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "cwd-contain-")));
		workspace = path.join(root, "workspace");
		outside = path.join(root, "outside");
		fs.mkdirSync(workspace);
		fs.mkdirSync(outside);
		// A symlink inside the workspace pointing outside it — a lexical check would
		// treat this as contained; a canonicalizing check must reject it.
		fs.symlinkSync(outside, path.join(workspace, "escape"));
	});

	after(() => {
		fs.rmSync(root, { recursive: true, force: true });
	});

	it("clamps a symlink that escapes the base", () => {
		assert.equal(resolveChildCwd(workspace, "escape"), workspace);
	});

	it("throws on a symlink that escapes the base", () => {
		assert.throws(() => resolveContainedCwd(workspace, "escape"), CwdEscapeError);
	});

	it("allows a symlink that stays within the base", () => {
		const insideTarget = path.join(workspace, "real");
		fs.mkdirSync(insideTarget);
		fs.symlinkSync(insideTarget, path.join(workspace, "inside"));
		assert.equal(resolveContainedCwd(workspace, "inside"), path.join(workspace, "inside"));
	});
});
