export type Sport = "liga_mx" | "nfl" | "f1";

export type ProfileId = string;

/** Money is always handled as integer cents (MXN) to avoid floating point drift. */
export type Cents = number;

export const ENTRY_FEE_CENTS: Cents = 100_00;
