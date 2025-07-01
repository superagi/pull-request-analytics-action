import { commonHeaders } from "./constants";
import { isAfter, isBefore, isEqual, parseISO, addDays } from "date-fns";

import { octokit } from "../octokit";
import { getReportDates } from "./utils";
import { Repository } from "./types";

export const getPullRequests = async (
  amount: number = 10,
  repository: Repository
) => {
  const { startDate, endDate } = getReportDates();
  const { owner, repo } = repository;

  // If start and end dates are the same day, extend end date by 1 day so that the whole day is included (closed_at is usually later than midnight)
  const effectiveEndDate =
    startDate && endDate && isEqual(startDate, endDate)
      ? addDays(endDate, 1)
      : endDate;

  const data = [];
  for (
    let i = 0, dateMatched = !!startDate;
    startDate ? dateMatched : i < Math.ceil(amount / 100);
    i++
  ) {
    const pulls = await octokit.rest.pulls.list({
      owner,
      repo,
      per_page: amount > 100 || startDate ? 100 : amount,
      page: i + 1,
      state: "closed",
      sort: "updated",
      direction: "desc",
      headers: commonHeaders,
    });
    if (startDate || endDate) {
      const filteredPulls = pulls.data.filter((pr) => {
        const closedDate = pr.closed_at ? parseISO(pr.closed_at) : null;
        if (closedDate) {
          const isBeforeOrEqualEndDate = effectiveEndDate
            ? isBefore(closedDate, effectiveEndDate) || isEqual(closedDate, effectiveEndDate)
            : true;
          const isAfterOrEqualStartDate = startDate
            ? isAfter(closedDate, startDate) || isEqual(closedDate, startDate)
            : true;
          return isBeforeOrEqualEndDate && isAfterOrEqualStartDate;
        }
        return false;
      });
      dateMatched = pulls.data.some((pr) => {
        if (!startDate || !pr.updated_at) return null;
        const updatedDate = parseISO(pr.updated_at);
        return isBefore(startDate, updatedDate) || isEqual(startDate, updatedDate);
      });
      data.push(...filteredPulls);
    } else {
      data.push(...pulls.data);
    }
    if (pulls.data.length === 0) {
      break;
    }
  }
  return data;
};
