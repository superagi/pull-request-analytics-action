export const buildCsvFromCursorRaw = (cursorRaw: any[]): string => {
  if (!cursorRaw || cursorRaw.length === 0) return "";
  const numericHeaderOrder: string[] = [
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
  const stringFields = [
    "date",
    "isActive",
    "mostUsedModel",
    "applyMostUsedExtension",
    "tabMostUsedExtension",
    "clientVersion",
    "email",
  ];
  const headers = ["githubUser", ...stringFields, ...numericHeaderOrder];
  const rows = cursorRaw.map((rec) => {
    const row: (string | number | boolean)[] = [];
    row.push(rec.githubUser || "");
    stringFields.forEach((f) => row.push(rec[f] ?? ""));
    numericHeaderOrder.forEach((f) => row.push(rec[f] ?? 0));
    return row.join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}; 