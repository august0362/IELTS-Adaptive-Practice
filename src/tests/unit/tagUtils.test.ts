import { describe, expect, it } from "vitest";
import { extractTags, parseTagsString, tagsToString } from "../../lib/tagUtils";

describe("extractTags", () => {
  it("extracts multiple ASCII tags from free-form content", () => {
    expect(extractTags("Học từ vựng mới #Reading #Vocabulary hôm nay")).toEqual(["Reading", "Vocabulary"]);
  });

  it("extracts Vietnamese-character tags", () => {
    expect(extractTags("Ghi chú #TừVựng cho Speaking")).toEqual(["TừVựng"]);
  });

  it("deduplicates repeated tags, keeping first-seen order", () => {
    expect(extractTags("#Reading xong rồi, mai ôn lại #Reading")).toEqual(["Reading"]);
  });

  it("returns an empty array when there are no tags", () => {
    expect(extractTags("Không có tag nào ở đây")).toEqual([]);
  });

  it("ignores a bare # with no word characters following it (no crash, no bogus tag)", () => {
    expect(extractTags("Giá # 5 đô, không phải tag")).toEqual([]);
    expect(extractTags("dòng kết thúc bằng dấu #")).toEqual([]);
  });
});

describe("tagsToString / parseTagsString round-trip", () => {
  it("round-trips a list of tags through the comma-separated storage format", () => {
    const tags = ["Reading", "Vocabulary"];
    expect(parseTagsString(tagsToString(tags))).toEqual(tags);
  });

  it("parses an empty string as an empty array", () => {
    expect(parseTagsString("")).toEqual([]);
  });

  it("trims whitespace around each tag", () => {
    expect(parseTagsString("Reading,  Vocabulary ,  Writing")).toEqual(["Reading", "Vocabulary", "Writing"]);
  });
});
