export const markdownToCsv = (
  markdown: string,
  cursorRaw: any[] | undefined = undefined
): string => {
  const lines = markdown.split(/\r?\n/);

  type RowMap = Record<string, Record<string, string>>;
  const records: RowMap = {};
  const headers: string[] = [];
  const headerSet = new Set<string>();

  let currentHeader: string[] | null = null;
  let alignmentExpected = false;
  let sectionInitials = "";

  // Rules for which headers should be split on '/'
  const splitRules: { pattern: RegExp; names: (prefix: string) => string[] }[] = [
    {
      pattern: /additions\s*\/\s*deletions/i,
      names: (p) => ["Additions", "Deletions"].map((n) => (p ? `${p} ${n}` : n)),
    },
    {
      pattern: /cursor lines added\s*\/\s*deleted/i,
      names: (p) => ["Cursor lines added", "Cursor lines deleted"],
    },
    {
      pattern: /cursor accepted lines added\s*\/\s*deleted/i,
      names: (p) => ["Cursor accepted lines added", "Cursor accepted lines deleted"],
    },
    {
      pattern: /agreed\s*\/\s*disagreed\s*\/\s*total discussions received/i,
      names: (p) => [
        `${p}Agreed discussions received`.trim(),
        `${p}Disagreed discussions received`.trim(),
        `${p}Total discussions received`.trim(),
      ],
    },
    {
      pattern: /agreed\s*\/\s*disagreed\s*\/\s*total discussions conducted/i,
      names: (p) => [
        `${p}Agreed discussions conducted`.trim(),
        `${p}Disagreed discussions conducted`.trim(),
        `${p}Total discussions conducted`.trim(),
      ],
    },
    {
      pattern: /changes requested\s*\/\s*commented\s*\/\s*approved/i,
      names: (p) => [
        `${p}Changes requested`.trim(),
        `${p}Commented`.trim(),
        `${p}Approved`.trim(),
      ],
    },
  ];

  const headerSplitMap: Record<number, number> = {}; // original index -> parts count

  const processHeaderCell = (cell: string, idx: number) => {
    const rule = splitRules.find((r) => r.pattern.test(cell));
    if (!rule) return;

    const prefixMatch = cell.match(/^(.*?)\s*\w+\s*\/ /i);
    const prefix = prefixMatch ? prefixMatch[1].trim() + " " : "";

    const newHeaders = rule.names(prefix);
    currentHeader!.splice(idx, 1, ...newHeaders);
    headerSplitMap[idx] = newHeaders.length; // how many columns derived from this cell
  };

  const ensureHeader = (hdr: string) => {
    if (!headerSet.has(hdr)) {
      headerSet.add(hdr);
      headers.push(hdr);
    }
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    const sectionMatch = trimmed.match(/^###\s+(.*)/);
    if (sectionMatch) {
      const title = sectionMatch[1].trim();
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes("pull request quality")) {
        sectionInitials = "PR";
      } else if (lowerTitle.includes("code review engagement")) {
        sectionInitials = "review";
      } else {
        sectionInitials = title
          .split(/\s+/)
          .map((w) => w[0]?.toUpperCase() || "")
          .join("");
      }
      currentHeader = null;
      return;
    }

    if (!trimmed.startsWith("|")) {
      // reset on any non-table line
      currentHeader = null;
      alignmentExpected = false;
      return;
    }

    const cellsOrig = trimmed.slice(1, -1).split("|").map((c) => c.trim());

    // alignment row check
    const isAlignment = cellsOrig.every((c) => /^:?-{3,}:?$/.test(c));
    if (isAlignment) {
      alignmentExpected = false;
      return;
    }

    if (!currentHeader) {
      // this is a header row
      currentHeader = [...cellsOrig];
      // expand combined headers
      for (let i = 0; i < currentHeader.length; i++) {
        processHeaderCell(currentHeader[i], i);
      }
      // collect headers except first (user)
      currentHeader.slice(1).forEach((hdr, idx) => {
        let uniqueHdr = hdr;
        if (headerSet.has(uniqueHdr)) {
          uniqueHdr = `${sectionInitials} ${uniqueHdr}`.trim();
          currentHeader![idx + 1] = uniqueHdr; // adjust stored header
        }
        ensureHeader(uniqueHdr);
      });
      alignmentExpected = true;
      return;
    }

    if (alignmentExpected) {
      // alignment row should have been handled already, but just in case
      alignmentExpected = false;
      return;
    }

    // data row – expand only for columns we split
    const dataCells: string[] = [];
    for (let idx = 0; idx < cellsOrig.length; idx++) {
      const cellVal = cellsOrig[idx];
      const partsCount = headerSplitMap[idx];
      if (partsCount) {
        const parts = cellVal.split("/").map((p) => p.trim());
        while (parts.length < partsCount) parts.push("");
        dataCells.push(...parts.slice(0, partsCount));
      } else {
        dataCells.push(cellVal);
      }
    }

    const user = dataCells[0].replace(/^[*]+|[*]+$/g, "");
    if (!records[user]) records[user] = {};
    for (let i = 1; i < currentHeader.length; i++) {
      let hdr = currentHeader[i];
      const val = dataCells[i] ?? "";
      if (val !== "") {
        records[user][hdr] = val;
      }
      ensureHeader(hdr);
    }
  });

  // merge cursor raw
  if (cursorRaw && cursorRaw.length) {
    cursorRaw.forEach((rec) => {
      const user = rec.githubUser || (rec.email ? rec.email.split("@")[0] : "");
      if (!user) return;
      if (!records[user]) records[user] = {};
      Object.keys(rec).forEach((key) => {
        if (key === "githubUser") return;
        ensureHeader(key);
        records[user][key] = String(rec[key] ?? "");
      });
    });
  }

  // Build CSV
  const csvHeader = ["user", ...headers].join(",");
  const csvRows = Object.keys(records).map((user) => {
    const rowVals = headers.map((h) => records[user][h] ?? "");
    return [user, ...rowVals].join(",");
  });

  return [csvHeader, ...csvRows].join("\n");
}; 