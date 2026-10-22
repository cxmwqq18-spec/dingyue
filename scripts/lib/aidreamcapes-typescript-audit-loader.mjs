// Offline audit/test loader. Does not register global require hooks or run Next.
import fs from "node:fs";
import path from "node:path";
import Module, { createRequire } from "node:module";
import ts from "typescript";

export function aidreamcapesAuditLoader(mocks = {}) {
  const modules = new Map();
  const root = process.cwd();
  function load(filename) {
    const absolute = path.resolve(root, filename);
    if (modules.has(absolute)) return modules.get(absolute).exports;
    if (absolute.endsWith(".json")) return JSON.parse(fs.readFileSync(absolute, "utf8"));
    const mod = new Module(absolute);
    modules.set(absolute, mod);
    const nativeRequire = createRequire(absolute);
    mod.filename = absolute;
    mod.paths = Module._nodeModulePaths(path.dirname(absolute));
    mod.require = (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name === "server-only") return {};
      if (!name.startsWith("@/") && !name.startsWith(".")) return nativeRequire(name);
      const base = name.startsWith("@/") ? path.join(root, "src", name.slice(2)) : path.resolve(path.dirname(absolute), name);
      const resolved = [base, `${base}.ts`, `${base}.tsx`, `${base}.json`, path.join(base, "index.ts")]
        .find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      if (!resolved) throw new Error(`Cannot resolve ${name} from ${absolute}`);
      return load(resolved);
    };
    const result = ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX }
    });
    mod._compile(result.outputText, absolute);
    return mod.exports;
  }
  return load;
}
