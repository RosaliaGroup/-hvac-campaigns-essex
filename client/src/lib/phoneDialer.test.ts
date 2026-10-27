import { describe, expect, it } from "vitest";
import { parseDialablePhone } from "./phoneDialer";

describe("CRM Tasks click-to-call", () => {
  it("opens ordinary North Jersey business numbers", () => {
    expect(parseDialablePhone("(201) 777-2312")).toEqual({tel:"2017772312",extension:null});
    expect(parseDialablePhone("+1 (973) 596-3692")).toEqual({tel:"+19735963692",extension:null});
  });
  it("never merges an office extension into the dialed number", () => {
    expect(parseDialablePhone("(973) 226-8500 ext. 2340")).toEqual({tel:"9732268500",extension:"2340"});
    expect(parseDialablePhone("201-420-2000 x1503")).toEqual({tel:"2014202000",extension:"1503"});
    expect(parseDialablePhone("+1 201 555 0199;ext=42")).toEqual({tel:"+12015550199",extension:"42"});
  });
  it("rejects missing, invalid or ambiguous phone numbers", () => {
    for(const phone of [null, "", "not listed", "201-555", "201-555-0199 ext abc", "2015550199 x1234567"]) {
      expect(parseDialablePhone(phone)).toBeNull();
    }
  });
  it("supports explicit international numbers but never guesses a country code", () => {
    expect(parseDialablePhone("+44 20 7946 0958")).toEqual({tel:"+442079460958",extension:null});
    expect(parseDialablePhone("442079460958")).toBeNull();
  });
});
