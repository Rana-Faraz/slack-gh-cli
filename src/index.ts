#!/usr/bin/env node

import "dotenv/config";
import { runSlackCli } from "./cli.js";

await runSlackCli(process.argv);
