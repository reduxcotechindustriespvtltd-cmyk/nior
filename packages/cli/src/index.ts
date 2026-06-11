#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import Conf from "conf";
import axios, { AxiosInstance } from "axios";
import Table from "cli-table3";

// ─── Config store ────────────────────────────────────────────────────────────

interface SpecterConfig {
  token: string;
  email: string;
  apiBase: string;
}

const store = new Conf<SpecterConfig>({
  projectName: "specter-cli",
  defaults: {
    token: "",
    email: "",
    apiBase: "https://api.specter.sh",
  },
});

// ─── Axios factory ───────────────────────────────────────────────────────────

function getClient(): AxiosInstance {
  const token = store.get("token");
  if (!token) {
    console.error(chalk.red("Not authenticated. Run `specter login` first."));
    process.exit(1);
  }
  return axios.create({
    baseURL: store.get("apiBase"),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    timeout: 15_000,
  });
}

function unauthenticatedClient(): AxiosInstance {
  return axios.create({
    baseURL: store.get("apiBase"),
    headers: { "Content-Type": "application/json" },
    timeout: 15_000,
  });
}

// ─── ASCII Banner ─────────────────────────────────────────────────────────────

function printBanner(): void {
  console.log(
    chalk.cyan(`
  ███████╗██████╗ ███████╗ ██████╗████████╗███████╗██████╗
  ██╔════╝██╔══██╗██╔════╝██╔════╝╚══██╔══╝██╔════╝██╔══██╗
  ███████╗██████╔╝█████╗  ██║        ██║   █████╗  ██████╔╝
  ╚════██║██╔═══╝ ██╔══╝  ██║        ██║   ██╔══╝  ██╔══██╗
  ███████║██║     ███████╗╚██████╗   ██║   ███████╗██║  ██║
  ╚══════╝╚═╝     ╚══════╝ ╚═════╝   ╚═╝   ╚══════╝╚═╝  ╚═╝
`)
  );
  console.log(
    chalk.gray("  Kill-switch infrastructure for modern web applications.\n")
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return chalk.gray("—");
  return new Date(iso).toLocaleString();
}

function modeColor(mode: string): string {
  const map: Record<string, (s: string) => string> = {
    freeze: chalk.blue,
    overlay: chalk.magenta,
    redirect: chalk.yellow,
    ghost: chalk.gray,
    timebomb: chalk.red,
  };
  return (map[mode] ?? chalk.white)(mode ?? "—");
}

function statusBadge(status: string): string {
  return status === "live"
    ? chalk.green.bold("● LIVE")
    : chalk.red.bold("■ KILLED");
}

// ─── Commands ─────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name("specter")
  .description("Kill-switch CLI for Specter infrastructure")
  .version("1.0.0")
  .addHelpText("beforeAll", () => {
    // Only print banner when user runs `specter` with no subcommand
    return "";
  });

// ── login ────────────────────────────────────────────────────────────────────

program
  .command("login")
  .description("Authenticate with Specter and store credentials")
  .option("--api-base <url>", "Override API base URL")
  .action(async (opts) => {
    if (opts.apiBase) store.set("apiBase", opts.apiBase);

    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "email",
        message: chalk.cyan("Email:"),
        validate: (v) => (v.includes("@") ? true : "Enter a valid email"),
      },
      {
        type: "password",
        name: "password",
        message: chalk.cyan("Password:"),
        mask: "*",
        validate: (v) => (v.length >= 6 ? true : "Password too short"),
      },
    ]);

    const spinner = ora("Authenticating...").start();
    try {
      const client = unauthenticatedClient();
      const { data } = await client.post("/auth/login", {
        email: answers.email,
        password: answers.password,
      });

      store.set("token", data.token);
      store.set("email", answers.email);
      spinner.succeed(chalk.green(`Logged in as ${chalk.bold(answers.email)}`));
    } catch (err: any) {
      spinner.fail(
        chalk.red(
          "Authentication failed: " +
            (err.response?.data?.message ?? err.message)
        )
      );
      process.exit(1);
    }
  });

// ── logout ───────────────────────────────────────────────────────────────────

program
  .command("logout")
  .description("Clear stored credentials")
  .action(() => {
    const email = store.get("email");
    store.set("token", "");
    store.set("email", "");
    console.log(
      chalk.yellow(`Logged out${email ? ` (was ${chalk.bold(email)})` : ""}.`)
    );
  });

// ── sites ────────────────────────────────────────────────────────────────────

program
  .command("sites")
  .description("List all sites in your account")
  .option("--json", "Output raw JSON")
  .action(async (opts) => {
    const spinner = ora("Fetching sites...").start();
    try {
      const { data } = await getClient().get("/sites");
      spinner.stop();

      if (opts.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }

      if (!data.sites?.length) {
        console.log(
          chalk.yellow("No sites found. Run `specter init` to create one.")
        );
        return;
      }

      const table = new Table({
        head: [
          chalk.white.bold("ID"),
          chalk.white.bold("Name"),
          chalk.white.bold("Status"),
          chalk.white.bold("Mode"),
          chalk.white.bold("Domain"),
          chalk.white.bold("Last Event"),
        ],
        style: { head: [], border: ["gray"] },
        colWidths: [14, 22, 12, 12, 28, 24],
      });

      for (const site of data.sites) {
        table.push([
          chalk.gray(site.id),
          chalk.white(site.name),
          statusBadge(site.status),
          modeColor(site.killMode ?? "—"),
          chalk.cyan(site.domain ?? "—"),
          chalk.gray(formatDate(site.lastEventAt)),
        ]);
      }

      console.log(table.toString());
      console.log(
        chalk.gray(`\n  ${data.sites.length} site(s) in your account.\n`)
      );
    } catch (err: any) {
      spinner.fail(
        chalk.red("Failed to fetch sites: " + (err.response?.data?.message ?? err.message))
      );
      process.exit(1);
    }
  });

// ── kill ─────────────────────────────────────────────────────────────────────

program
  .command("kill <siteId>")
  .description("Trigger the kill switch for a site")
  .option(
    "--mode <mode>",
    "Kill mode: freeze | overlay | redirect | ghost | timebomb",
    "freeze"
  )
  .option("--url <redirectUrl>", "Redirect URL (required for redirect mode)")
  .option(
    "--at <timestamp>",
    "Schedule kill at ISO timestamp (for timebomb mode)"
  )
  .option("-y, --yes", "Skip confirmation prompt")
  .action(async (siteId, opts) => {
    const validModes = ["freeze", "overlay", "redirect", "ghost", "timebomb"];
    if (!validModes.includes(opts.mode)) {
      console.error(
        chalk.red(`Invalid mode "${opts.mode}". Choose from: ${validModes.join(", ")}`)
      );
      process.exit(1);
    }

    if (opts.mode === "redirect" && !opts.url) {
      console.error(
        chalk.red("--url is required when using redirect mode.")
      );
      process.exit(1);
    }

    if (!opts.yes) {
      const { confirm } = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirm",
          message: chalk.red.bold(
            `Are you sure you want to KILL site ${chalk.white(siteId)} [mode: ${opts.mode}]?`
          ),
          default: false,
        },
      ]);
      if (!confirm) {
        console.log(chalk.yellow("Aborted."));
        return;
      }
    }

    const spinner = ora({
      text: chalk.red(`Triggering kill switch on ${siteId}...`),
      color: "red",
    }).start();

    try {
      const payload: Record<string, unknown> = {
        mode: opts.mode,
        ...(opts.url ? { redirectUrl: opts.url } : {}),
        ...(opts.at ? { scheduledAt: opts.at } : {}),
      };

      await getClient().post(`/sites/${siteId}/kill`, payload);
      spinner.stop();

      console.log(
        chalk.red.bold(`
  ████████████████████████████████████████████████
  ██                                            ██
  ██   💀  SITE KILLED                          ██
  ██                                            ██
  ██   Site ID : ${siteId.padEnd(28)} ██
  ██   Mode    : ${opts.mode.padEnd(28)} ██
  ${opts.url ? `██   URL     : ${opts.url.substring(0, 28).padEnd(28)} ██` : "██" + " ".repeat(44) + "██"}
  ${opts.at ? `██   At      : ${opts.at.substring(0, 28).padEnd(28)} ██` : "██" + " ".repeat(44) + "██"}
  ██                                            ██
  ████████████████████████████████████████████████
`)
      );
    } catch (err: any) {
      spinner.fail(
        chalk.red(
          "Kill switch failed: " + (err.response?.data?.message ?? err.message)
        )
      );
      process.exit(1);
    }
  });

// ── restore ──────────────────────────────────────────────────────────────────

program
  .command("restore <siteId>")
  .description("Restore a killed site back to live")
  .option("-y, --yes", "Skip confirmation prompt")
  .action(async (siteId, opts) => {
    if (!opts.yes) {
      const { confirm } = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirm",
          message: chalk.green(`Restore site ${chalk.white(siteId)} to live?`),
          default: true,
        },
      ]);
      if (!confirm) {
        console.log(chalk.yellow("Aborted."));
        return;
      }
    }

    const spinner = ora({
      text: chalk.green(`Restoring ${siteId}...`),
      color: "green",
    }).start();

    try {
      await getClient().post(`/sites/${siteId}/restore`);
      spinner.stop();

      console.log(
        chalk.green.bold(`
  ╔══════════════════════════════════════════════╗
  ║                                              ║
  ║   ✅  SITE RESTORED                          ║
  ║                                              ║
  ║   Site ${siteId.padEnd(38)}║
  ║   Status: LIVE                               ║
  ║                                              ║
  ╚══════════════════════════════════════════════╝
`)
      );
    } catch (err: any) {
      spinner.fail(
        chalk.red(
          "Restore failed: " + (err.response?.data?.message ?? err.message)
        )
      );
      process.exit(1);
    }
  });

// ── status ───────────────────────────────────────────────────────────────────

program
  .command("status <siteId>")
  .description("Show current status for a site")
  .option("--json", "Output raw JSON")
  .action(async (siteId, opts) => {
    const spinner = ora("Fetching status...").start();
    try {
      const { data } = await getClient().get(`/sites/${siteId}/status`);
      spinner.stop();

      if (opts.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }

      const s = data.site ?? data;

      console.log(`
  ${chalk.white.bold("Site:")}     ${chalk.cyan(s.name ?? siteId)}
  ${chalk.white.bold("ID:")}       ${chalk.gray(s.id ?? siteId)}
  ${chalk.white.bold("Domain:")}   ${chalk.cyan(s.domain ?? "—")}
  ${chalk.white.bold("Status:")}   ${statusBadge(s.status)}
  ${chalk.white.bold("Mode:")}     ${modeColor(s.killMode ?? "—")}
  ${chalk.white.bold("Last event:")} ${chalk.gray(formatDate(s.lastEventAt))}
  ${chalk.white.bold("Created:")}  ${chalk.gray(formatDate(s.createdAt))}
`);
    } catch (err: any) {
      spinner.fail(
        chalk.red(
          "Status fetch failed: " + (err.response?.data?.message ?? err.message)
        )
      );
      process.exit(1);
    }
  });

// ── snippet ──────────────────────────────────────────────────────────────────

program
  .command("snippet <siteId>")
  .description("Output the HTML embed snippet for a site (pipeable)")
  .option("--endpoint <url>", "CDN base URL", "https://cdn.specter.sh")
  .action(async (siteId, opts) => {
    const spinner = ora("Fetching site token...").start();
    try {
      const { data } = await getClient().get(`/sites/${siteId}/token`);
      spinner.stop();

      const token: string = data.siteToken ?? data.token;
      const uaA = Math.floor(Math.random() * 900000) + 100000;
      const uaB = Math.floor(Math.random() * 9) + 1;

      const snippet = `<script src="${opts.endpoint}/specter.min.js" data-sid="${token}" data-ua="UA-${uaA}-${uaB}" data-env="production" crossorigin="anonymous" async></script>`;

      // Pipe-safe: raw output to stdout, no decoration
      process.stdout.write(snippet + "\n");
    } catch (err: any) {
      spinner.fail(
        chalk.red(
          "Snippet fetch failed: " + (err.response?.data?.message ?? err.message)
        )
      );
      process.exit(1);
    }
  });

// ── init ─────────────────────────────────────────────────────────────────────

program
  .command("init")
  .description("Interactive setup wizard: login + create your first site")
  .action(async () => {
    printBanner();
    console.log(chalk.cyan.bold("  Welcome to the Specter setup wizard.\n"));

    // Step 1 — auth
    const alreadyLoggedIn = !!store.get("token");
    if (alreadyLoggedIn) {
      console.log(
        chalk.green(`  Already logged in as ${chalk.bold(store.get("email"))}.`)
      );
      const { reauth } = await inquirer.prompt([
        {
          type: "confirm",
          name: "reauth",
          message: "Log in with a different account?",
          default: false,
        },
      ]);
      if (reauth) store.set("token", "");
    }

    if (!store.get("token")) {
      const creds = await inquirer.prompt([
        {
          type: "input",
          name: "email",
          message: chalk.cyan("Email:"),
          validate: (v) => (v.includes("@") ? true : "Enter a valid email"),
        },
        {
          type: "password",
          name: "password",
          message: chalk.cyan("Password:"),
          mask: "*",
        },
      ]);

      const authSpinner = ora("Authenticating...").start();
      try {
        const { data } = await unauthenticatedClient().post("/auth/login", {
          email: creds.email,
          password: creds.password,
        });
        store.set("token", data.token);
        store.set("email", creds.email);
        authSpinner.succeed(chalk.green(`Logged in as ${chalk.bold(creds.email)}`));
      } catch (err: any) {
        authSpinner.fail(
          chalk.red(
            "Authentication failed: " +
              (err.response?.data?.message ?? err.message)
          )
        );
        process.exit(1);
      }
    }

    // Step 2 — create site
    console.log(chalk.cyan.bold("\n  Let's create your first site.\n"));
    const siteInfo = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "Site name:",
        validate: (v) => (v.trim().length > 0 ? true : "Name required"),
      },
      {
        type: "input",
        name: "domain",
        message: "Domain (e.g. myapp.com):",
        validate: (v) => (v.trim().length > 0 ? true : "Domain required"),
      },
      {
        type: "list",
        name: "defaultMode",
        message: "Default kill mode:",
        choices: [
          { name: "freeze  — block all traffic silently", value: "freeze" },
          { name: "overlay — show maintenance overlay", value: "overlay" },
          { name: "redirect — redirect to another URL", value: "redirect" },
          { name: "ghost   — serve stale cached content", value: "ghost" },
          { name: "timebomb — auto-kill at a scheduled time", value: "timebomb" },
        ],
        default: "freeze",
      },
    ]);

    const createSpinner = ora("Creating site...").start();
    try {
      const { data } = await getClient().post("/sites", {
        name: siteInfo.name,
        domain: siteInfo.domain,
        defaultKillMode: siteInfo.defaultMode,
      });
      createSpinner.succeed(
        chalk.green(`Site created: ${chalk.bold(data.site.name)} (${data.site.id})`)
      );

      // Step 3 — show snippet
      const uaA = Math.floor(Math.random() * 900000) + 100000;
      const uaB = Math.floor(Math.random() * 9) + 1;
      const snippet = `<script src="https://cdn.specter.sh/specter.min.js" data-sid="${data.site.siteToken}" data-ua="UA-${uaA}-${uaB}" data-env="production" crossorigin="anonymous" async></script>`;

      console.log(chalk.cyan.bold("\n  Add this snippet before </body>:\n"));
      console.log(chalk.white("  " + snippet));
      console.log(
        chalk.gray("\n  Run `specter snippet <siteId>` to retrieve this again.\n")
      );
    } catch (err: any) {
      createSpinner.fail(
        chalk.red(
          "Site creation failed: " +
            (err.response?.data?.message ?? err.message)
        )
      );
      process.exit(1);
    }
  });

// ─── Default: print banner if no subcommand ───────────────────────────────────

if (process.argv.length <= 2) {
  printBanner();
  program.help();
} else {
  program.parse(process.argv);
}
