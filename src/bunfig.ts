import { dirname, join } from "path";
import { existsSync } from "fs";
import { readFile, rename, unlink, writeFile } from "fs/promises";
import { manifest } from "pacote";
import { globby } from "globby";

export type Manifest = Awaited<ReturnType<typeof manifest>> & {
  [K: string]: unknown;
};

export interface Registry {
  url: string;
  token?: string;
}

type Record<K extends string, V> = {
  [k in K]: V;
};

export class BunFig {
  static load = async (cwd: string): Promise<BunFig> => {
    const globalBunfigToml = join(process.env["HOME"]!, ".bunfig.toml");
    const localBunfigToml = join(cwd, "bunfig.toml");

    const config = new BunFig(cwd);

    if (existsSync(globalBunfigToml)) {
      config.registerBunFigFile(
        Bun.TOML.parse(String(await readFile(globalBunfigToml))),
        process.env as Record<string, string>
      );
    }
    if (existsSync(localBunfigToml)) {
      config.registerBunFigFile(
        Bun.TOML.parse(String(await readFile(localBunfigToml))),
        process.env as Record<string, string>
      );
    }

    return config;
  };

  private registries: Record<string, Registry> = {
    "": {
      url: "https://registry.npmjs.org"
    }
  };

  constructor(private root: string) {
  }

  async manifest(): Promise<
    Manifest & { _resolvedWorkspaces?: { [name: string]: Manifest } }
  > {
    const pkg = (await manifest(this.root)) as Manifest;

    if (pkg["workspaces"]) {
      const workspaces: { [name: string]: Manifest } = {};

      const files = await globby(
        (pkg["workspaces"] as string[]).map((p) => `${p}/package.json`),
        {
          cwd: this.root,
          absolute: true
        }
      );

      for (const f of files) {
        const m = (await manifest(dirname(f))) as Manifest;
        workspaces[m.name] = m;
      }

      return Object.assign(pkg, {
        _resolvedWorkspaces: workspaces
      });
    }

    return pkg;
  }

  registerBunFigFile(
    c: {
      install?: {
        registry?: string | Registry;
        scopes: Record<string, Registry>;
      };
    },
    env: Record<string, string> = {}
  ) {
    const r = new EnvVarReplacer(env);

    if (c.install?.registry) {
      this.registries[""] = {
        ...(this.registries[""] ?? {}),
        ...r.replaceValues(normalizeRegistry(c.install?.registry))
      };
    }

    if (c.install?.scopes) {
      const scopes = c.install?.scopes;

      for (let k in scopes) {
        const scope = scopes[k]!;
        if (!k.startsWith("@")) {
          k = `@${k}`;
        }
        this.registries[k] = {
          ...(this.registries[k] ?? {}),
          ...r.replaceValues(normalizeRegistry(scope))
        };
      }
    }
  }

  get defaultRegistry() {
    return this.registries[""]!;
  }

  pickRegistry(name: string) {
    if (name.startsWith("@")) {
      const scope = name.split("/")[0]!;
      return (this.registries[scope] ?? this.defaultRegistry).url;
    }
    return this.defaultRegistry.url;
  }

  tokenFor(url: string) {
    const u = new URL(url);
    for (const r of Object.values(this.registries)) {
      if (new URL(r.url).host == u.host) {
        return r.token;
      }
    }
    return this.defaultRegistry.token;
  }
}

export const normalizeRegistry = (s: string | Registry): Registry => {
  if (typeof s == "string") {
    return {
      url: s
    };
  }
  return s;
};

export const withoutWorkspace = async (
  m: Manifest,
  action: () => Promise<void>,
  workspaces: { [name: string]: Manifest } = {}
) => {
  const replaceWorkspace = async () => {
    await rename(
      join(m._resolved, "package.json"),
      join(m._resolved, "package.json.bak")
    );

    const pkg = JSON.parse(
      String(await readFile(join(m._resolved, "package.json.bak")))
    );

    const depKeys = [
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
      "bundledDependencies"
    ];

    for (const key of depKeys) {
      if (pkg[key]) {
        for (const pkgName in pkg[key]) {
          const version = pkg[key][pkgName];

          if (version.startsWith("workspace:")) {
            const w = workspaces[pkgName];
            if (w) {
              switch (version) {
                case "workspace:*":
                  pkg[key][pkgName] = w.version;
                  break;
                case "workspace:^":
                  pkg[key][pkgName] = `^${w.version}`;
              }
              continue;
            }
            throw Error(`missing workspace pkg ${pkgName}`);
          }
        }
      }
    }

    await writeFile(
      join(m._resolved, "package.json"),
      JSON.stringify(pkg, null, 2)
    );
  };

  const recover = async () => {
    try {
      await unlink(join(m._resolved, "package.json"));
      await rename(
        join(m._resolved, "package.json.bak"),
        join(m._resolved, "package.json")
      );
    } catch (e) {
      //
    }
  };

  try {
    await replaceWorkspace();
    await action();
    await recover();
  } catch (err) {
    await recover();
    throw err;
  }
};

const re = /(\$[A-Za-z0-9_]+)/g;

class EnvVarReplacer {
  constructor(private env: Record<string, any>) {
  }

  replaceValues<T extends Record<string, any>>(values: T): T {
    const replaced: Record<string, string> = {};

    for (const k in values) {
      const v = values[k]!;

      replaced[k] = v.replaceAll(re, (envVar: string) => {
        const found = this.env[envVar.slice(1)];
        if (typeof found == "undefined") {
          throw new Error(`missing env var ${envVar}`);
        }
        return found;
      });
    }

    return replaced as T;
  }
}
