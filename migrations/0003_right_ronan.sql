ALTER TABLE "currencies" DROP CONSTRAINT "currencies_ref_currencies_id_fk";
--> statement-breakpoint
ALTER TABLE "indexes" DROP CONSTRAINT "indexes_currency_currencies_id_fk";
--> statement-breakpoint
ALTER TABLE "indexes" ADD COLUMN "divisorId" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "indexes" ADD COLUMN "dividendoId" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "indexes" ADD CONSTRAINT "indexes_divisorId_currencies_id_fk" FOREIGN KEY ("divisorId") REFERENCES "public"."currencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indexes" ADD CONSTRAINT "indexes_dividendoId_currencies_id_fk" FOREIGN KEY ("dividendoId") REFERENCES "public"."currencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "currencies" DROP COLUMN "ref";--> statement-breakpoint
ALTER TABLE "indexes" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "indexes" DROP COLUMN "currency";