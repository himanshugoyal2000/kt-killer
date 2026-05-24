// Team Directory MCP Server
//
// This is a SEPARATE MCP server that simulates an external data source.
// In a real company, this would connect to an HRIS (Workday, BambooHR, etc.).
// For our demo, it uses hardcoded NovaMart employee data.
//
// The point: KT-Killer doesn't own this data or this code. It discovers
// these tools at runtime via MCP and can use them alongside its own tools.
// This is the power of MCP — any team can build an MCP server for their system,
// and KT-Killer can plug into all of them.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Simulated employee database
interface Employee {
  id: string;
  name: string;
  email: string;
  title: string;
  department: string;
  manager: string | null;
  location: string;
  startDate: string;
  skills: string[];
  slackHandle: string;
}

const EMPLOYEES: Employee[] = [
  {
    id: "emp-001",
    name: "Priya Sharma",
    email: "priya.sharma@novamart.com",
    title: "VP of Engineering",
    department: "Engineering",
    manager: null,
    location: "Bangalore",
    startDate: "2019-03-15",
    skills: ["system design", "distributed systems", "team leadership"],
    slackHandle: "@priya.sharma",
  },
  {
    id: "emp-002",
    name: "Alex Chen",
    email: "alex.chen@novamart.com",
    title: "Staff Engineer",
    department: "Engineering",
    manager: "Priya Sharma",
    location: "Remote — San Francisco",
    startDate: "2020-07-01",
    skills: ["kubernetes", "golang", "observability", "payment systems"],
    slackHandle: "@alex.chen",
  },
  {
    id: "emp-003",
    name: "Maria Rodriguez",
    email: "maria.r@novamart.com",
    title: "Senior Backend Engineer",
    department: "Engineering",
    manager: "Priya Sharma",
    location: "Bangalore",
    startDate: "2021-01-10",
    skills: ["java", "spring boot", "kafka", "inventory systems"],
    slackHandle: "@maria.r",
  },
  {
    id: "emp-004",
    name: "James Wilson",
    email: "james.w@novamart.com",
    title: "DevOps Lead",
    department: "Engineering",
    manager: "Priya Sharma",
    location: "Remote — Austin",
    startDate: "2020-11-20",
    skills: ["terraform", "aws", "ci/cd", "kubernetes", "monitoring"],
    slackHandle: "@james.w",
  },
  {
    id: "emp-005",
    name: "Aisha Patel",
    email: "aisha.p@novamart.com",
    title: "Head of Product",
    department: "Product",
    manager: null,
    location: "Bangalore",
    startDate: "2019-08-01",
    skills: ["product strategy", "user research", "roadmapping"],
    slackHandle: "@aisha.p",
  },
  {
    id: "emp-006",
    name: "Tom Baker",
    email: "tom.b@novamart.com",
    title: "HR Director",
    department: "HR",
    manager: null,
    location: "Bangalore",
    startDate: "2018-06-01",
    skills: ["talent acquisition", "employee relations", "compliance"],
    slackHandle: "@tom.b",
  },
  {
    id: "emp-007",
    name: "Sarah Kim",
    email: "sarah.k@novamart.com",
    title: "Frontend Lead",
    department: "Engineering",
    manager: "Priya Sharma",
    location: "Remote — Seoul",
    startDate: "2021-04-15",
    skills: ["react", "typescript", "next.js", "design systems"],
    slackHandle: "@sarah.k",
  },
  {
    id: "emp-008",
    name: "Raj Mehta",
    email: "raj.m@novamart.com",
    title: "Data Engineer",
    department: "Engineering",
    manager: "Alex Chen",
    location: "Bangalore",
    startDate: "2022-02-01",
    skills: ["spark", "airflow", "bigquery", "python", "data pipelines"],
    slackHandle: "@raj.m",
  },
];

// --- MCP Server ---

const server = new McpServer({
  name: "team-directory",
  version: "1.0.0",
});

// Tool 1: Look up an employee by name
server.tool(
  "lookupEmployee",
  "Look up an employee in the company directory by name. Returns their title, department, contact info, and skills.",
  {
    name: z.string().describe("Employee name (full or partial, case-insensitive)"),
  },
  async ({ name }) => {
    const matches = EMPLOYEES.filter((e) =>
      e.name.toLowerCase().includes(name.toLowerCase())
    );

    if (matches.length === 0) {
      return { content: [{ type: "text" as const, text: `No employees found matching "${name}".` }] };
    }

    const formatted = matches
      .map(
        (e) =>
          `**${e.name}** (${e.title})\n` +
          `  Department: ${e.department}\n` +
          `  Email: ${e.email}\n` +
          `  Slack: ${e.slackHandle}\n` +
          `  Location: ${e.location}\n` +
          `  Manager: ${e.manager ?? "None (executive)"}\n` +
          `  Started: ${e.startDate}\n` +
          `  Skills: ${e.skills.join(", ")}`
      )
      .join("\n\n");

    return { content: [{ type: "text" as const, text: formatted }] };
  }
);

// Tool 2: Find employees by skill or department
server.tool(
  "findTeamMembers",
  "Find employees by department, skill, or location. Useful for questions like 'Who works on Kafka?' or 'Who is in the Engineering department?'",
  {
    department: z.string().optional().describe("Department to filter by"),
    skill: z.string().optional().describe("Skill to search for"),
    location: z.string().optional().describe("Location to filter by"),
  },
  async ({ department, skill, location }) => {
    let results = [...EMPLOYEES];

    if (department) {
      results = results.filter((e) =>
        e.department.toLowerCase().includes(department.toLowerCase())
      );
    }
    if (skill) {
      results = results.filter((e) =>
        e.skills.some((s) => s.toLowerCase().includes(skill.toLowerCase()))
      );
    }
    if (location) {
      results = results.filter((e) =>
        e.location.toLowerCase().includes(location.toLowerCase())
      );
    }

    if (results.length === 0) {
      return { content: [{ type: "text" as const, text: "No matching employees found." }] };
    }

    const formatted = results
      .map((e) => `- **${e.name}** — ${e.title} (${e.department}) — ${e.location}`)
      .join("\n");

    return {
      content: [{ type: "text" as const, text: `Found ${results.length} employees:\n\n${formatted}` }],
    };
  }
);

// Tool 3: Get the org chart (reporting structure)
server.tool(
  "getOrgChart",
  "Get the organizational chart showing who reports to whom.",
  {},
  async () => {
    const executives = EMPLOYEES.filter((e) => e.manager === null);
    let chart = "# NovaMart Org Chart\n\n";

    for (const exec of executives) {
      chart += `## ${exec.name} — ${exec.title}\n`;
      const reports = EMPLOYEES.filter((e) => e.manager === exec.name);
      if (reports.length > 0) {
        for (const r of reports) {
          chart += `  └─ ${r.name} — ${r.title}\n`;
          const subReports = EMPLOYEES.filter((e) => e.manager === r.name);
          for (const sr of subReports) {
            chart += `      └─ ${sr.name} — ${sr.title}\n`;
          }
        }
      }
      chart += "\n";
    }

    return { content: [{ type: "text" as const, text: chart }] };
  }
);

// --- Start ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Team Directory MCP Server failed:", error);
  process.exit(1);
});
