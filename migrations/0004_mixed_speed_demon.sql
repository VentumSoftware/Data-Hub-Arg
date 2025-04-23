CREATE TABLE "relationsCurrencies" (
	"id" serial PRIMARY KEY NOT NULL,
	"divisorId" integer NOT NULL,
	"dividendoId" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "indexes" DROP CONSTRAINT "indexes_divisorId_currencies_id_fk";
--> statement-breakpoint
ALTER TABLE "indexes" DROP CONSTRAINT "indexes_dividendoId_currencies_id_fk";
--> statement-breakpoint
ALTER TABLE "indexes" ADD COLUMN "relationsCurrencies" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "relationsCurrencies" ADD CONSTRAINT "relationsCurrencies_divisorId_currencies_id_fk" FOREIGN KEY ("divisorId") REFERENCES "public"."currencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationsCurrencies" ADD CONSTRAINT "relationsCurrencies_dividendoId_currencies_id_fk" FOREIGN KEY ("dividendoId") REFERENCES "public"."currencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indexes" ADD CONSTRAINT "indexes_relationsCurrencies_relationsCurrencies_id_fk" FOREIGN KEY ("relationsCurrencies") REFERENCES "public"."relationsCurrencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indexes" DROP COLUMN "divisorId";--> statement-breakpoint
ALTER TABLE "indexes" DROP COLUMN "dividendoId";