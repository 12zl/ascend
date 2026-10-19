/* Shared validation for local model output. No generated number is invented or repaired. */
(function (root) {
  "use strict";
  const RUBRIC = "appearance-v2";
  function parseNumber(output) {
    const match = String(output || "")
      .trim()
      .match(/^(100|[1-9]\d?)(?:\s*\/\s*100)?[.!]?$/);
    if (!match)
      throw new Error(
        "The model did not return a clear 1–100 rating. No replacement score was generated.",
      );
    return Number(match[1]);
  }
  function parseOutputs(output) {
    const data = typeof output === "string" ? JSON.parse(output) : output;
    const resting = parseNumber(data.current),
      potential = parseNumber(data.potential);
    if (typeof data.advice !== "string" || !data.advice.trim())
      throw new Error("The model did not return grooming advice.");
    const issues = data.advice
      .split(/\n+/)
      .map((line) => line.replace(/^\s*[-*\d.)]+\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 3)
      .map((line) => {
        const fields = line.split("|").map((v) => v.trim());
        if (
          fields.length >= 3 &&
          fields[0] &&
          fields.slice(2).join("").trim() &&
          /^(Low|Medium|High)$/i.test(fields[1])
        )
          return {
            issue: fields[0].slice(0, 160),
            severity:
              fields[1][0].toUpperCase() + fields[1].slice(1).toLowerCase(),
            action: fields.slice(2).join(" | ").slice(0, 500),
          };
        return null;
      })
      .filter(Boolean);
    return {
      resting,
      potential,
      summary: data.advice.trim().slice(0, 600),
      issues,
    };
  }
  root.AscendRating = { RUBRIC, parseNumber, parseOutputs };
  if (typeof module === "object" && module.exports)
    module.exports = root.AscendRating;
})(typeof self !== "undefined" ? self : globalThis);
