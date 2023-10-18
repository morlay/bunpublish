#!/usr/bin/env bun
import { BunFig, createLogger, publish, withoutWorkspace } from "../src";

const cwd = process.cwd();

const bunFig = await BunFig.load(cwd);

const m = await bunFig.manifest();
const workspaces = m._resolvedWorkspaces ?? {};

// publish sub pkg
for (const m in workspaces) {
  const sub = workspaces[m]!;
  await withoutWorkspace(
    sub,
    () => {
      return publish(sub._resolved, {
        bunfig: bunFig,
        manifest: sub,
        logger: createLogger(sub.name)
      });
    },
    workspaces
  );
}


// publish root
await publish(m._resolved, {
  bunfig: bunFig,
  manifest: m,
  logger: createLogger(m.name)
});
