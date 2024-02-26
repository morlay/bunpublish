import { program, Option } from "commander";
import { version } from "../package.json";
import type { BunFig, Manifest } from "./bunfig";

interface CLIOptions {
  access?: string;
  tag?: string;
  provenance?: boolean;
}

const _getCLIOptions = (): CLIOptions => {
  program
    .name("bunpublish")
    .description("CLI script for publishing npm packages with Bun")
    .version(version);

  program
    .addOption(new Option("-t, --tag <string>", "tag to be used for the version").default("latest"))
    .addOption(new Option("-a, --access <string>", "access level for the package").default("public"))
    .addOption(new Option("-p, --provenance", "when running in a supported CI environment, will trigger the generation of a signed provenance statement to be published alongside the package"));

  return program.parse().opts();
};

let _cliOptions: CLIOptions;

export const getCLIOptions = () => {
  return _cliOptions ??= _getCLIOptions();
};

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
    access: publishConfig.access ?? opts.access ?? "public",
    registry: registry,
    defaultTag: opts.tag,
    provenance: opts.provenance,
    // https://github.com/npm/cli/issues/4250#issuecomment-976602325
    forceAuth: {
      token: token
    }
  };
};
