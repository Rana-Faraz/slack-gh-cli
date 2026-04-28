import { describe, expect, it } from "vitest";
import { createSlackProgram } from "../src/cli.js";

describe("CLI help", () => {
  it("documents the top-level command groups", () => {
    const help = createSlackProgram().helpInformation();

    expect(help).toContain("Usage: slack [options] [command]");
    expect(help).toContain("auth");
    expect(help).toContain("workspace");
    expect(help).toContain("channel");
    expect(help).toContain("dm");
  });

  it("documents direct-message send options", () => {
    const dm = createSlackProgram().commands.find((command) => command.name() === "dm");
    const send = dm?.commands.find((command) => command.name() === "send");

    expect(send?.helpInformation()).toContain("--handle <handle>");
    expect(send?.helpInformation()).toContain("--dry-run");
    expect(send?.helpInformation()).toContain("--workspace <workspace>");
  });

  it("documents workspace persistence commands", () => {
    const workspace = createSlackProgram().commands.find(
      (command) => command.name() === "workspace",
    );
    const help = workspace?.helpInformation() ?? "";

    expect(help).toContain("list");
    expect(help).toContain("current");
    expect(help).toContain("use <workspace>");
    expect(help).toContain("clear");
  });
});
