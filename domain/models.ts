export type ParticipantTone = "mint" | "lavender" | "blue" | "peach";

export type Participant = {
  id: string;
  name: string;
  tone: ParticipantTone;
};

export type BillItem = {
  id: string;
  name: string;
  quantity: number;
  total: number;
  shared: boolean;
  assignments: Record<string, number>;
};

export type BillDistribution = {
  subtotals: Record<string, number>;
  tipAllocations: Record<string, number>;
  totals: Record<string, number>;
  subtotal: number;
  tip: number;
  grandTotal: number;
};
