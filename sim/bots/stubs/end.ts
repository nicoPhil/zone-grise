import type { RaidResult } from "../../../src/ui/end";

export const end: { res: RaidResult | null } = { res: null };
export const renderEnd = (res: RaidResult) => {
  end.res = res;
};
