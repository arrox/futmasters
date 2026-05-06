import Dexie, { type Table } from "dexie";
import type { SorteoResponse } from "../api/client";

export interface SorteoRow {
  sorteo_id: string;
  timestamp: string;
  mode: string;
  seed: number | null;
  num_participants: number;
  hash: string;
  payload: SorteoResponse;
}

class FC26Database extends Dexie {
  sorteos!: Table<SorteoRow, string>;

  constructor() {
    super("fc26_sorteo");
    this.version(1).stores({
      sorteos: "sorteo_id, timestamp, mode",
    });
  }
}

export const db = new FC26Database();
