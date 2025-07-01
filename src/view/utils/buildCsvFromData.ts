import { Collection } from "../../converters/types";
import { format } from "date-fns";

type BuildCsvOptions = {
  endDate?: Date | null;
};

// backwards compatible overload
export const buildCsvFromData = (
  data: Record<string, Record<string, Collection>>,
  aggregatedCursor: Record<string, Record<string, any>>,
  loginEmails: Record<string, string> = {},
  options: BuildCsvOptions = {}
) => {
  const { endDate } = options;

  const baseHeaders = [
    "openedPRs",
    "mergedPRs",
    "revertedPRs",
    "unreviewedPRs",
    "unapprovedPRs",
    "additions",
    "deletions",
    "cursorLinesAdded",
    "cursorLinesDeleted",
    "cursorAcceptedLinesAdded",
    "cursorAcceptedLinesDeleted",
    // Timeline (percentile)
    "timeline_timeInDraft",
    "timeline_timeToReviewRequest",
    "timeline_timeToReview",
    "timeline_timeToApprove",
    "timeline_timeToMerge",
    // PR-Quality (author perspective)
    "pr_totalDiscussionsReceived",
    "pr_commentsReceived",
    "pr_changesRequestedReceived",
    // Review engagement (reviewer perspective)
    "review_reviewsConducted",
    "review_discussionsConducted",
    "review_commentsConducted",
    "review_changesRequested",
    "review_commented",
    "review_approved",
    // Response time (median)
    "response_timeFromOpenToResponse",
    "response_timeFromInitialRequestToResponse",
    "response_timeFromRepeatedRequestToResponse",
  ];

  // include every key found in aggregatedCursor numeric map (aside from the four headline ones)
  const extraHeadersSet = new Set<string>();
  Object.values(aggregatedCursor).forEach((agg) => {
    Object.keys(agg).forEach((k) => {
      if (
        [
          "totalLinesAdded",
          "totalLinesDeleted",
          "acceptedLinesAdded",
          "acceptedLinesDeleted",
        ].includes(k)
      )
        return; // already mapped
      extraHeadersSet.add(k);
    });
  });

  const extraHeaders = Array.from(extraHeadersSet);
  const headers = [
    "user",
    "email",
    "Date(UTC)",
    ...baseHeaders,
    ...extraHeaders,
  ];

  const users = Object.keys(data).filter((u) => u !== "total").sort();
  const rows: string[] = [];
  const reportDateUtc = endDate ? format(endDate, "yyyy-MM-dd") : "";
  users.forEach((u) => {
    const col = data[u]?.total || ({} as Collection);
    const cursor = aggregatedCursor[u.toLowerCase()] || {};
    const rowVals: (string | number)[] = [];
    rowVals.push(u);
    rowVals.push(loginEmails[u] || "");
    rowVals.push(reportDateUtc);
    rowVals.push(col.opened || 0);
    rowVals.push(col.merged || 0);
    rowVals.push(col.reverted || 0);
    rowVals.push(col.unreviewed || 0);
    rowVals.push(col.unapproved || 0);
    rowVals.push(col.additions || 0);
    rowVals.push(col.deletions || 0);
    rowVals.push(col.cursorTotalLinesAdded || 0);
    rowVals.push(col.cursorTotalLinesDeleted || 0);
    rowVals.push(col.cursorAcceptedLinesAdded || 0);
    rowVals.push(col.cursorAcceptedLinesDeleted || 0);

    // Timeline percentile  (use percentile; fallback to median; minutes)
    rowVals.push(col.percentile?.timeInDraft || col.median?.timeInDraft || 0);
    rowVals.push(
      col.percentile?.timeToReviewRequest || col.median?.timeToReviewRequest || 0
    );
    rowVals.push(col.percentile?.timeToReview || col.median?.timeToReview || 0);
    rowVals.push(col.percentile?.timeToApprove || col.median?.timeToApprove || 0);
    rowVals.push(col.percentile?.timeToMerge || col.median?.timeToMerge || 0);

    // PR Quality
    rowVals.push(col.discussions?.received?.total || 0);
    rowVals.push(col.reviewComments || 0);
    rowVals.push(
      (data["total"]?.total?.reviewsConducted?.[u]?.["changes_requested"] as number) ||
        0
    );

    // Review engagement
    rowVals.push(col.reviewsConducted?.total?.total || 0);
    rowVals.push(col.discussions?.conducted?.total || 0);
    rowVals.push(col.commentsConducted || 0);
    rowVals.push(col.reviewsConducted?.total?.changes_requested || 0);
    rowVals.push(col.reviewsConducted?.total?.commented || 0);
    rowVals.push(col.reviewsConducted?.total?.approved || 0);

    // Response time (median)
    rowVals.push(col.median?.timeFromOpenToResponse || 0);
    rowVals.push(col.median?.timeFromInitialRequestToResponse || 0);
    rowVals.push(col.median?.timeFromRepeatedRequestToResponse || 0);

    extraHeaders.forEach((h) => {
      const v = cursor[h];
      rowVals.push(v !== undefined ? v : "");
    });
    rows.push(rowVals.join(","));
  });

  return [headers.join(","), ...rows].join("\n");
}; 