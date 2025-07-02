import { makeComplexRequest } from "../../requests";
import { Collection } from "../types";
import { getPullRequestSize } from "./calculations";
import { checkRevert } from "./checkRevert";

const isMergedToDefaultBranch = (pr: any): boolean => {
  if (!pr?.merged || !pr?.base?.ref) return false;
  // `base.repo.default_branch` is present in the API response; fall back to "main" if undefined
  const defaultBranch = pr.base?.repo?.default_branch || "main";
  return pr.base.ref === defaultBranch;
};

export const preparePullRequestInfo = (
  pullRequest: Awaited<
    ReturnType<typeof makeComplexRequest>
  >["pullRequestInfo"][number],
  collection?: Collection
) => {
  const previousComments =
    typeof collection?.comments === "number" ? collection?.comments : 0;
  const comments = previousComments + (pullRequest?.comments || 0);

  const previousReviewComments =
    typeof collection?.totalReviewComments === "number"
      ? collection?.totalReviewComments
      : 0;

  const totalReviewComments =
    previousReviewComments + (pullRequest?.review_comments || 0);
  return {
    ...collection,
    opened: (collection?.opened || 0) + 1,
    closed: pullRequest?.closed_at
      ? (collection?.closed || 0) + 1
      : collection?.closed || 0,
    merged: pullRequest?.merged
      ? (collection?.merged || 0) + 1
      : collection?.merged || 0,
    comments,
    totalReviewComments,
    reverted:
      typeof pullRequest?.head.ref === "string" &&
      checkRevert(pullRequest?.head.ref)
        ? (collection?.reverted || 0) + 1
        : collection?.reverted || 0,
    additions: (collection?.additions || 0) + (pullRequest?.additions || 0),
    deletions: (collection?.deletions || 0) + (pullRequest?.deletions || 0),
    // Stats for PRs merged into default branch
    mergedToDefault:
      (collection?.mergedToDefault || 0) + (isMergedToDefaultBranch(pullRequest) ? 1 : 0),
    additionsToDefault:
      (collection?.additionsToDefault || 0) +
      (isMergedToDefaultBranch(pullRequest) ? pullRequest?.additions || 0 : 0),
    deletionsToDefault:
      (collection?.deletionsToDefault || 0) +
      (isMergedToDefaultBranch(pullRequest) ? pullRequest?.deletions || 0 : 0),
    prSizes: [
      ...(collection?.prSizes || []),
      getPullRequestSize(pullRequest?.additions, pullRequest?.deletions),
    ],
  };
};
