import { describe, expect, it } from "bun:test";
import { BunFig } from "../bunfig";

describe("BunFig", () => {
  const bunfig = new BunFig(process.cwd());

  it("register & pick", () => {
    bunfig.registerBunFigFile(
      {
        install: {
          scopes: {
            myorg: { token: "$npm_token", url: "https://registry.myorg.com/" }
          }
        }
      },
      {
        npm_token: "xxx"
      }
    );

    const r = bunfig.pickRegistry("@myorg/x");

    expect(r).toEqual("https://registry.myorg.com/");
  });
});
