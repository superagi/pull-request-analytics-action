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
    Record<string, number | string>
  > = {};

  const numericKeys = [
    "totalLinesAdded",
    "totalLinesDeleted",
    "acceptedLinesAdded",
    "acceptedLinesDeleted",
    "totalApplies",
    "totalAccepts",
    "totalRejects",
    "totalTabsShown",
    "totalTabsAccepted",
    "composerRequests",
    "chatRequests",
    "agentRequests",
    "cmdkUsages",
    "subscriptionIncludedReqs",
    "apiKeyReqs",
    "usageBasedReqs",
    "bugbotUsages",
  ];

  cursorRecords.forEach((rec: any) => {
    const email = rec.email;
    if (!email) return;
    const local = email.split("@")[0].toLowerCase();
    if (!emailAggregates[local]) {
      emailAggregates[local] = {};
      numericKeys.forEach((k) => (emailAggregates[local][k] = 0));
    }
    numericKeys.forEach((k) => {
      emailAggregates[local][k] =
        (emailAggregates[local][k] as number) + (rec[k] || 0);
    });
    // non-numeric fields keep last non-empty value
    [
      "mostUsedModel",
      "applyMostUsedExtension",
      "tabMostUsedExtension",
      "clientVersion",
    ].forEach((k) => {
      if (rec[k]) emailAggregates[local][k] = rec[k];
    });
  });

  const logins = Object.keys(data).filter((login) => login !== "total");

  const loginEmailMap: Record<string, string> = {};

  const localToLogins: Record<string, string[]> = {};

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
            const local = email.split("@")[0].toLowerCase();
            localToLogins[local] = [...(localToLogins[local] || []), login];
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
    const aggregate = emailAggregates[local] as Record<string, number>;
    if (!aggregate) continue;

    if (!data[login]) {
      data[login] = { total: {} } as any;
    }
    if (!data[login].total) {
      data[login].total = {} as any;
    }

    data[login].total.cursorTotalLinesAdded =
      (aggregate.totalLinesAdded as number) || 0;
    data[login].total.cursorTotalLinesDeleted =
      (aggregate.totalLinesDeleted as number) || 0;
    data[login].total.cursorAcceptedLinesAdded =
      (aggregate.acceptedLinesAdded as number) || 0;
    data[login].total.cursorAcceptedLinesDeleted =
      (aggregate.acceptedLinesDeleted as number) || 0;
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

  // Prepare raw records with github mapping for csv
  const cursorRaw = cursorRecords.map((rec: any) => {
    const local = (rec.email || "").split("@")[0].toLowerCase();
    // pick first login or fallback to local part
    const gh = localToLogins[local]?.[0] || local;
    return { githubUser: gh, ...rec };
  });

  (data as any).cursorRaw = cursorRaw;
  (data as any).__loginEmails = loginEmailMap;
}; 