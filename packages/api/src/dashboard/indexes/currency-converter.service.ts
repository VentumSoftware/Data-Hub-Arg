// src/dashboard/indexes/currency-converter.service.ts
import { Injectable } from '@nestjs/common';
import { eq, and, or, gte, lte, desc, asc, sql, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { isSameDay } from '../../../lib/index';
import { DatabaseService } from 'src/database/database.service';
import { currencies, currenciesRelations, currencyIndexes } from '../../../drizzle/schema';
import { IndexesRepository } from './indexes.repository';
export type Currency = {
    id: number;
    code: string;
    label: string;
    symbol: string;
};

export type Relation = {
    dividendId: number;
    divisorId: number;
    op: 'direct' | 'inverse' | 'both';
    label: string;
    source?: string;
};

export type Index = {
    date: Date;
    dividendId: number;
    divisorId: number;
    value: number;
};

export type DateCurrency = {
    date: Date;
    currencyId: number;
};

type PathStep = {
    fromCurrencyId: number;
    toCurrencyId: number;
    relations: Relation[];
};

type Path = PathStep[];

export type ConversionOptions = {
    summarize?: 'average' | 'min' | 'max';
    interpolation?: 'average' | 'last' | 'closest' | 'next' | 'error';
    extrapolation?: 'closest' | 'error';
};

const defaultOptions: ConversionOptions = {
    summarize: 'average',
    interpolation: 'last',
    extrapolation: 'closest'
};

@Injectable()
export class CurrencyConverterService {
    constructor(private db: DatabaseService, private indexesRepository: IndexesRepository) {}

    private summarizeRelations(relations: { relation: Relation, value: number | null }[], summarize: 'average' | 'min' | 'max'): number {
        const values = relations.map(x => x.value).filter(v => v !== null) as number[];
        
        switch (summarize) {
            case 'average':
                return values.reduce((p, x) => p + x, 0) / values.length;
            case 'min':
                return Math.min(...values);
            case 'max':
                return Math.max(...values);
        }
    }

    private async getRelationValue(fromCurrencyId: number, toCurrencyId: number, relation: Relation, date: Date, options: ConversionOptions): Promise<number> {
        const getRelation = (value: number) => {
            // Database: dividendId/divisorId = value (e.g., Peso/DolarMEP = 162.85 means 1 DolarMEP = 162.85 Pesos)
            // If going from divisor to dividend (DolarMEP→Peso): use value directly
            // If going from dividend to divisor (Peso→DolarMEP): use 1/value
            
            const isFromDivisorToDividend = (relation.divisorId === fromCurrencyId && relation.dividendId === toCurrencyId);
            const isFromDividendToDivisor = (relation.dividendId === fromCurrencyId && relation.divisorId === toCurrencyId);
            
            let result;
            if (isFromDivisorToDividend) {
                result = value; // DolarMEP→Peso: use value directly
            } else if (isFromDividendToDivisor) {
                result = 1 / value; // Peso→DolarMEP: use 1/value
            } else {
                throw new Error(`Invalid currency relation: ${fromCurrencyId} → ${toCurrencyId}`);
            }
            
            console.log('🔬 Relation direction analysis:', {
                fromCurrencyId,
                toCurrencyId,
                relation: { dividendId: relation.dividendId, divisorId: relation.divisorId, op: relation.op },
                rawValue: value,
                isFromDivisorToDividend,
                isFromDividendToDivisor,
                finalValue: result
            });
            
            return result;
        };

        // Find the relation ID first
        const relationRecord = await this.db.db
            .select()
            .from(currenciesRelations)
            .where(
                and(
                    eq(currenciesRelations.dividendId, relation.dividendId),
                    eq(currenciesRelations.divisorId, relation.divisorId),
                    eq(currenciesRelations.isDeleted, false)
                )
            )
            .limit(1);

        if (relationRecord.length === 0) {
            throw new Error(`No relation found between currencies ${relation.dividendId} and ${relation.divisorId}`);
        }

        const relationId = relationRecord[0].id;

        // Find exact date match
        const exactIndex = await this.db.db
            .select()
            .from(currencyIndexes)
            .where(
                and(
                    eq(currencyIndexes.currenciesRelationsId, relationId),
                    eq(currencyIndexes.date, date.toISOString().split('T')[0]),
                    eq(currencyIndexes.isDeleted, false)
                )
            )
            .limit(1);

        if (exactIndex.length > 0) {
            return getRelation(exactIndex[0].value);
        }

        // Find next and previous indexes
        const [nextIndexes, prevIndexes] = await Promise.all([
            this.db.db
                .select()
                .from(currencyIndexes)
                .where(
                    and(
                        eq(currencyIndexes.currenciesRelationsId, relationId),
                        gte(currencyIndexes.date, date.toISOString().split('T')[0]),
                        eq(currencyIndexes.isDeleted, false)
                    )
                )
                .orderBy(asc(currencyIndexes.date))
                .limit(1),
            this.db.db
                .select()
                .from(currencyIndexes)
                .where(
                    and(
                        eq(currencyIndexes.currenciesRelationsId, relationId),
                        lte(currencyIndexes.date, date.toISOString().split('T')[0]),
                        eq(currencyIndexes.isDeleted, false)
                    )
                )
                .orderBy(desc(currencyIndexes.date))
                .limit(1)
        ]);

        const next = nextIndexes[0];
        const prev = prevIndexes[0];

        if (next && prev) {
            switch (options.interpolation) {
                case 'last':
                    return getRelation(prev.value);
                case 'next':
                    return getRelation(next.value);
                case 'average':
                    return getRelation((prev.value + next.value) / 2);
                case 'closest':
                    const nextDate = new Date(next.date);
                    const prevDate = new Date(prev.date);
                    const diffNext = Math.abs(nextDate.getTime() - date.getTime());
                    const diffPrev = Math.abs(date.getTime() - prevDate.getTime());
                    return getRelation(diffNext < diffPrev ? next.value : prev.value);
                default:
                    throw new Error(`Index not found: ${fromCurrencyId} -> ${toCurrencyId} at ${date.toISOString()}`);
            }
        } else if (next || prev) {
            const available = next || prev;
            switch (options.extrapolation) {
                case 'closest':
                    return getRelation(available!.value);
                default:
                    throw new Error(`Index not found: ${fromCurrencyId} -> ${toCurrencyId} at ${date.toISOString()}`);
            }
        } else {
            throw new Error(`No index value found for: ${fromCurrencyId} -> ${toCurrencyId} at ${date.toISOString()}`);
        }
    }

    private async getStepRelation(date: Date, step: PathStep, options?: ConversionOptions): Promise<number> {
        const _options = { ...defaultOptions, ...options };
        const relations = [];
        
        for (const relation of step.relations) {
            const indexValue = await this.getRelationValue(step.fromCurrencyId, step.toCurrencyId, relation, date, _options);
            relations.push({ relation, value: indexValue });
        }
        
        return this.summarizeRelations(relations, _options.summarize!);
    }

    private async getPathRelation(date: Date, path: Path, options?: ConversionOptions): Promise<number> {
        let result = 1;
        for (const step of path) {
            result *= await this.getStepRelation(date, step, options);
        }
        return result;
    }

    async getPath(fromCurrencyId: number, toCurrencyId: number, acc: Path = []): Promise<Path | null> {
        if (toCurrencyId == null) {
            return null;
        } else if (fromCurrencyId === toCurrencyId) {
            return acc;
        } else if (acc.some(step => step.fromCurrencyId === fromCurrencyId)) {
            // Circular relation detected
            return null;
        }

        // Get all relations for this currency
        const allRelations = await this.db.db
            .select()
            .from(currenciesRelations)
            .where(
                and(
                    or(
                        eq(currenciesRelations.dividendId, fromCurrencyId),
                        eq(currenciesRelations.divisorId, fromCurrencyId)
                    ),
                    eq(currenciesRelations.isDeleted, false)
                )
            );

        // Group relations by fromCurrencyId and toCurrencyId
        const groupedSteps: PathStep[] = [];
        
        for (const relation of allRelations) {
            const pair = [relation.dividendId, relation.divisorId];
            const nextCurrencyId = pair.find(id => id !== fromCurrencyId);
            
            if (!nextCurrencyId) continue;
            
            let existingGroup = groupedSteps.find(g => g.toCurrencyId === nextCurrencyId);
            
            if (existingGroup) {
                existingGroup.relations.push({
                    dividendId: relation.dividendId,
                    divisorId: relation.divisorId,
                    op: relation.op,
                    label: '',
                    source: relation.source
                });
            } else {
                groupedSteps.push({
                    fromCurrencyId,
                    toCurrencyId: nextCurrencyId,
                    relations: [{
                        dividendId: relation.dividendId,
                        divisorId: relation.divisorId,
                        op: relation.op,
                        label: '',
                        source: relation.source
                    }]
                });
            }
        }

        // Try each possible path
        for (const step of groupedSteps) {
            const path = await this.getPath(step.toCurrencyId, toCurrencyId, [...acc, step]);
            if (path !== null) {
                return path;
            }
        }

        return null;
    }

    async convertCurrency(
        value: number,
        from: DateCurrency,
        to: DateCurrency,
        constantCurrencyId: number,
        options?: ConversionOptions
    ): Promise<number> {
        console.log('🔄 convertCurrency called with:', {
            value,
            from: { currencyId: from.currencyId, date: from.date.toISOString().split('T')[0] },
            to: { currencyId: to.currencyId, date: to.date.toISOString().split('T')[0] },
            constantCurrencyId
        });

        // Only skip calculation if it's the exact same currency AND date
        if (from.currencyId === to.currencyId && from.date.toISOString().split('T')[0] === to.date.toISOString().split('T')[0]) {
            console.log('✅ Same currency and date conversion, returning original value:', value);
            return value;
        }
        
        const fromPath = await this.getPath(from.currencyId, constantCurrencyId);
        const toPath = await this.getPath(constantCurrencyId, to.currencyId);
        
        console.log('📍 Paths found:', {
            fromPath: fromPath?.length || 0,
            toPath: toPath?.length || 0,
            fromPathDetails: fromPath,
            toPathDetails: toPath
        });
        
        if (!fromPath || !toPath) {
            throw new Error(`No conversion path found between currencies`);
        }
        
        console.log('🔍 Calculating fromRelation: Peso->DolarMEP on', from.date.toISOString().split('T')[0]);
        const fromRelation = await this.getPathRelation(from.date, fromPath, options);
        
        console.log('🔍 Calculating toRelation: DolarMEP->Peso on', to.date.toISOString().split('T')[0]);
        const toRelation = await this.getPathRelation(to.date, toPath, options);
        
        console.log('💱 Relations calculated:', {
            fromRelation,
            toRelation,
            result: value * fromRelation * toRelation
        });
        
        return value * fromRelation * toRelation;
    }

    // Database operations
    async pathExists(fromCurrencyId: number, toCurrencyId: number): Promise<boolean> {
        const path = await this.getPath(fromCurrencyId, toCurrencyId);
        return path !== null;
    }

    async addCurrency(currency: Omit<Currency, 'id'>, newRelations: Omit<Relation, 'id'>[]): Promise<Currency> {
        return await this.db.db.transaction(async (tx) => {
            // Validate currency doesn't already exist
            const existing = await tx
                .select()
                .from(currencies)
                .where(
                    and(
                        eq(currencies.code, currency.code),
                        eq(currencies.isDeleted, false)
                    )
                )
                .limit(1);

            if (existing.length > 0) {
                throw new Error(`Currency with code ${currency.code} already exists`);
            }

            // Validate at least one relation is provided
            if (!newRelations || newRelations.length === 0) {
                throw new Error('At least one relation must be provided when adding a new currency');
            }

            // Insert currency
            const insertedCurrency = await tx
                .insert(currencies)
                .values(currency)
                .returning();

            const currencyId = insertedCurrency[0].id;

            // Validate all relations involve the new currency
            const invalidRelations = newRelations.filter(r =>
                r.dividendId !== currencyId && r.divisorId !== currencyId
            );
            
            if (invalidRelations.length > 0) {
                throw new Error('All relations must involve the new currency');
            }

            // Get all currencies that will be connected
            const connectedCurrencies = new Set<number>();
            newRelations.forEach(r => {
                if (r.dividendId === currencyId) connectedCurrencies.add(r.divisorId);
                if (r.divisorId === currencyId) connectedCurrencies.add(r.dividendId);
            });

            // Check for multiple paths
            const connectedArray = Array.from(connectedCurrencies);
            for (let i = 0; i < connectedArray.length; i++) {
                for (let j = i + 1; j < connectedArray.length; j++) {
                    if (await this.pathExists(connectedArray[i], connectedArray[j])) {
                        throw new Error(
                            `Cannot add currency ${currency.code} with relations to both ${connectedArray[i]} and ${connectedArray[j]} ` +
                            `because they are already connected. This would create multiple paths.`
                        );
                    }
                }
            }

            // Insert relations
            await tx.insert(currenciesRelations).values(newRelations);

            return insertedCurrency[0] as Currency;
        });
    }

    async addRelation(relation: Omit<Relation, 'id'>): Promise<Relation> {
        // Check if currencies exist
        const [dividend, divisor] = await Promise.all([
            this.db.db
                .select()
                .from(currencies)
                .where(
                    and(
                        eq(currencies.id, relation.dividendId),
                        eq(currencies.isDeleted, false)
                    )
                )
                .limit(1),
            this.db.db
                .select()
                .from(currencies)
                .where(
                    and(
                        eq(currencies.id, relation.divisorId),
                        eq(currencies.isDeleted, false)
                    )
                )
                .limit(1)
        ]);

        if (dividend.length === 0 || divisor.length === 0) {
            throw new Error('Both dividend and divisor currencies must exist');
        }

        // Check if adding this relation would create multiple paths
        if (await this.pathExists(relation.dividendId, relation.divisorId)) {
            throw new Error(
                `Adding this relation would create multiple paths between currencies ${relation.dividendId} and ${relation.divisorId}`
            );
        }

        // Insert relation
        const inserted = await this.db.db
            .insert(currenciesRelations)
            .values(relation)
            .returning();

        return {
            dividendId: inserted[0].dividendId,
            divisorId: inserted[0].divisorId,
            op: inserted[0].op,
            label: '', // Set empty or derive from currency names
            source: inserted[0].source
        } as Relation;
    }

    async addIndex(index: Omit<Index, 'id'>): Promise<Index> {
        // Validate relation exists
        const relation = await this.db.db
            .select()
            .from(currenciesRelations)
            .where(
                and(
                    eq(currenciesRelations.dividendId, index.dividendId),
                    eq(currenciesRelations.divisorId, index.divisorId),
                    eq(currenciesRelations.isDeleted, false)
                )
            )
            .limit(1);

        if (relation.length === 0) {
            throw new Error(`No relation exists between currencies ${index.dividendId} and ${index.divisorId}`);
        }

        // Validate value is positive
        if (index.value <= 0) {
            throw new Error('Index value must be positive');
        }

        // Insert index
        const inserted = await this.db.db
            .insert(currencyIndexes)
            .values({
                currenciesRelationsId: relation[0].id,
                value: index.value,
                date: index.date.toISOString().split('T')[0]
            })
            .returning();

        return {
            dividendId: index.dividendId,
            divisorId: index.divisorId,
            value: inserted[0].value,
            date: new Date(inserted[0].date)
        } as Index;
    }

    async getAllCurrencies(): Promise<Currency[]> {
        const result = await this.db.db
            .select()
            .from(currencies)
            .where(eq(currencies.isDeleted, false));

        return result as Currency[];
    }

    async getCurrencyRelations(currencyId: number): Promise<Relation[]> {
        const result = await this.db.db
            .select()
            .from(currenciesRelations)
            .where(
                and(
                    or(
                        eq(currenciesRelations.dividendId, currencyId),
                        eq(currenciesRelations.divisorId, currencyId)
                    ),
                    eq(currenciesRelations.isDeleted, false)
                )
            );

        return result.map(r => ({
            dividendId: r.dividendId,
            divisorId: r.divisorId,
            op: r.op,
            label: '', // We'll need to add this field or modify the interface
            source: r.source
        })) as Relation[];
    }

    async getHistoricalIndexes(options?: {
        limit?: number;
        offset?: number;
        sortField?: string;
        sortOrder?: 'asc' | 'desc';
    }): Promise<{ data: any[]; total: number }> {
        try {
            console.log('Starting getHistoricalIndexes query with options:', options);
            
            const limit = options?.limit || 100;
            const offset = options?.offset || 0;
            const sortField = options?.sortField || 'date';
            const sortOrder = options?.sortOrder || 'desc';

            // Get total count
            const countResult = await this.db.db
                .select({ count: sql<number>`count(*)` })
                .from(currencyIndexes)
                .where(eq(currencyIndexes.isDeleted, false));
            
            const total = countResult[0]?.count || 0;

            // Create aliases for dividend and divisor currencies
            const dividendCurrency = alias(currencies, 'dividendCurrency');
            const divisorCurrency = alias(currencies, 'divisorCurrency');

            // Build query with joins to get currency names
            let baseQuery = this.db.db
                .select({
                    id: currencyIndexes.id,
                    date: currencyIndexes.date,
                    currenciesRelationsId: currencyIndexes.currenciesRelationsId,
                    value: currencyIndexes.value,
                    isDeleted: currencyIndexes.isDeleted,
                    editedAt: currencyIndexes.editedAt,
                    editedBy: currencyIndexes.editedBy,
                    editedSession: currencyIndexes.editedSession,
                    dividendCurrencyCode: dividendCurrency.code,
                    dividendCurrencyLabel: dividendCurrency.label,
                    divisorCurrencyCode: divisorCurrency.code,
                    divisorCurrencyLabel: divisorCurrency.label,
                    op: currenciesRelations.op,
                })
                .from(currencyIndexes)
                .innerJoin(currenciesRelations, eq(currencyIndexes.currenciesRelationsId, currenciesRelations.id))
                .innerJoin(dividendCurrency, eq(currenciesRelations.dividendId, dividendCurrency.id))
                .innerJoin(divisorCurrency, eq(currenciesRelations.divisorId, divisorCurrency.id))
                .where(eq(currencyIndexes.isDeleted, false));

            // Apply sorting
            let result;
            if (sortField === 'date') {
                result = await baseQuery
                    .orderBy(sortOrder === 'desc' ? desc(currencyIndexes.date) : asc(currencyIndexes.date))
                    .limit(limit)
                    .offset(offset);
            } else if (sortField === 'value') {
                result = await baseQuery
                    .orderBy(sortOrder === 'desc' ? desc(currencyIndexes.value) : asc(currencyIndexes.value))
                    .limit(limit)
                    .offset(offset);
            } else if (sortField === 'id') {
                result = await baseQuery
                    .orderBy(sortOrder === 'desc' ? desc(currencyIndexes.id) : asc(currencyIndexes.id))
                    .limit(limit)
                    .offset(offset);
            } else {
                // Default sorting by date
                result = await baseQuery
                    .orderBy(desc(currencyIndexes.date))
                    .limit(limit)
                    .offset(offset);
            }

            console.log(`Query successful, returning ${result.length} results out of ${total} total`);
            return {
                data: result,
                total: total
            };
        } catch (error) {
            console.error('Error in getHistoricalIndexes:', error);
            throw error;
        }
    }

    async getHistoricalIndexesByDates(options?: {
        limit?: number;
        offset?: number;
        sortOrder?: 'asc' | 'desc';
    }): Promise<{ data: any[]; total: number }> {
        try {
            console.log('Starting getHistoricalIndexesByDates query with options:', options);
            
            const limit = options?.limit || 25;
            const offset = options?.offset || 0;
            const sortOrder = options?.sortOrder || 'desc';

            // Get total count of unique dates
            const countResult = await this.db.db
                .select({ count: sql<number>`count(distinct date)` })
                .from(currencyIndexes)
                .where(eq(currencyIndexes.isDeleted, false));
            
            const totalDates = countResult[0]?.count || 0;

            // Get unique dates with pagination
            const datesQuery = this.db.db
                .select({ date: currencyIndexes.date })
                .from(currencyIndexes)
                .where(eq(currencyIndexes.isDeleted, false))
                .groupBy(currencyIndexes.date)
                .orderBy(sortOrder === 'desc' ? desc(currencyIndexes.date) : asc(currencyIndexes.date))
                .limit(limit)
                .offset(offset);

            const dateResults = await datesQuery;
            const dates = dateResults.map(r => r.date);

            if (dates.length === 0) {
                return { data: [], total: totalDates };
            }

            // Create aliases for dividend and divisor currencies
            const dividendCurrency = alias(currencies, 'dividendCurrency');
            const divisorCurrency = alias(currencies, 'divisorCurrency');

            // Get all data for the selected dates
            const result = await this.db.db
                .select({
                    id: currencyIndexes.id,
                    date: currencyIndexes.date,
                    currenciesRelationsId: currencyIndexes.currenciesRelationsId,
                    value: currencyIndexes.value,
                    isDeleted: currencyIndexes.isDeleted,
                    editedAt: currencyIndexes.editedAt,
                    editedBy: currencyIndexes.editedBy,
                    editedSession: currencyIndexes.editedSession,
                    dividendCurrencyCode: dividendCurrency.code,
                    dividendCurrencyLabel: dividendCurrency.label,
                    divisorCurrencyCode: divisorCurrency.code,
                    divisorCurrencyLabel: divisorCurrency.label,
                    op: currenciesRelations.op,
                })
                .from(currencyIndexes)
                .innerJoin(currenciesRelations, eq(currencyIndexes.currenciesRelationsId, currenciesRelations.id))
                .innerJoin(dividendCurrency, eq(currenciesRelations.dividendId, dividendCurrency.id))
                .innerJoin(divisorCurrency, eq(currenciesRelations.divisorId, divisorCurrency.id))
                .where(
                    and(
                        eq(currencyIndexes.isDeleted, false),
                        inArray(currencyIndexes.date, dates)
                    )
                )
                .orderBy(sortOrder === 'desc' ? desc(currencyIndexes.date) : asc(currencyIndexes.date));

            console.log(`Query successful, returning data for ${dates.length} dates out of ${totalDates} total dates`);
            return {
                data: result,
                total: totalDates
            };
        } catch (error) {
            console.error('Error in getHistoricalIndexesByDates:', error);
            throw error;
        }
    }

   async getAllRelations() {
        return this.db.db.select().from(currenciesRelations);
    }
}