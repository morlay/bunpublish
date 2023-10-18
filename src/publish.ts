import { tarball, manifest } from "pacote";
import npmFetch from "npm-registry-fetch";
import { publish as npmPublish } from "libnpmpublish";
// @ts-ignore
import { Arborist } from "@npmcli/arborist";
import type { BunFig, Manifest } from "./bunfig";
import type { Logger } from "./log.ts";

const runScript = async (name: string, { cwd, logger }: { cwd: string, logger: Logger }): Promise<number> => {
  logger = logger.withName(name);

  const proc = Bun.spawn({
    cmd: ["bun", "run", name],
    cwd: cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env
    }
  });

  proc.stdout.pipeTo(new WritableStream({
    write(chunk) {
      logger.info(new TextDecoder().decode(chunk).trim());
    }
  }));

  proc.stderr.pipeTo(new WritableStream({
    write(chunk) {
      logger.error(new TextDecoder().decode(chunk).trim());
    }
  }));

  return await proc.exited;
};

const isPrivate = (manifest: Manifest) => {
  return manifest["private"] == true;
};


const getClientOptions = (bunFig: BunFig, m: Manifest) => {
  const reg = bunFig.pickRegistry(m.name);

  // https://docs.npmjs.com/cli/v10/configuring-npm/package-json#publishconfig
  const publishConfig = (m["publishConfig"] ?? {}) as {
    access?: string,
    registry?: string,
  };

  const registry = publishConfig.registry ?? reg;
  const token = bunFig.tokenFor(registry);

  return {
    access: publishConfig.access ?? "public",
    registry: registry,
    // https://github.com/npm/cli/issues/4250#issuecomment-976602325
    forceAuth: {
      token: token
    }
  };
};


const isPublished = async (manifest: Manifest, {
  options,
  logger
}: {
  options: ReturnType<typeof getClientOptions>
  logger: Logger,
}): Promise<boolean> => {
  try {
    // https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md#getpackage
    // /{version} may not impl
    const resp = await npmFetch(`/${encodeURIComponent(manifest.name)}`, options);

    const founded = (await resp.json())?.versions[manifest.version];
    if (founded) {
      logger.info(manifest.version, "published");
    }
    return founded;
  } catch (err) {
    if ((err as any).code == "E404") {
      return false;
    }
    throw err;
  }
};


export const publish = async (dir: string, {
  bunfig: bunFig,
  manifest: originManifest,
  logger: logger
}: {
  bunfig: BunFig,
  manifest: Manifest,
  logger: Logger
}) => {
  if (isPrivate(originManifest)) {
    return;
  }

  const opts = getClientOptions(bunFig, originManifest);

  if (await isPublished(originManifest, {
    options: opts,
    logger: logger
  })) {
    return;
  }

  const scripts = (originManifest["scripts"] ?? {}) as Record<string, string>;

  if (scripts["prepublishOnly"]) {
    await runScript("prepublishOnly", { cwd: dir, logger: logger });
  } else if (scripts["prepublish"]) {
    await runScript("prepublish", { cwd: dir, logger: logger });
  }

  if (scripts["prepare"]) {
    await runScript("prepare", { cwd: dir, logger: logger });
  }

  // reload for workspace protocol replaced.
  const m = await manifest(dir);

  if (scripts["prepack"]) {
    await runScript("prepack", { cwd: dir, logger: logger });
  }

  const tar = await tarball(m._from, { Arborist });

  if (scripts["postpack"]) {
    await runScript("postpack", { cwd: dir, logger: logger });
  }

  const publishLogger = logger.withName(`publish`);

  if (scripts["publish"]) {
    await runScript("publish", { cwd: dir, logger: logger });
  }

  publishLogger.info(m.version);

  await npmPublish(m as any, tar, opts);

  publishLogger.info("success");

  if (scripts["postpublish"]) {
    await runScript("postpublish", { cwd: dir, logger: logger });
  }
};


