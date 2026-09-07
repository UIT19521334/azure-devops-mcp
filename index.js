import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "azure-devops",
  version: "1.0.0",
});

const ORG = "DigiFY2025";
const PROJECT = "DIGI STD FY26";
const API_VERSION = "7.1";
const DEFAULT_AREA_PATH = "DIGI STD FY26\\05. RnD";

// Sprint list from Azure DevOps (format: [name, startDate, endDate])
const SPRINT_LIST = [
  ["Sprint 13 (Jun 22 - Jul 4)", "2026-06-22", "2026-07-04"],
  ["Sprint 14 (Jul 6 - 18)", "2026-07-06", "2026-07-18"],
  ["Sprint 15 (Jul 20 - Aug 1)", "2026-07-20", "2026-08-01"],
  ["Sprint 16 (Aug 3 - 15)", "2026-08-03", "2026-08-15"],
  ["Sprint 17 (Aug 18 - 29)", "2026-08-18", "2026-08-29"],
  ["Sprint 18 (Aug 31 - Sep 12)", "2026-08-31", "2026-09-12"],
  ["Sprint 19 (Sep 14 - 26)", "2026-09-14", "2026-09-26"],
  ["Sprint 20 (Sep 28 - Oct 10)", "2026-09-28", "2026-10-10"],
  ["Sprint 21 (Oct 12 - 24)", "2026-10-12", "2026-10-24"],
  ["Sprint 22 (Oct 26 - Nov 7)", "2026-10-26", "2026-11-07"],
  ["Sprint 23 (Nov 9 - 21)", "2026-11-09", "2026-11-21"],
  ["Sprint 24 (Nov 23 - Dec 5)", "2026-11-23", "2026-12-05"],
  ["Sprint 25 (Dec 7 - 19)", "2026-12-07", "2026-12-19"],
  ["Sprint 26 (Dec 21 - 31)", "2026-12-21", "2026-12-31"],
];

function getCurrentSprint() {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD

  for (const [name, start, end] of SPRINT_LIST) {
    if (todayStr >= start && todayStr <= end) {
      return `DIGI STD FY26\\${name}`;
    }
  }

  // If before all sprints, return the first one
  if (todayStr < SPRINT_LIST[0][1]) {
    return `DIGI STD FY26\\${SPRINT_LIST[0][0]}`;
  }

  // If after all sprints, return the last one
  return `DIGI STD FY26\\${SPRINT_LIST[SPRINT_LIST.length - 1][0]}`;
}

function getBaseUrl() {
  return `https://dev.azure.com/${ORG}/${encodeURIComponent(PROJECT)}/_apis/wit/workitems`;
}

function getAuthHeader() {
  const pat = process.env.AZURE_DEVOPS_PAT;
  if (!pat) throw new Error("AZURE_DEVOPS_PAT environment variable is not set");
  return "Basic " + Buffer.from(`:${pat}`).toString("base64");
}

server.tool(
  "create-pbi",
  "Create a Product Backlog Item on Azure DevOps (DigiFY2025 / DIGI STD FY26)",
  {
    title: z.string().describe("Title of the PBI (required)"),
    description: z.string().describe("Description of the PBI (required)"),
    acceptanceCriteria: z.string().optional().describe("Acceptance Criteria for the PBI"),
    assignedTo: z.string().optional().describe("Email of the assignee (e.g. user@japfa.com)"),
    areaPath: z.string().optional().describe("Area path, e.g. 'DIGI STD FY26\\\\05. RnD'. Defaults to 'DIGI STD FY26\\\\05. RnD' if not provided"),
    iterationPath: z.string().optional().describe("Sprint path, e.g. 'DIGI STD FY26\\\\Sprint 13 (Jun 22 - Jul 4)'. Auto-detected from current date if not provided"),
    startDate: z.string().optional().describe("Start date in YYYY-MM-DD format"),
    targetDate: z.string().optional().describe("Target date in YYYY-MM-DD format"),
    parentId: z.number().optional().describe("Parent work item ID to link under"),
  },
  async ({ title, description, acceptanceCriteria, assignedTo, areaPath, iterationPath, startDate, targetDate, parentId }) => {
    const resolvedAreaPath = areaPath || DEFAULT_AREA_PATH;
    const resolvedIterationPath = iterationPath || getCurrentSprint();

    const body = [
      { op: "add", path: "/fields/System.Title", value: title },
      { op: "add", path: "/fields/System.Description", value: description },
      { op: "add", path: "/fields/System.AreaPath", value: resolvedAreaPath },
      { op: "add", path: "/fields/System.IterationPath", value: resolvedIterationPath },
    ];

    if (acceptanceCriteria) {
      body.push({ op: "add", path: "/fields/Microsoft.VSTS.Common.AcceptanceCriteria", value: acceptanceCriteria });
    }
    if (assignedTo) {
      body.push({ op: "add", path: "/fields/System.AssignedTo", value: assignedTo });
    }
    if (startDate) {
      body.push({ op: "add", path: "/fields/Microsoft.VSTS.Scheduling.StartDate", value: startDate });
    }
    if (targetDate) {
      body.push({ op: "add", path: "/fields/Microsoft.VSTS.Scheduling.TargetDate", value: targetDate });
    }
    if (parentId) {
      body.push({
        op: "add",
        path: "/relations/-",
        value: {
          rel: "System.LinkTypes.Hierarchy-Reverse",
          url: `https://dev.azure.com/${ORG}/_apis/wit/workItems/${parentId}`,
          attributes: { comment: "Parent link" },
        },
      });
    }

    const url = `${getBaseUrl()}/$Product%20Backlog%20Item?api-version=${API_VERSION}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json-patch+json",
        Authorization: getAuthHeader(),
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        content: [{ type: "text", text: `Error ${response.status}: ${JSON.stringify(result, null, 2)}` }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `PBI created successfully!\nID: ${result.id}\nTitle: ${result.fields["System.Title"]}\nArea: ${resolvedAreaPath}\nSprint: ${resolvedIterationPath}\nURL: ${result._links?.html?.href || `https://dev.azure.com/${ORG}/${encodeURIComponent(PROJECT)}/_workitems/edit/${result.id}`}`,
        },
      ],
    };
  }
);

server.tool(
  "read-pbi",
  "Read/get details of a Product Backlog Item from Azure DevOps (DigiFY2025 / DIGI STD FY26)",
  {
    id: z.number().describe("Work item ID to read (required)"),
  },
  async ({ id }) => {
    const url = `${getBaseUrl()}/${id}?$expand=relations&api-version=${API_VERSION}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: getAuthHeader(),
      },
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        content: [{ type: "text", text: `Error ${response.status}: ${JSON.stringify(result, null, 2)}` }],
        isError: true,
      };
    }

    const fields = result.fields;
    const relations = result.relations || [];

    const parentLink = relations.find(r => r.rel === "System.LinkTypes.Hierarchy-Reverse");
    const childLinks = relations.filter(r => r.rel === "System.LinkTypes.Hierarchy-Forward");

    let output = `PBI #${result.id}\n`;
    output += `Title: ${fields["System.Title"]}\n`;
    output += `State: ${fields["System.State"]}\n`;
    output += `Assigned To: ${fields["System.AssignedTo"]?.displayName || "Unassigned"}\n`;
    output += `Area Path: ${fields["System.AreaPath"]}\n`;
    output += `Iteration Path: ${fields["System.IterationPath"]}\n`;
    output += `Priority: ${fields["Microsoft.VSTS.Common.Priority"] || "Not set"}\n`;
    output += `Tags: ${fields["System.Tags"] || "None"}\n`;
    output += `Start Date: ${fields["Microsoft.VSTS.Scheduling.StartDate"] || "Not set"}\n`;
    output += `Target Date: ${fields["Microsoft.VSTS.Scheduling.TargetDate"] || "Not set"}\n`;
    output += `Created Date: ${fields["System.CreatedDate"]}\n`;
    output += `Changed Date: ${fields["System.ChangedDate"]}\n`;
    output += `\n--- Description ---\n${fields["System.Description"] || "(empty)"}\n`;
    output += `\n--- Acceptance Criteria ---\n${fields["Microsoft.VSTS.Common.AcceptanceCriteria"] || "(empty)"}\n`;

    if (parentLink) {
      const parentIdMatch = parentLink.url.match(/\/(\d+)$/);
      output += `\nParent: #${parentIdMatch ? parentIdMatch[1] : "unknown"}`;
    }
    if (childLinks.length > 0) {
      output += `\nChildren: ${childLinks.map(c => { const m = c.url.match(/\/(\d+)$/); return m ? `#${m[1]}` : "unknown"; }).join(", ")}`;
    }

    output += `\n\nURL: ${result._links?.html?.href || `https://dev.azure.com/${ORG}/${encodeURIComponent(PROJECT)}/_workitems/edit/${result.id}`}`;

    return {
      content: [{ type: "text", text: output }],
    };
  }
);

server.tool(
  "update-pbi",
  "Update an existing Product Backlog Item on Azure DevOps (DigiFY2025 / DIGI STD FY26)",
  {
    id: z.number().describe("Work item ID to update (required)"),
    title: z.string().optional().describe("New title"),
    description: z.string().optional().describe("New description"),
    acceptanceCriteria: z.string().optional().describe("New acceptance criteria"),
    assignedTo: z.string().optional().describe("New assignee email (e.g. user@japfa.com)"),
    areaPath: z.string().optional().describe("New area path, e.g. 'DIGI STD FY26\\\\05. RnD'"),
    iterationPath: z.string().optional().describe("New sprint path, e.g. 'DIGI STD FY26\\\\Sprint 13 (Jun 22 - Jul 4)'"),
    state: z.string().optional().describe("New state (e.g. 'New', 'Active', 'Resolved', 'Closed', 'Removed')"),
    priority: z.number().optional().describe("Priority (1=Critical, 2=High, 3=Medium, 4=Low)"),
    startDate: z.string().optional().describe("Start date in YYYY-MM-DD format"),
    targetDate: z.string().optional().describe("Target date in YYYY-MM-DD format"),
    tags: z.string().optional().describe("Tags (semicolon-separated, e.g. 'UI;Backend;Urgent')"),
  },
  async ({ id, title, description, acceptanceCriteria, assignedTo, areaPath, iterationPath, state, priority, startDate, targetDate, tags }) => {
    const body = [];

    if (title) body.push({ op: "replace", path: "/fields/System.Title", value: title });
    if (description) body.push({ op: "replace", path: "/fields/System.Description", value: description });
    if (acceptanceCriteria) body.push({ op: "replace", path: "/fields/Microsoft.VSTS.Common.AcceptanceCriteria", value: acceptanceCriteria });
    if (assignedTo) body.push({ op: "replace", path: "/fields/System.AssignedTo", value: assignedTo });
    if (areaPath) body.push({ op: "replace", path: "/fields/System.AreaPath", value: areaPath });
    if (iterationPath) body.push({ op: "replace", path: "/fields/System.IterationPath", value: iterationPath });
    if (state) body.push({ op: "replace", path: "/fields/System.State", value: state });
    if (priority) body.push({ op: "replace", path: "/fields/Microsoft.VSTS.Common.Priority", value: priority });
    if (startDate) body.push({ op: "replace", path: "/fields/Microsoft.VSTS.Scheduling.StartDate", value: startDate });
    if (targetDate) body.push({ op: "replace", path: "/fields/Microsoft.VSTS.Scheduling.TargetDate", value: targetDate });
    if (tags) body.push({ op: "replace", path: "/fields/System.Tags", value: tags });

    if (body.length === 0) {
      return {
        content: [{ type: "text", text: "No fields provided to update. Please specify at least one field to change." }],
        isError: true,
      };
    }

    const url = `${getBaseUrl()}/${id}?api-version=${API_VERSION}`;

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json-patch+json",
        Authorization: getAuthHeader(),
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        content: [{ type: "text", text: `Error ${response.status}: ${JSON.stringify(result, null, 2)}` }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `PBI updated successfully!\nID: ${result.id}\nTitle: ${result.fields["System.Title"]}\nState: ${result.fields["System.State"]}\nURL: ${result._links?.html?.href || `https://dev.azure.com/${ORG}/${encodeURIComponent(PROJECT)}/_workitems/edit/${result.id}`}`,
        },
      ],
    };
  }
);

// Helper: run a WIQL query and return the matching work item IDs
async function runWiql(query) {
  const url = `https://dev.azure.com/${ORG}/${encodeURIComponent(PROJECT)}/_apis/wit/wiql?api-version=${API_VERSION}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify({ query }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(`Error ${response.status}: ${JSON.stringify(result, null, 2)}`);
  }

  return (result.workItems || []).map((w) => w.id);
}

// Helper: fetch a summary of the given work item IDs (batched, max 200 per call)
async function fetchWorkItemsSummary(ids) {
  if (ids.length === 0) return [];

  const fields = [
    "System.Id",
    "System.Title",
    "System.State",
    "System.WorkItemType",
    "System.AssignedTo",
    "System.IterationPath",
    "Microsoft.VSTS.Common.Priority",
    "System.ChangedDate",
  ];

  const all = [];
  for (let i = 0; i < ids.length; i += 200) {
    const batchIds = ids.slice(i, i + 200);
    const url = `https://dev.azure.com/${ORG}/_apis/wit/workitemsbatch?api-version=${API_VERSION}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: getAuthHeader(),
      },
      body: JSON.stringify({ ids: batchIds, fields }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${JSON.stringify(result, null, 2)}`);
    }

    all.push(...(result.value || []));
  }

  return all;
}

// Helper: format a list of work items into a readable text table
function formatWorkItemList(items) {
  if (items.length === 0) return "No work items found.";

  return items
    .map((item) => {
      const f = item.fields;
      const assignee = f["System.AssignedTo"]?.displayName || "Unassigned";
      const priority = f["Microsoft.VSTS.Common.Priority"] ?? "-";
      const sprint = (f["System.IterationPath"] || "").split("\\").pop();
      return `#${item.id} [${f["System.State"]}] ${f["System.Title"]}\n    Type: ${f["System.WorkItemType"]} | Assignee: ${assignee} | Priority: ${priority} | Sprint: ${sprint}`;
    })
    .join("\n");
}

server.tool(
  "list-my-pbis",
  "List Product Backlog Items assigned to the current user (via PAT) that are not finished yet (state is not Done/Closed/Removed). Useful to see your open/unfinished work.",
  {
    includeAllTypes: z
      .boolean()
      .optional()
      .describe("If true, include all work item types (Bug, Task, etc.), not only Product Backlog Items. Default false."),
    state: z
      .string()
      .optional()
      .describe("Filter by an exact state (e.g. 'New', 'Approved', 'Committed'). If omitted, returns all not-done states."),
  },
  async ({ includeAllTypes, state }) => {
    let query =
      "SELECT [System.Id] FROM WorkItems " +
      "WHERE [System.TeamProject] = @project " +
      "AND [System.AssignedTo] = @Me ";

    if (!includeAllTypes) {
      query += "AND [System.WorkItemType] = 'Product Backlog Item' ";
    }

    if (state) {
      query += `AND [System.State] = '${state.replace(/'/g, "''")}' `;
    } else {
      query +=
        "AND [System.State] NOT IN ('Done', 'Closed', 'Removed') ";
    }

    query += "ORDER BY [System.ChangedDate] DESC";

    try {
      const ids = await runWiql(query);
      const items = await fetchWorkItemsSummary(ids);
      const text = `Found ${items.length} unfinished item(s) assigned to you:\n\n${formatWorkItemList(items)}`;
      return { content: [{ type: "text", text }] };
    } catch (err) {
      return { content: [{ type: "text", text: err.message }], isError: true };
    }
  }
);

server.tool(
  "list-pbis",
  "Search/list Product Backlog Items on Azure DevOps (DigiFY2025 / DIGI STD FY26) using flexible filters or a raw WIQL query. Returns a summary list.",
  {
    wiql: z
      .string()
      .optional()
      .describe(
        "A raw WIQL query (e.g. \"SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'New'\"). If provided, all other filters are ignored."
      ),
    searchText: z
      .string()
      .optional()
      .describe("Text to search for in the title (uses CONTAINS)."),
    state: z
      .string()
      .optional()
      .describe("Filter by exact state (e.g. 'New', 'Approved', 'Committed', 'Done')."),
    notDone: z
      .boolean()
      .optional()
      .describe("If true, only return items whose state is not Done/Closed/Removed."),
    assignedTo: z
      .string()
      .optional()
      .describe("Filter by assignee email, or 'me' for the current user."),
    iterationPath: z
      .string()
      .optional()
      .describe("Filter by sprint/iteration path (uses UNDER, e.g. 'DIGI STD FY26\\\\Sprint 16 (Aug 3 - 15)')."),
    areaPath: z
      .string()
      .optional()
      .describe("Filter by area path (uses UNDER, e.g. 'DIGI STD FY26\\\\05. RnD')."),
    includeAllTypes: z
      .boolean()
      .optional()
      .describe("If true, include all work item types, not only Product Backlog Items. Default false."),
    top: z
      .number()
      .optional()
      .describe("Maximum number of results to return (default 50)."),
  },
  async ({ wiql, searchText, state, notDone, assignedTo, iterationPath, areaPath, includeAllTypes, top }) => {
    let query;

    if (wiql) {
      query = wiql;
    } else {
      const clauses = ["[System.TeamProject] = @project"];

      if (!includeAllTypes) {
        clauses.push("[System.WorkItemType] = 'Product Backlog Item'");
      }
      if (searchText) {
        clauses.push(`[System.Title] CONTAINS '${searchText.replace(/'/g, "''")}'`);
      }
      if (state) {
        clauses.push(`[System.State] = '${state.replace(/'/g, "''")}'`);
      }
      if (notDone) {
        clauses.push("[System.State] NOT IN ('Done', 'Closed', 'Removed')");
      }
      if (assignedTo) {
        if (assignedTo.toLowerCase() === "me") {
          clauses.push("[System.AssignedTo] = @Me");
        } else {
          clauses.push(`[System.AssignedTo] = '${assignedTo.replace(/'/g, "''")}'`);
        }
      }
      if (iterationPath) {
        clauses.push(`[System.IterationPath] UNDER '${iterationPath.replace(/'/g, "''")}'`);
      }
      if (areaPath) {
        clauses.push(`[System.AreaPath] UNDER '${areaPath.replace(/'/g, "''")}'`);
      }

      query =
        `SELECT [System.Id] FROM WorkItems WHERE ${clauses.join(" AND ")} ORDER BY [System.ChangedDate] DESC`;
    }

    try {
      let ids = await runWiql(query);
      const limit = top || 50;
      if (ids.length > limit) ids = ids.slice(0, limit);
      const items = await fetchWorkItemsSummary(ids);
      const text = `Found ${items.length} item(s):\n\n${formatWorkItemList(items)}`;
      return { content: [{ type: "text", text }] };
    } catch (err) {
      return { content: [{ type: "text", text: err.message }], isError: true };
    }
  }
);

// Comments use a dedicated API with a preview api-version
const COMMENTS_API_VERSION = "7.1-preview.4";

server.tool(
  "add-comment",
  "Add a comment to a work item (PBI, Task, Bug, etc.) on Azure DevOps (DigiFY2025 / DIGI STD FY26)",
  {
    id: z.number().describe("Work item ID to comment on (required)"),
    text: z.string().describe("The comment text. Supports HTML (e.g. <b>bold</b>, <a href>links</a>) (required)"),
  },
  async ({ id, text }) => {
    const url = `https://dev.azure.com/${ORG}/${encodeURIComponent(PROJECT)}/_apis/wit/workItems/${id}/comments?api-version=${COMMENTS_API_VERSION}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: getAuthHeader(),
      },
      body: JSON.stringify({ text }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        content: [{ type: "text", text: `Error ${response.status}: ${JSON.stringify(result, null, 2)}` }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Comment added to work item #${id}!\nComment ID: ${result.id}\nBy: ${result.createdBy?.displayName || "unknown"}\nDate: ${result.createdDate}\nText: ${result.text}\nURL: https://dev.azure.com/${ORG}/${encodeURIComponent(PROJECT)}/_workitems/edit/${id}`,
        },
      ],
    };
  }
);

server.tool(
  "list-comments",
  "List all comments on a work item (PBI, Task, Bug, etc.) on Azure DevOps (DigiFY2025 / DIGI STD FY26)",
  {
    id: z.number().describe("Work item ID to read comments from (required)"),
  },
  async ({ id }) => {
    const url = `https://dev.azure.com/${ORG}/${encodeURIComponent(PROJECT)}/_apis/wit/workItems/${id}/comments?api-version=${COMMENTS_API_VERSION}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: getAuthHeader(),
      },
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        content: [{ type: "text", text: `Error ${response.status}: ${JSON.stringify(result, null, 2)}` }],
        isError: true,
      };
    }

    const comments = result.comments || [];

    if (comments.length === 0) {
      return { content: [{ type: "text", text: `Work item #${id} has no comments.` }] };
    }

    const body = comments
      .map((c) => {
        const author = c.createdBy?.displayName || "unknown";
        return `[#${c.id}] ${author} @ ${c.createdDate}\n${c.text}`;
      })
      .join("\n\n---\n\n");

    return {
      content: [
        {
          type: "text",
          text: `Work item #${id} has ${comments.length} comment(s):\n\n${body}`,
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
