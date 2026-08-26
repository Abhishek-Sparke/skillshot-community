CREATE INDEX `idx_comments_post_created` ON `comments` (`post_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_posts_created_at` ON `posts` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_posts_user_id` ON `posts` (`user_id`);