import { Injectable } from "@nestjs/common";
import { db } from "../drizzle/index";
import { currencies } from "../drizzle/schema";
import { eq } from "drizzle-orm";

@Injectable()
export class CurrenciesService {
  async getAllCurrencies() {
    return db.select().from(currencies);
  }

  async getCurrencyById(id: number) {
    return db.select().from(currencies).where(eq(currencies.id, id));
  }
  async create(data: { name: string; symbol: string, ref?: number }) {
    return await db.insert(currencies).values(data).returning();
  }

  async update(id: number, data: { name?: string; symbol?: string, ref?: number }) {
    return await db.update(currencies).set(data).where(eq(currencies.id, id)).returning();
  }

  async delete(id: number) {
    return await db.delete(currencies).where(eq(currencies.id, id)).returning();
  }
}
