CREATE TABLE `journal` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`journalDate` timestamp NOT NULL,
	`content` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `journal_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`symbol` varchar(20) NOT NULL,
	`direction` enum('long','short') NOT NULL,
	`entryPrice` varchar(32) NOT NULL,
	`exitPrice` varchar(32) NOT NULL,
	`quantity` varchar(32) NOT NULL,
	`fees` varchar(32) NOT NULL DEFAULT '0',
	`pnl` varchar(32) NOT NULL,
	`tradeDate` timestamp NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trades_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `journal` ADD CONSTRAINT `journal_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trades` ADD CONSTRAINT `trades_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;