import { describe, expect, it } from "vitest";
import { createSlackProgram, runSlackCli } from "../src/cli.js";
import { vi } from "vitest";

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

  it("reports command errors without throwing to the caller", async () => {
    const errors: string[] = [];
    const previousExitCode = process.exitCode;
    vi.spyOn(console, "error").mockImplementation((message?: unknown) => {
      errors.push(String(message ?? ""));
    });
    process.exitCode = undefined;

    await expect(
      runSlackCli(["node", "slack", "channel", "list", "--limit", "0"]),
    ).resolves.toBeUndefined();

    expect(errors).toEqual(["Invalid limit: 0"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = previousExitCode;
  });
});
