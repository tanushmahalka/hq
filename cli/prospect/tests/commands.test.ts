import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { runApolloCommand } from "../src/commands/apollo.ts";
import { runFindCommand } from "../src/commands/find.ts";
import { runEnrichCommand } from "../src/commands/enrich.ts";
import { CliError } from "../src/core/errors.ts";
import { executeWithFallback } from "../src/providers/index.ts";

test("find person uses Apollo people match for email identity lookups", async () => {
  process.env.APOLLO_API_KEY = "test-apollo-key";
  let requestUrl = "";

  const output = await captureStdout(async () => {
    await runFindCommand(["person", "--email", "jane@example.com", "--json", "--debug"], {
      fetchImpl: async (input, init) => {
        requestUrl = String(input);
        assert.match(String(input), /\/api\/v1\/people\/match(\?|$)/);
        assert.equal(init?.body, undefined);
        return jsonResponse({
          person: {
            id: "p_1",
            name: "Jane Doe",
            first_name: "Jane",
            last_name: "Doe",
            title: "Head of Growth",
            email: "jane@example.com",
            linkedin_url: "https://linkedin.com/in/jane",
            phone_number: "+1 555 111 2222",
            organization: {
              id: "o_1",
              name: "Acme",
              primary_domain: "acme.com",
              website_url: "https://acme.com",
            },
          },
        });
      },
    });
  });

  const parsed = parseCapturedJson(output) as {
    ok: boolean;
    provider: string;
    explain: string[];
    result: { fullName: string; company: { domain: string } };
  };
  assert.equal(parsed.ok, true);
  assert.equal(parsed.provider, "apollo");
  assert.equal(parsed.result.fullName, "Jane Doe");
  assert.equal(parsed.result.company.domain, "acme.com");
  assert.ok(parsed.explain.some((entry) => /People Match/i.test(entry)));
  assert.equal(new URL(requestUrl).searchParams.get("email"), "jane@example.com");
});

test("apollo find person supports direct People API Search filters via --query", async () => {
  process.env.APOLLO_API_KEY = "test-apollo-key";
  let requestUrl = "";

  const output = await captureStdout(async () => {
    await runApolloCommand(
      [
        "find",
        "person",
        "--query",
        "person_titles[]=marketing manager",
        "--query",
        "person_seniorities[]=director",
        "--query",
        "include_similar_titles=false",
        "--json",
      ],
      {
        fetchImpl: async (input, init) => {
          assert.match(String(input), /\/api\/v1\/mixed_people\/api_search(\?|$)/);
          requestUrl = String(input);
          assert.equal(init?.body, undefined);
          return jsonResponse({
            people: [
              {
                id: "p_2",
                name: "Jordan Smith",
                title: "Marketing Director",
              },
            ],
          });
        },
      },
    );
  });

  const parsed = parseCapturedJson(output) as { result: { fullName: string; jobTitle: string } };
  const url = new URL(requestUrl);

  assert.equal(parsed.result.fullName, "Jordan Smith");
  assert.equal(parsed.result.jobTitle, "Marketing Director");
  assert.equal(url.searchParams.get("person_titles[]"), "marketing manager");
  assert.equal(url.searchParams.get("person_seniorities[]"), "director");
  assert.equal(url.searchParams.get("include_similar_titles"), "false");
});

test("apollo list people preserves repeated query keys for Apollo array filters", async () => {
  process.env.APOLLO_API_KEY = "test-apollo-key";

  await captureStdout(async () => {
    await runApolloCommand(
      [
        "list",
        "people",
        "--query",
        "q_organization_domains_list[]=foo.com",
        "--query",
        "q_organization_domains_list[]=bar.com",
        "--query",
        "person_titles[]=Founder",
        "--query",
        "person_titles[]=Owner",
        "--json",
      ],
      {
        fetchImpl: async (input) => {
          const url = new URL(String(input));
          assert.deepEqual(url.searchParams.getAll("q_organization_domains_list[]"), ["foo.com", "bar.com"]);
          assert.deepEqual(url.searchParams.getAll("person_titles[]"), ["Founder", "Owner"]);
          return jsonResponse({ total_entries: 0, people: [] });
        },
      },
    );
  });
});

test("apollo find person exposes available filters", async () => {
  const output = await captureStdout(async () => {
    await runApolloCommand(["find", "person", "--filters", "--json"]);
  });

  const parsed = parseCapturedJson(output) as {
    ok: boolean;
    endpoint: string;
    path: string;
    filters: Array<{ name: string; type: string }>;
  };

  assert.equal(parsed.ok, true);
  assert.equal(parsed.endpoint, "people-api-search");
  assert.equal(parsed.path, "/api/v1/mixed_people/api_search");
  assert.ok(parsed.filters.some((filter) => filter.name === "person_titles[]" && filter.type === "string[]"));
  assert.ok(parsed.filters.some((filter) => filter.name === "person_seniorities[]" && filter.type === "string[]"));
  assert.ok(parsed.filters.some((filter) => filter.name === "revenue_range[min]" && filter.type === "integer"));
});

test("apollo list people returns multiple normalized results and pagination metadata", async () => {
  process.env.APOLLO_API_KEY = "test-apollo-key";

  const output = await captureStdout(async () => {
    await runApolloCommand(
      [
        "list",
        "people",
        "--query",
        "person_titles[]=marketing director",
        "--query",
        "person_locations[]=bangalore, india",
        "--query",
        "page=2",
        "--query",
        "per_page=3",
        "--json",
      ],
      {
        fetchImpl: async (input) => {
          const url = new URL(String(input));
          assert.equal(url.searchParams.get("page"), "2");
          assert.equal(url.searchParams.get("per_page"), "3");
          return jsonResponse({
            total_entries: 381,
            people: [
              {
                id: "p_1",
                name: "Sahana",
                first_name: "Sahana",
                title: "Marketing Director",
                organization: { name: "Jayalakshmi Group" },
              },
              {
                id: "p_2",
                name: "Karthik",
                first_name: "Karthik",
                title: "Marketing Director",
                organization: { name: "CrowdStrike" },
              },
            ],
          });
        },
      },
    );
  });

  const parsed = parseCapturedJson(output) as {
    ok: boolean;
    command: string;
    entity: string;
    totalEntries: number;
    page: number;
    perPage: number;
    results: Array<{ fullName: string; jobTitle: string; company?: { name?: string } }>;
  };

  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, "list");
  assert.equal(parsed.entity, "people");
  assert.equal(parsed.totalEntries, 381);
  assert.equal(parsed.page, 2);
  assert.equal(parsed.perPage, 3);
  assert.equal(parsed.results.length, 2);
  assert.equal(parsed.results[0]?.fullName, "Sahana");
  assert.equal(parsed.results[1]?.company?.name, "CrowdStrike");
});

test("find account returns normalized Apollo organization result", async () => {
  process.env.APOLLO_API_KEY = "test-apollo-key";

  const output = await captureStdout(async () => {
    await runFindCommand(["account", "--domain", "acme.com", "--json"], {
      fetchImpl: async (input) => {
        assert.match(String(input), /\/api\/v1\/organizations\/search$/);
        return jsonResponse({
          organizations: [
            {
              id: "org_1",
              name: "Acme",
              primary_domain: "acme.com",
              website_url: "https://acme.com",
              industry: "Software",
              estimated_num_employees: 120,
              organization_phone: "+1 555 333 4444",
            },
          ],
        });
      },
    });
  });

  const parsed = parseCapturedJson(output) as { result: { domain: string; industry: string; employeeCount: number } };
  assert.equal(parsed.result.domain, "acme.com");
  assert.equal(parsed.result.industry, "Software");
  assert.equal(parsed.result.employeeCount, 120);
});

test("find number returns immediate phone data and can report async pending state", async () => {
  process.env.APOLLO_API_KEY = "test-apollo-key";

  const immediate = await captureStdout(async () => {
    await runFindCommand(["number", "--email", "jane@example.com", "--json"], {
      fetchImpl: async () =>
        jsonResponse({
          id: "p_1",
          name: "Jane Doe",
          email: "jane@example.com",
          phone_number: "+1 555 111 2222",
        }),
    });
  });

  const immediateParsed = parseCapturedJson(immediate) as { result: { phones: Array<{ value: string; status: string }> } };
  assert.equal(immediateParsed.result.phones[0]?.value, "+1 555 111 2222");
  assert.equal(immediateParsed.result.phones[0]?.status, "available");

  const pending = await captureStdout(async () => {
    await runFindCommand(["number", "--email", "jane@example.com", "--json", "--debug"], {
      fetchImpl: async () =>
        jsonResponse({
          id: "p_1",
          name: "Jane Doe",
          email: "jane@example.com",
          waterfall_enrichment_status: "pending",
        }),
    });
  });

  const pendingParsed = parseCapturedJson(pending) as {
    warnings: string[];
    result: { phones: Array<{ status: string }> };
    explain: string[];
  };
  assert.equal(pendingParsed.result.phones[0]?.status, "pending_async_enrichment");
  assert.match(pendingParsed.warnings[0] ?? "", /async webhook delivery/i);
  assert.ok(pendingParsed.explain.length > 0);
});

test("json output always includes provider raw payload and explain metadata", async () => {
  process.env.APOLLO_API_KEY = "test-apollo-key";

  const output = await captureStdout(async () => {
    await runEnrichCommand(["person", "--email", "jane@example.com", "--json", "--debug"], {
      fetchImpl: async () =>
        jsonResponse({
          id: "p_1",
          name: "Jane Doe",
          email: "jane@example.com",
          title: "Head of Growth",
      }),
    });
  });

  const parsed = parseCapturedJson(output) as { id: string; name: string; email: string; title: string };
  assert.equal(parsed.id, "p_1");
  assert.equal(parsed.name, "Jane Doe");
  assert.equal(parsed.email, "jane@example.com");
  assert.equal(parsed.title, "Head of Growth");
});

test("apollo bulk people enrich posts details payload and returns normalized results", async () => {
  process.env.APOLLO_API_KEY = "test-apollo-key";
  let url = "";
  let method = "";
  let body = "";

  const output = await captureStdout(async () => {
    await runApolloCommand(
      [
        "enrich",
        "people",
        "--data",
        '{"details":[{"email":"jane@example.com"},{"name":"John Doe","domain":"acme.com"}]}',
        "--json",
        "--debug",
      ],
      {
        fetchImpl: async (input, init) => {
          url = String(input);
          method = String(init?.method);
          body = String(init?.body);
          return jsonResponse({
            matches: [
              {
                person: {
                  id: "p_1",
                  name: "Jane Doe",
                  email: "jane@example.com",
                  title: "Head of Growth",
                  organization: {
                    name: "Acme",
                    primary_domain: "acme.com",
                  },
                },
              },
              {
                person: {
                  id: "p_2",
                  name: "John Doe",
                  title: "Sales Director",
                  organization: {
                    name: "Acme",
                    primary_domain: "acme.com",
                  },
                },
              },
            ],
          });
        },
      },
    );
  });

  const parsed = parseCapturedJson(output) as {
    matches: Array<{ person: { name: string; organization?: { primary_domain?: string } } }>;
  };

  assert.match(url, /\/api\/v1\/people\/bulk_match$/);
  assert.equal(method, "POST");
  assert.match(body, /jane@example\.com/);
  assert.match(body, /"details"/);
  assert.equal(parsed.matches.length, 2);
  assert.equal(parsed.matches[0]?.person.name, "Jane Doe");
  assert.equal(parsed.matches[1]?.person.organization?.primary_domain, "acme.com");
});

test("apollo bulk people enrich validates details array length", async () => {
  process.env.APOLLO_API_KEY = "test-apollo-key";

  await assert.rejects(
    () => runApolloCommand(["enrich", "people", "--data", "{}"], { fetchImpl: async () => jsonResponse({}) }),
    /non-empty `details` array/i,
  );

  const details = Array.from({ length: 11 }, (_, index) => ({ email: `person${index}@example.com` }));

  await assert.rejects(
    () =>
      runApolloCommand(["enrich", "people", "--data", JSON.stringify({ details })], {
        fetchImpl: async () => jsonResponse({}),
      }),
    /at most 10 people/i,
  );
});

test("apollo enrich person passes Apollo enrichment flags as query params", async () => {
  process.env.APOLLO_API_KEY = "test-apollo-key";
  let requestUrl = "";

  await captureStdout(async () => {
    await runApolloCommand(
      [
        "enrich",
        "person",
        "--id",
        "587cf802f65125cad923a266",
        "--reveal-personal-emails",
        "--json",
      ],
      {
        fetchImpl: async (input, init) => {
          requestUrl = String(input);
          assert.equal(init?.body, undefined);
          return jsonResponse({ id: "p_1", name: "Jane Doe" });
        },
      },
    );
  });

  const url = new URL(requestUrl);
  assert.equal(url.searchParams.get("id"), "587cf802f65125cad923a266");
  assert.equal(url.searchParams.get("reveal_personal_emails"), "true");
});

test("apollo enrich person requires webhook url when revealing phone numbers", async () => {
  process.env.APOLLO_API_KEY = "test-apollo-key";

  await assert.rejects(
    () =>
      runApolloCommand(["enrich", "person", "--email", "jane@example.com", "--reveal-phone-number"], {
        fetchImpl: async () => jsonResponse({}),
      }),
    /requires --webhook-url/i,
  );
});

test("apollo enrich person --wait starts a temporary webhook tunnel and returns the callback payload", async () => {
  process.env.APOLLO_API_KEY = "test-apollo-key";
  let requestUrl = "";
  let stderrOutput = "";

  const output = await captureStdout(async () => {
    stderrOutput = await captureStderr(async () => {
      await runApolloCommand(
        [
          "enrich",
          "person",
          "--email",
          "jane@example.com",
          "--reveal-phone-number",
          "--wait",
          "--wait-timeout-ms",
          "5000",
          "--json",
          "--debug",
        ],
        {
          spawnImpl: createMockCloudflaredSpawn(),
          fetchImpl: async (input) => {
            requestUrl = String(input);
            const url = new URL(requestUrl);
            const webhookUrl = url.searchParams.get("webhook_url");
            assert.ok(webhookUrl);

            queueMicrotask(async () => {
              await fetch(webhookUrl!, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  person: {
                    id: "p_1",
                    phone_number: "+1 555 111 2222",
                  },
                }),
              });
            });

            return jsonResponse({
              id: "p_1",
              name: "Jane Doe",
              waterfall_enrichment_status: "pending",
            });
          },
        },
      );
    });
  });

  const parsed = parseCapturedJson(output) as {
    sync: { id: string; name: string; waterfall_enrichment_status: string };
    webhook: { method: string; path: string; headers: Record<string, string | string[]>; body: string };
  };
  const url = new URL(requestUrl);

  assert.equal(url.searchParams.get("reveal_phone_number"), "true");
  assert.match(url.searchParams.get("webhook_url") ?? "", /\/apollo-webhook\//);
  assert.equal(parsed.sync.id, "p_1");
  assert.equal(parsed.sync.waterfall_enrichment_status, "pending");
  assert.equal(parsed.webhook.method, "POST");
  assert.match(parsed.webhook.path, /\/apollo-webhook\//);
  assert.equal(parsed.webhook.headers["content-type"], "application/json");
  assert.match(parsed.webhook.body, /"phone_number":"\+1 555 111 2222"/);
  assert.match(stderrOutput, /Initial Apollo response:/);
  assert.match(stderrOutput, /"name": "Jane Doe"/);
  assert.match(stderrOutput, /\[apollo wait\] inbound request POST/);
  assert.match(stderrOutput, /\[apollo wait\] accepted request body/);
});

test("apollo enrich person rejects --wait when no async webhook-producing flag is enabled", async () => {
  process.env.APOLLO_API_KEY = "test-apollo-key";

  await assert.rejects(
    () =>
      runApolloCommand(["enrich", "person", "--email", "jane@example.com", "--wait"], {
        fetchImpl: async () => jsonResponse({}),
      }),
    /Use --wait only with Apollo flows that send async webhooks, such as --reveal-phone-number/i,
  );
});

test("apollo bulk people enrich supports repeated --detail flags and top-level query options", async () => {
  process.env.APOLLO_API_KEY = "test-apollo-key";
  let requestUrl = "";
  let body = "";

  const output = await captureStdout(async () => {
    await runApolloCommand(
      [
        "enrich",
        "people",
        "--detail",
        "id=64a7ff0cc4dfae00013df1a5",
        "--detail",
        "name=John Doe;domain=acme.com",
        "--reveal-phone-number",
        "--webhook-url",
        "https://example.com/apollo-webhook",
        "--json",
      ],
      {
        fetchImpl: async (input, init) => {
          requestUrl = String(input);
          body = String(init?.body);
          return jsonResponse({
            matches: [
              { person: { id: "p_1", name: "Jane Doe" } },
              { person: { id: "p_2", name: "John Doe", organization: { name: "Acme", primary_domain: "acme.com" } } },
            ],
          });
        },
      },
    );
  });

  const parsed = parseCapturedJson(output) as { matches: Array<{ person: { id: string; name: string } }> };
  const url = new URL(requestUrl);
  const posted = JSON.parse(body) as { details: Array<Record<string, string>> };

  assert.equal(url.searchParams.get("reveal_phone_number"), "true");
  assert.equal(url.searchParams.get("webhook_url"), "https://example.com/apollo-webhook");
  assert.equal(parsed.matches.length, 2);
  assert.equal(posted.details[0]?.id, "64a7ff0cc4dfae00013df1a5");
  assert.equal(posted.details[1]?.name, "John Doe");
  assert.equal(posted.details[1]?.domain, "acme.com");
});

test("apollo raw api passthrough parses payloads", async () => {
  process.env.APOLLO_API_KEY = "test-apollo-key";
  let url = "";
  let method = "";
  let body = "";

  await captureStdout(async () => {
    await runApolloCommand(["api", "--method", "POST", "--path", "/api/v1/test", "--field", "email=jane@example.com", "--json"], {
      fetchImpl: async (input, init) => {
        url = String(input);
        method = String(init?.method);
        body = String(init?.body);
        return jsonResponse({ ok: true });
      },
    });
  });

  assert.match(url, /\/api\/v1\/test$/);
  assert.equal(method, "POST");
  assert.match(body, /jane@example.com/);
});

test("apollo usage calls the usage stats endpoint", async () => {
  process.env.APOLLO_API_KEY = "test-apollo-key";
  let url = "";
  let method = "";

  const output = await captureStdout(async () => {
    await runApolloCommand(["usage", "--json"], {
      fetchImpl: async (input, init) => {
        url = String(input);
        method = String(init?.method);
        return jsonResponse({
          plan_name: "Growth",
          rate_limits: {
            "/api/v1/mixed_people/search": {
              minute: 100,
            },
          },
        });
      },
    });
  });

  const parsed = parseCapturedJson(output) as {
    ok: boolean;
    provider: string;
    command: string;
    result: { plan_name: string };
  };

  assert.match(url, /\/api\/v1\/usage_stats\/api_usage_stats$/);
  assert.equal(method, "POST");
  assert.equal(parsed.ok, true);
  assert.equal(parsed.provider, "apollo");
  assert.equal(parsed.command, "usage");
  assert.equal(parsed.result.plan_name, "Growth");
});

test("apollo usage supports match filters", async () => {
  process.env.APOLLO_API_KEY = "test-apollo-key";

  const output = await captureStdout(async () => {
    await runApolloCommand(["usage", "--json", "--match", "mixed_people"], {
      fetchImpl: async () =>
        jsonResponse({
          "[\"api/v1/mixed_people\", \"search\"]": {
            minute: { limit: 50, left_over: 50 },
          },
          "[\"api/v1/conversations\", \"export\"]": {
            minute: { limit: 1, left_over: 1 },
          },
          "[\"api/v1/organizations\", \"search\"]": {
            minute: { limit: 50, left_over: 50 },
          },
        }),
    });
  });

  const parsed = parseCapturedJson(output) as {
    result: {
      totalEndpoints: number;
      returnedEndpoints: number;
      match: string;
      endpoints: Record<string, unknown>;
    };
  };

  assert.equal(parsed.result.totalEndpoints, 3);
  assert.equal(parsed.result.returnedEndpoints, 1);
  assert.equal(parsed.result.match, "mixed_people");
  assert.deepEqual(Object.keys(parsed.result.endpoints), ['["api/v1/mixed_people", "search"]']);
});

test("provider fallback prefers pinned provider and returns first usable result", async () => {
  const result = await executeWithFallback(
    {
      apollo: {
        id: "apollo",
        findPerson: async () => ({ ok: true, provider: "apollo", result: { fullName: "Jane Doe" }, warnings: [], explain: [] }),
        findAccount: async () => ({ ok: false, provider: "apollo", result: null, warnings: [], explain: [] }),
        findNumber: async () => ({ ok: false, provider: "apollo", result: null, warnings: [], explain: [] }),
        enrichPerson: async () => ({ ok: false, provider: "apollo", result: null, warnings: [], explain: [] }),
        enrichAccount: async () => ({ ok: false, provider: "apollo", result: null, warnings: [], explain: [] }),
        rawRequest: async () => null,
      },
    },
    ["apollo"],
    "apollo",
    (provider) => provider.findPerson({ email: "jane@example.com" }),
  );

  assert.equal(result.provider, "apollo");
  assert.equal((result.result as { fullName: string }).fullName, "Jane Doe");
});

test("missing auth and Apollo API errors surface clearly", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "prospect-cli-test-"));
  process.env.PROSPECT_CONFIG_PATH = path.join(tempDir, "config.json");
  delete process.env.APOLLO_API_KEY;

  await assert.rejects(
    () =>
      runFindCommand(["person", "--email", "jane@example.com", "--json"], {
        fetchImpl: async () => jsonResponse({}),
      }),
    /Missing Apollo API key/,
  );

  process.env.APOLLO_API_KEY = "test-apollo-key";

  await assert.rejects(
    () =>
      runFindCommand(["person", "--email", "jane@example.com", "--json"], {
        fetchImpl: async () => jsonResponse({ message: "Rate limit exceeded" }, 429),
      }),
    (error: unknown) => error instanceof CliError && /Rate limit exceeded/.test(error.message) && error.status === 429,
  );

  delete process.env.PROSPECT_CONFIG_PATH;
});

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function createMockCloudflaredSpawn() {
  return (_command?: string, args?: string[]) => {
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
    const localUrl = args?.[2] ?? "http://127.0.0.1:0";
    const child = {
      stdout,
      stderr,
      on(event: string, listener: (...args: unknown[]) => void) {
        const current = listeners.get(event) ?? [];
        current.push(listener);
        listeners.set(event, current);
        return child;
      },
      off(event: string, listener: (...args: unknown[]) => void) {
        const current = listeners.get(event) ?? [];
        listeners.set(
          event,
          current.filter((entry) => entry !== listener),
        );
        return child;
      },
      once(event: string, listener: (...args: unknown[]) => void) {
        const wrapped = (...eventArgs: unknown[]) => {
          child.off(event, wrapped);
          listener(...eventArgs);
        };
        child.on(event, wrapped);
        return child;
      },
      kill() {
        queueMicrotask(() => {
          for (const listener of listeners.get("exit") ?? []) {
            listener(0);
          }
        });
        return true;
      },
    };

    queueMicrotask(() => {
      stderr.write(`{"message":"${localUrl}"}\n`);
    });

    return child;
  };
}

async function captureStdout(run: () => Promise<void>): Promise<string> {
  let output = "";
  const originalWrite = process.stdout.write.bind(process.stdout);

  process.stdout.write = ((chunk: string | Uint8Array, encoding?: BufferEncoding | ((error?: Error | null) => void), callback?: (error?: Error | null) => void) => {
    output += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");

    const done = typeof encoding === "function" ? encoding : callback;
    done?.(null);
    return true;
  }) as typeof process.stdout.write;

  try {
    await run();
    return output;
  } finally {
    process.stdout.write = originalWrite;
  }
}

async function captureStderr(run: () => Promise<void>): Promise<string> {
  let output = "";
  const originalWrite = process.stderr.write.bind(process.stderr);

  process.stderr.write = ((chunk: string | Uint8Array, encoding?: BufferEncoding | ((error?: Error | null) => void), callback?: (error?: Error | null) => void) => {
    output += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");

    const done = typeof encoding === "function" ? encoding : callback;
    done?.(null);
    return true;
  }) as typeof process.stderr.write;

  try {
    await run();
    return output;
  } finally {
    process.stderr.write = originalWrite;
  }
}

function parseCapturedJson(output: string): unknown {
  for (let start = output.indexOf("{"); start !== -1; start = output.indexOf("{", start + 1)) {
    const parsed = tryParseJsonObjectAt(output, start);
    if (parsed !== undefined) {
      return parsed;
    }
  }

  throw new Error(`No complete JSON object found in output: ${output}`);
}

function tryParseJsonObjectAt(output: string, start: number): unknown {
  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = start; index < output.length; index += 1) {
    const char = output[index];

    if (escaping) {
      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = true;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char !== "}") {
      continue;
    }

    depth -= 1;
    if (depth !== 0) {
      continue;
    }

    const slice = output.slice(start, index + 1);
    try {
      return JSON.parse(slice);
    } catch {
      return undefined;
    }
  }

  return undefined;
}
