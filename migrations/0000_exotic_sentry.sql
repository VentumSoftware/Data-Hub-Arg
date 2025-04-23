CREATE TABLE "currencies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"symbol" varchar,
	CONSTRAINT "currencies_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "indexes" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" varchar(255) NOT NULL,
	"currency" integer NOT NULL,
	"value" real NOT NULL
);
--> statement-breakpoint
ALTER TABLE "indexes" ADD CONSTRAINT "indexes_currency_currencies_id_fk" FOREIGN KEY ("currency") REFERENCES "public"."currencies"("id") ON DELETE cascade ON UPDATE no action;