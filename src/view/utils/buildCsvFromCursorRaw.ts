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
    "isActive",
    "mostUsedModel",
    "applyMostUsedExtension",
    "tabMostUsedExtension",
    "clientVersion",
    "email",
  ];
  const headers = ["githubUser", "date", "Date(UTC)", ...stringFields, ...numericHeaderOrder];
  const rows = cursorRaw.map((rec) => {
    const row: (string | number | boolean)[] = [];
    row.push(rec.githubUser || "");
    row.push(rec.date ?? "");
    const utcStr = rec.date ? new Date(rec.date).toISOString() : "";
    row.push(utcStr);
    stringFields.forEach((f) => row.push(rec[f] ?? ""));
    numericHeaderOrder.forEach((f) => row.push(rec[f] ?? 0));
    return row.join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}; 