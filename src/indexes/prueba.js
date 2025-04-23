// const monedas = [
//     { id: 1, name: "Dolar 2000", symbol: "US2000" },
//     { id: 2, name: "Dolar Libre", symbol: "U$" },
//     { id: 3, name: "Peso", symbol: "$" },
//     { id: 4, name: "Dolar Venta", symbol: "U$" },
//     { id: 5, name: "Dolar Compra", symbol: "U$" },
//     { id: 6, name: "Dolar MEP Venta", symbol: "MEP" },
//     { id: 7, name: "Dolar MEP Compra", symbol: "MEP" },
//     { id: 8, name: "Dolar MEP", symbol: "MEP" },
//     { id: 9, name: "Dolar Oficial Venta", symbol: "OFICIAL" },
//     // { id: 10, name: "Dolar Oficial Compra", symbol: "OFICIAL" },
//     // { id: 11, name: "Dolar Oficial", symbol: "OFICIAL" },
//     // { id: 12, name: "CAC", symbol: "CAC" },
//     // { id: 13, name: "UVA", symbol: "UVA" }
// ];
// const relacionesMonedas = monedas
//     .map((x, i) => ({ id: i + 1, divisorId: i == 2 ? 1 : i + 1, dividendoId: 3 }))
//     .slice(0, monedas.length - 1);
// //console.log({ relacionesMonedas });
// const indices = relacionesMonedas
//     .map((r, i) => ['2025-04-21', '2025-04-22', '2025-04-23', '2025-04-24', '2025-04-25']
//         .map((d, j) => ({ relacionId: r.id, fecha: d, id: (i + 1) * (j + 1), value: i * 100 + j + 1 }))
//     ).flat();
// const posiblePaths = relacionesMonedas.reduce((p, r) => {
//     const getAllPosiblePaths = (chain) => {
//         let lastNode = chain[chain.length - 1]
//         // console.log({ chain });
//         // console.log({ lastNode });
//         let posibleNodes = relacionesMonedas
//             .filter(x => !chain.find(y => y.dividendoId === x.dividendoId && y.divisorId === x.divisorId));
//         //console.log({ posibleNodes1: posibleNodes });
//         posibleNodes = posibleNodes
//             .filter(x => [lastNode.divisorId, lastNode.dividendoId].includes(x.dividendoId) || [lastNode.divisorId, lastNode.dividendoId].includes(x.divisorId));
//         //console.log({ posibleNodes2: posibleNodes });
//         if (posibleNodes.length === 0) {
//             //console.log({ COMPLETED: [chain] });
//             return [chain]
//         } else {
//             let paths = []
//             for (let i = 0; i < posibleNodes.length; i++) {
//                 let newChain = [...chain, posibleNodes[i]]
//                 paths.push(...getAllPosiblePaths(newChain))
//             }
//             return paths;
//         }
//     };
//     p[r.id] = getAllPosiblePaths([{ ...r }]);
//     return p;
// }, {});
// //getAllPosiblePaths([relacionesMonedas[0]]);
// const convertValue = (value, from, to, constantUnit) => {
//     const findPath = (fromId, toId) => {
//         const path = posiblePaths[fromId].find(arr => arr.some(x => x.dividendoId === toId || x.divisorId === toId));
//         const subPath = path.reduce((p, x) => {
//             if (!p.some(x => x.dividendoId === toId || x.divisorId === toId)) {
//                 p.push(x)
//             };
//             return p;
//         }, []);
//         return subPath;
//     };
//     const toUnit = (fromId, toId, indexes, path, amount) => {
//         const removeRedundants = (path) => {
//             const isRedundant = (path) => path.some((x, i) => {
//                 path.some((y, j) => j > i + 1 && [x.divisorId, x.dividendoId].includes(y.dividendoId) ||
//                     [x.divisorId, x.dividendoId].includes(y.divisorId))
//             });
//             const doCleanUp = (path) => {
//             };
//             while (isRedundant(path)) {
//                 path = doCleanUp(path);
//             }
//             return path;
//         };
//         let path = removeRedundants(path);
//         let res = amount;
//         let lastId = fromId;
//         console.log({ fromId, toId, indexes, path, amount });
//         for (let i = 0; i < path.length; i++) {
//             let currentNode = path[i];
//             let coef = indexes.find(x => x.relacionId === currentNode.id).value;
//             console.log({ res, lastId, currentNode, coef });
//             if (currentNode.dividendoId === lastId) {
//                 res = res * coef;
//                 lastId = currentNode.divisorId;
//             } else {
//                 res = res / coef;
//                 lastId = currentNode.dividendoId;
//             }
//         };
//         return res;
//     };
//     const fromIndexes = indices.filter(x => x.fecha === from.fecha);
//     const toIndexes = indices.filter(x => x.fecha === to.fecha);
//     const fromConstantPath = findPath(from.monedaId, constantUnit);
//     const constantUnitAmount = toUnit(from.monedaId, constantUnit, fromIndexes, fromConstantPath, value);
//     const toConstantPath = findPath(constantUnit, to.monedaId);
//     const res = toUnit(constantUnit, to.monedaId, toIndexes, toConstantPath, constantUnitAmount);
//     //console.log({ value, from, to, fromIndexes, toIndexes, constantUnit, fromConstantPath, toConstantPath, constantUnitAmount, res });
//     return res;
// };
// //console.log(JSON.stringify(posiblePaths, null, 2));
// console.log(convertValue(100, { monedaId: 2, fecha: '2025-04-21' }, { monedaId: 6, fecha: '2025-04-22' }, 1));
// //X (USD), Y, (EURO), Z (ARS), W (CAC), V (UVA)
// //Relaciones: X/Y, Y/Z, Z/W, W/V
// //Indicie
// //F({monedaId, fecha}: from, {monedaId, fecha}: to, amount: number, baseUnit?: monedaId) => {
// // 1) Convertimos de from a la moneda baseUnit de la fecha de from
// // 2) Convertimos de baseUnit a la moneda baseUnit de la fecha de to
// //}const monedas = [
//     { id: 1, name: "Dolar 2000", symbol: "US2000" },
//     { id: 2, name: "Dolar Libre", symbol: "U$" },
//     { id: 3, name: "Peso", symbol: "$" },
//     { id: 4, name: "Dolar Venta", symbol: "U$" },
//     { id: 5, name: "Dolar Compra", symbol: "U$" },
//     { id: 6, name: "Dolar MEP Venta", symbol: "MEP" },
//     { id: 7, name: "Dolar MEP Compra", symbol: "MEP" },
//     { id: 8, name: "Dolar MEP", symbol: "MEP" },
//     { id: 9, name: "Dolar Oficial Venta", symbol: "OFICIAL" },
//     // { id: 10, name: "Dolar Oficial Compra", symbol: "OFICIAL" },
//     // { id: 11, name: "Dolar Oficial", symbol: "OFICIAL" },
//     // { id: 12, name: "CAC", symbol: "CAC" },
//     // { id: 13, name: "UVA", symbol: "UVA" }
// ];
// const relacionesMonedas = monedas
//     .map((x, i) => ({ id: i + 1, divisorId: i == 2 ? 1 : i + 1, dividendoId: 3 }))
//     .slice(0, monedas.length - 1);
// //console.log({ relacionesMonedas });
// const indices = relacionesMonedas
//     .map((r, i) => ['2025-04-21', '2025-04-22', '2025-04-23', '2025-04-24', '2025-04-25']
//         .map((d, j) => ({ relacionId: r.id, fecha: d, id: (i + 1) * (j + 1), value: i * 100 + j + 1 }))
//     ).flat();
// const posiblePaths = relacionesMonedas.reduce((p, r) => {
//     const getAllPosiblePaths = (chain) => {
//         let lastNode = chain[chain.length - 1]
//         // console.log({ chain });
//         // console.log({ lastNode });
//         let posibleNodes = relacionesMonedas
//             .filter(x => !chain.find(y => y.dividendoId === x.dividendoId && y.divisorId === x.divisorId));
//         //console.log({ posibleNodes1: posibleNodes });
//         posibleNodes = posibleNodes
//             .filter(x => [lastNode.divisorId, lastNode.dividendoId].includes(x.dividendoId) || [lastNode.divisorId, lastNode.dividendoId].includes(x.divisorId));
//         //console.log({ posibleNodes2: posibleNodes });
//         if (posibleNodes.length === 0) {
//             //console.log({ COMPLETED: [chain] });
//             return [chain]
//         } else {
//             let paths = []
//             for (let i = 0; i < posibleNodes.length; i++) {
//                 let newChain = [...chain, posibleNodes[i]]
//                 paths.push(...getAllPosiblePaths(newChain))
//             }
//             return paths;
//         }
//     };
//     p[r.id] = getAllPosiblePaths([{ ...r }]);
//     // return p;
// }, {});
// //getAllPosiblePaths([relacionesMonedas[0]]);
// const convertValue = (value, from, to, constantUnit) => {
//     const findPath = (fromId, toId) => {
//         const path = posiblePaths[fromId].find(arr => arr.some(x => x.dividendoId === toId || x.divisorId === toId));
//         const subPath = path.reduce((p, x) => {
//             if (!p.some(x => x.dividendoId === toId || x.divisorId === toId)) {
//                 p.push(x)
//             };
//             return p;
//         }, []);
//         return subPath;
//     };
//     const toUnit = (fromId, toId, indexes, path, amount) => {
//         const removeRedundants = (path) => {
//             const isRedundant = (path) => path.some((x, i) => {
//                 path.some((y, j) => j > i + 1 && [x.divisorId, x.dividendoId].includes(y.dividendoId) ||
//                     [x.divisorId, x.dividendoId].includes(y.divisorId))
//             });
//             const doCleanUp = (path) => {
//             };
//             while (isRedundant(path)) {
//                 path = doCleanUp(path);
//             }
//             return path;
//         };
//         let path = removeRedundants(path);
//         let res = amount;
//         let lastId = fromId;
//         console.log({ fromId, toId, indexes, path, amount });
//         for (let i = 0; i < path.length; i++) {
//             let currentNode = path[i];
//             let coef = indexes.find(x => x.relacionId === currentNode.id).value;
//             console.log({ res, lastId, currentNode, coef });
//             if (currentNode.dividendoId === lastId) {
//                 res = res * coef;
//                 lastId = currentNode.divisorId;
//             } else {
//                 res = res / coef;
//                 lastId = currentNode.dividendoId;
//             }
//         };
//         return res;
//     };
//     const fromIndexes = indices.filter(x => x.fecha === from.fecha);
//     const toIndexes = indices.filter(x => x.fecha === to.fecha);
//     const fromConstantPath = findPath(from.monedaId, constantUnit);
//     const constantUnitAmount = toUnit(from.monedaId, constantUnit, fromIndexes, fromConstantPath, value);
//     const toConstantPath = findPath(constantUnit, to.monedaId);
//     const res = toUnit(constantUnit, to.monedaId, toIndexes, toConstantPath, constantUnitAmount);
//     //console.log({ value, from, to, fromIndexes, toIndexes, constantUnit, fromConstantPath, toConstantPath, constantUnitAmount, res });
//     return res;
// };
// //console.log(JSON.stringify(posiblePaths, null, 2));
// console.log(convertValue(100, { monedaId: 2, fecha: '2025-04-21' }, { monedaId: 6, fecha: '2025-04-22' }, 1));
// //X (USD), Y, (EURO), Z (ARS), W (CAC), V (UVA)
// //Relaciones: X/Y, Y/Z, Z/W, W/V
// //Indicie
// //F({monedaId, fecha}: from, {monedaId, fecha}: to, amount: number, baseUnit?: monedaId) => {
// // 1) Convertimos de from a la moneda baseUnit de la fecha de from
// // 2) Convertimos de baseUnit a la moneda baseUnit de la fecha de to
// //}