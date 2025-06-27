import { octokit } from "../../octokit";
import * as core from "@actions/core";
import { getCursorUsageData } from "../../requests";
import { Collection } from "../types";

export const integrateCursorMetrics = async (
  data: Record<string, Record<string, Collection>>,
  repos: { owner: string; repo: string }[]
) => {
  // skip if feature not enabled
  const includeCursor = core.getInput("INCLUDE_CURSOR_ANALYTICS");
  if (includeCursor !== "true") return;

  const cursorRecords = await getCursorUsageData();
  if (!cursorRecords || cursorRecords.length === 0) return;

  // aggregate per email *local part* (before "@") so different domains for the same user are combined
  const emailAggregates: Record<
    string,
    {
      totalLinesAdded: number;
      totalLinesDeleted: number;
      acceptedLinesAdded: number;
      acceptedLinesDeleted: number;
    }
  > = {};

  cursorRecords.forEach((rec: any) => {
    const email = rec.email;
    if (!email) return;
    const local = email.split("@")[0].toLowerCase();
    if (!emailAggregates[local]) {
      emailAggregates[local] = {
        totalLinesAdded: 0,
        totalLinesDeleted: 0,
        acceptedLinesAdded: 0,
        acceptedLinesDeleted: 0,
      };
    }
    emailAggregates[local].totalLinesAdded += rec.totalLinesAdded || 0;
    emailAggregates[local].totalLinesDeleted += rec.totalLinesDeleted || 0;
    emailAggregates[local].acceptedLinesAdded += rec.acceptedLinesAdded || 0;
    emailAggregates[local].acceptedLinesDeleted += rec.acceptedLinesDeleted || 0;
  });

  const logins = Object.keys(data).filter((login) => login !== "total");

  const loginEmailMap: Record<string, string> = {};

  for (const login of logins) {
    // attempt to find email if not already mapped
    for (const repo of repos) {
      try {
        const commits = await octokit.rest.repos.listCommits({
          owner: repo.owner,
          repo: repo.repo,
          author: login,
          per_page: 1,
        });
        if (commits.data && commits.data.length > 0) {
          const email = commits.data[0].commit.author?.email;
          if (email) {
            loginEmailMap[login] = email;
            break;
          }
        }
      } catch (error) {
        // ignore and continue to next repo
      }
    }
  }

  // merge metrics into collection under the "total" date key
  for (const [login, email] of Object.entries(loginEmailMap)) {
    const local = email.split("@")[0].toLowerCase();
    const aggregate = emailAggregates[local];
    if (!aggregate) continue;

    if (!data[login]) {
      data[login] = { total: {} } as any;
    }
    if (!data[login].total) {
      data[login].total = {} as any;
    }

    data[login].total.cursorTotalLinesAdded = aggregate.totalLinesAdded;
    data[login].total.cursorTotalLinesDeleted = aggregate.totalLinesDeleted;
    data[login].total.cursorAcceptedLinesAdded = aggregate.acceptedLinesAdded;
    data[login].total.cursorAcceptedLinesDeleted = aggregate.acceptedLinesDeleted;
  }

  // compute overall totals
  let totalLinesAdded = 0;
  let totalLinesDeleted = 0;
  let totalAcceptedLinesAdded = 0;
  let totalAcceptedLinesDeleted = 0;

  for (const login of Object.keys(loginEmailMap)) {
    const col = data[login]?.total;
    if (!col) continue;
    totalLinesAdded += col.cursorTotalLinesAdded || 0;
    totalLinesDeleted += col.cursorTotalLinesDeleted || 0;
    totalAcceptedLinesAdded += col.cursorAcceptedLinesAdded || 0;
    totalAcceptedLinesDeleted += col.cursorAcceptedLinesDeleted || 0;
  }

  if (!data.total) {
    data.total = {} as any;
  }
  if (!data.total.total) {
    data.total.total = {} as any;
  }

  data.total.total.cursorTotalLinesAdded = totalLinesAdded;
  data.total.total.cursorTotalLinesDeleted = totalLinesDeleted;
  data.total.total.cursorAcceptedLinesAdded = totalAcceptedLinesAdded;
  data.total.total.cursorAcceptedLinesDeleted = totalAcceptedLinesDeleted;
}; 