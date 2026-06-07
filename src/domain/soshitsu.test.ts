import { describe, expect, it } from "vitest";
import { judgeSoshitsu } from "./soshitsu";

describe("素質判定（ペイ別の皐月オッズ）", () => {
  it("ペイ90・弥生1着のオッズ帯", () => {
    const j = (odds: number) =>
      judgeSoshitsu({ pay: "90", rotation: "弥生→皐月", yayoiFinish: 1, odds }).rank;
    expect(j(2.8)).toBe("MAX上");
    expect(j(2.9)).toBe("MAX下");
    expect(j(3.0)).toBe("準MAX");
    expect(j(3.1)).toBe("準MAX未満");
  });

  it("着順区分：4〜5着は④、6着以下は⑥", () => {
    expect(judgeSoshitsu({ pay: "90", rotation: "弥生→皐月", yayoiFinish: 8, odds: 3.3 }).rank).toBe("MAX中");
    expect(judgeSoshitsu({ pay: "90", rotation: "弥生→皐月", yayoiFinish: 4, odds: 3.0 }).rank).toBe("MAX上");
  });

  it("桜花賞ローテは閾値-0.1", () => {
    // ペイ90・弥生1着・皐月なら2.8でMAX上。桜花は閾値-0.1なので2.7でMAX上。
    expect(judgeSoshitsu({ pay: "90", rotation: "弥生→桜花", yayoiFinish: 1, odds: 2.7 }).rank).toBe("MAX上");
  });

  it("ペイ80・弥生2着", () => {
    const j = (odds: number) =>
      judgeSoshitsu({ pay: "80", rotation: "弥生→皐月", yayoiFinish: 2, odds }).rank;
    expect(j(2.4)).toBe("MAX上");
    expect(j(2.7)).toBe("準MAX");
  });
});
