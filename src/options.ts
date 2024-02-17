import { program, Option } from "commander";
import { version } from "../package.json";
import type { BunFig, Manifest } from "./bunfig";

interface CLIOptions {
  tag?: string;
}

const getCLIOptions = (): CLIOptions => {
  program
    .name("bunpublish")
    .description("CLI script for publishing npm packages with Bun")
    .version(version);

  program
    .addOption(new Option("-t, --tag <string>", "tag to be used for the version").default("latest"))

  return program.parse().opts();
}

export const getClientOptions = (bunFig: BunFig, m: Manifest) => {
  const reg = bunFig.pickRegistry(m.name);

  // https://docs.npmjs.com/cli/v10/configuring-npm/package-json#publishconfig
  const publishConfig = (m["publishConfig"] ?? {}) as {
    access?: string,
    registry?: string,
  };

  const registry = publishConfig.registry ?? reg;
  const token = bunFig.tokenFor(registry);

  const opts = getCLIOptions();

  return {
    access: publishConfig.access ?? "public",
    registry: registry,
    defaultTag: opts.tag,
    // https://github.com/npm/cli/issues/4250#issuecomment-976602325
    forceAuth: {
      token: token
    }
  };
};
