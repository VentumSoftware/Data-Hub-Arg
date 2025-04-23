import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { db } from '../drizzle';
import { currencies, indexes, relationsCurrencies } from '../drizzle/schema';
import { Currency, Index, RelationsCurrencies } from '../drizzle/schema';
import * as fs from 'fs';

type IndexWithDateParsed = Index & { parsedDate: Date };
type IndexWithPaths = IndexWithDateParsed & { paths: IndexWithDateParsed[][] };

@Injectable()
export class IndexesCacheService implements OnModuleInit {
    private readonly logger = new Logger(IndexesCacheService.name);
    private cachedPaths: Record<number, RelationsCurrencies[][]> = {};


    async onModuleInit() {
        this.logger.log('🔁 Inicializando IndexesCacheService...');
        this.cachedPaths = await this.getPathsByCurrency();
        this.logger.log(`✅ Cache precargado con ${Object.keys(this.cachedPaths).length} índices con rutas`);
    }

    getCachedPaths(): Record<number, RelationsCurrencies[][]> {
        return this.cachedPaths;
    }

    private parseDate(dateStr: string): Date {
        const [month, year] = dateStr.split('-').map(Number);
        return new Date(year, month - 1);
    }

    private async getPathsByCurrency(): Promise<Record<number, RelationsCurrencies[][]>> {
        const relationsCurrencyData: RelationsCurrencies[] = (await db.select().from(relationsCurrencies)).filter((x,i) => i < 11); // Limitar a 1000 registros para pruebas
    
        const posiblePaths = relationsCurrencyData.reduce((p, r) => {
            const cleanUpPaths = (paths: RelationsCurrencies[][]) => {
                const seen = new Set<string>();
            
                const uniquePaths = paths.filter(path => {
                    const idsSorted = path.map(x => x.id).sort((a, b) => a - b).join(',');
                    if (seen.has(idsSorted)) {
                        return false;
                    }
                    seen.add(idsSorted);
                    return true;
                });
            
                return uniquePaths;
            }
            const getAllPosiblePaths = (chain) => {
                let lastNode = chain[chain.length - 1];
                let posibleNodes = relationsCurrencyData
                    .filter(x => !chain.find(y => y.dividendoId === x.dividendoId && y.divisorId === x.divisorId));
                posibleNodes = posibleNodes
                    .filter(x =>
                        [lastNode.divisorId, lastNode.dividendoId].includes(x.dividendoId) ||
                        [lastNode.divisorId, lastNode.dividendoId].includes(x.divisorId)
                    );
                if (posibleNodes.length === 0) {
                    return [chain];
                } else {
                    let paths = [];
                    for (let i = 0; i < posibleNodes.length; i++) {
                        let newChain = [...chain, posibleNodes[i]];
                        paths.push(...getAllPosiblePaths(newChain));
                    }
                    return paths;
                }
            };
            p[r.id] = cleanUpPaths(getAllPosiblePaths([{ ...r }]));
            return p;
        }, {} as Record<number, RelationsCurrencies[][]>);
    
        const debug = { posiblePaths, relationsCurrencyData };
        fs.writeFileSync("allPaths.json", JSON.stringify(debug, null, 2));
    
        return posiblePaths;
    }
    
}
