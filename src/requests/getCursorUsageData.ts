import * as core from "@actions/core";

export type CursorDailyUsage = {
  date: number;
  isActive: boolean;
  totalLinesAdded: number;
  totalLinesDeleted: number;
  acceptedLinesAdded: number;
  acceptedLinesDeleted: number;
  email?: string;
};

type CursorUsageResponse = {
  data: CursorDailyUsage[];
  period: {
    startDate: number;
    endDate: number;
  };
};

/**
 * Fetches aggregated Cursor usage metrics for the last 7 days.
 * If the `CURSOR_API_KEY` input is missing the promise resolves to an empty array.
 */
export const getCursorUsageData = async (): Promise<CursorDailyUsage[]> => {
  const apiKey = core.getInput("CURSOR_API_KEY");
  if (!apiKey) {
    core.info("No CURSOR_API_KEY provided – skipping Cursor analytics fetch.");
    return [];
  }

  const endDate = Date.now();
  const startDate = endDate - 7 * 24 * 60 * 60 * 1000; // last 7 days

  const body = {
    startDate,
    endDate,
  };

  const authHeader = Buffer.from(`${apiKey}:`).toString("base64");

  try {
    const response = await fetch("https://api.cursor.com/teams/daily-usage-data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authHeader}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Cursor API responded with status ${response.status}`);
    }

    const json = (await response.json()) as CursorUsageResponse;
    return json.data || [];
  } catch (error) {
    core.warning(`Failed to fetch Cursor analytics data: ${error}`);
    return [];
  }
}; 