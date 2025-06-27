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

  // aggregate per email for the whole period
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
    if (!emailAggregates[email]) {
      emailAggregates[email] = {
        totalLinesAdded: 0,
        totalLinesDeleted: 0,
        acceptedLinesAdded: 0,
        acceptedLinesDeleted: 0,
      };
    }
    emailAggregates[email].totalLinesAdded += rec.totalLinesAdded || 0;
    emailAggregates[email].totalLinesDeleted += rec.totalLinesDeleted || 0;
    emailAggregates[email].acceptedLinesAdded += rec.acceptedLinesAdded || 0;
    emailAggregates[email].acceptedLinesDeleted += rec.acceptedLinesDeleted || 0;
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
    const aggregate = emailAggregates[email];
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
}; 