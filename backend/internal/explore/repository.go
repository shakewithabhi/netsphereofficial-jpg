package explore

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// postColumns are the columns selected when reading a post with joins.
const postColumns = `
	p.id, p.user_id, p.file_id, p.caption, p.category,
	COALESCE(p.tags, '{}'), p.view_count, p.like_count, p.comment_count,
	p.duration_seconds, p.status, p.created_at, p.updated_at,
	COALESCE(u.display_name, ''), UPPER(LEFT(COALESCE(u.display_name, ''), 1)),
	COALESCE(u.avatar_key, ''),
	COALESCE(f.name, ''), COALESCE(f.mime_type, ''), COALESCE(f.size, 0),
	COALESCE(f.storage_key, ''), COALESCE(f.thumbnail_key, '')`

func scanPost(row pgx.Row, p *Post) error {
	return row.Scan(
		&p.ID, &p.UserID, &p.FileID, &p.Caption, &p.Category,
		&p.Tags, &p.ViewCount, &p.LikeCount, &p.CommentCount,
		&p.DurationSeconds, &p.Status, &p.CreatedAt, &p.UpdatedAt,
		&p.UserName, &p.UserAvatarInitial, &p.UserAvatarKey,
		&p.FileName, &p.FileMimeType, &p.FileSize,
		&p.FileStorageKey, &p.FileThumbnailKey,
	)
}

func scanPostRows(rows pgx.Rows) ([]Post, error) {
	var posts []Post
	for rows.Next() {
		var p Post
		if err := rows.Scan(
			&p.ID, &p.UserID, &p.FileID, &p.Caption, &p.Category,
			&p.Tags, &p.ViewCount, &p.LikeCount, &p.CommentCount,
			&p.DurationSeconds, &p.Status, &p.CreatedAt, &p.UpdatedAt,
			&p.UserName, &p.UserAvatarInitial, &p.UserAvatarKey,
			&p.FileName, &p.FileMimeType, &p.FileSize,
			&p.FileStorageKey, &p.FileThumbnailKey,
		); err != nil {
			return nil, fmt.Errorf("scan post: %w", err)
		}
		posts = append(posts, p)
	}
	return posts, nil
}

// enrichViewerFields adds is_liked and is_subscribed for the viewer.
func (r *Repository) enrichViewerFields(ctx context.Context, posts []Post, viewerID uuid.UUID) error {
	if viewerID == uuid.Nil || len(posts) == 0 {
		return nil
	}

	postIDs := make([]uuid.UUID, len(posts))
	creatorIDs := make([]uuid.UUID, 0, len(posts))
	creatorSet := map[uuid.UUID]bool{}
	for i, p := range posts {
		postIDs[i] = p.ID
		if !creatorSet[p.UserID] {
			creatorSet[p.UserID] = true
			creatorIDs = append(creatorIDs, p.UserID)
		}
	}

	// Liked posts
	likedRows, err := r.db.Query(ctx,
		`SELECT post_id FROM post_likes WHERE user_id = $1 AND post_id = ANY($2)`,
		viewerID, postIDs)
	if err != nil {
		return fmt.Errorf("check likes: %w", err)
	}
	defer likedRows.Close()

	likedSet := map[uuid.UUID]bool{}
	for likedRows.Next() {
		var pid uuid.UUID
		if err := likedRows.Scan(&pid); err != nil {
			return fmt.Errorf("scan liked: %w", err)
		}
		likedSet[pid] = true
	}

	// Subscribed creators
	subRows, err := r.db.Query(ctx,
		`SELECT creator_id FROM follows WHERE subscriber_id = $1 AND creator_id = ANY($2)`,
		viewerID, creatorIDs)
	if err != nil {
		return fmt.Errorf("check subs: %w", err)
	}
	defer subRows.Close()

	subSet := map[uuid.UUID]bool{}
	for subRows.Next() {
		var cid uuid.UUID
		if err := subRows.Scan(&cid); err != nil {
			return fmt.Errorf("scan sub: %w", err)
		}
		subSet[cid] = true
	}

	// Subscriber counts
	countRows, err := r.db.Query(ctx,
		`SELECT creator_id, COUNT(*) FROM follows WHERE creator_id = ANY($1) GROUP BY creator_id`,
		creatorIDs)
	if err != nil {
		return fmt.Errorf("sub counts: %w", err)
	}
	defer countRows.Close()

	subCounts := map[uuid.UUID]int64{}
	for countRows.Next() {
		var cid uuid.UUID
		var cnt int64
		if err := countRows.Scan(&cid, &cnt); err != nil {
			return fmt.Errorf("scan sub count: %w", err)
		}
		subCounts[cid] = cnt
	}

	for i := range posts {
		posts[i].IsLiked = likedSet[posts[i].ID]
		posts[i].IsSubscribed = subSet[posts[i].UserID]
		posts[i].SubscriberCount = subCounts[posts[i].UserID]
	}

	return nil
}

// Create inserts a new post.
func (r *Repository) Create(ctx context.Context, post *Post) error {
	err := r.db.QueryRow(ctx, `
		INSERT INTO posts (user_id, file_id, caption, category, tags, duration_seconds, status)
		VALUES ($1, $2, $3, $4, $5, $6, 'active')
		RETURNING id, created_at, updated_at`,
		post.UserID, post.FileID, post.Caption, post.Category, post.Tags, post.DurationSeconds,
	).Scan(&post.ID, &post.CreatedAt, &post.UpdatedAt)
	if err != nil {
		return fmt.Errorf("create post: %w", err)
	}
	return nil
}

// GetByID returns a post by ID with viewer-specific fields.
func (r *Repository) GetByID(ctx context.Context, id, viewerUserID uuid.UUID) (*Post, error) {
	query := fmt.Sprintf(`
		SELECT %s
		FROM posts p
		JOIN users u ON u.id = p.user_id
		LEFT JOIN files f ON f.id = p.file_id
		WHERE p.id = $1`, postColumns)

	var p Post
	if err := scanPost(r.db.QueryRow(ctx, query, id), &p); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get post: %w", err)
	}

	if viewerUserID != uuid.Nil {
		posts := []Post{p}
		if err := r.enrichViewerFields(ctx, posts, viewerUserID); err != nil {
			return nil, err
		}
		p = posts[0]
	} else {
		// Still get subscriber count
		_ = r.db.QueryRow(ctx,
			`SELECT COUNT(*) FROM follows WHERE creator_id = $1`, p.UserID,
		).Scan(&p.SubscriberCount)
	}

	return &p, nil
}

// Delete removes a post owned by userID.
func (r *Repository) Delete(ctx context.Context, id, userID uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM posts WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return fmt.Errorf("delete post: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("post not found or not owned by user")
	}
	return nil
}

// GetFeed returns a paginated feed of active posts.
func (r *Repository) GetFeed(ctx context.Context, params FeedParams, viewerUserID uuid.UUID) ([]Post, bool, error) {
	query := fmt.Sprintf(`
		SELECT %s
		FROM posts p
		JOIN users u ON u.id = p.user_id
		LEFT JOIN files f ON f.id = p.file_id
		WHERE p.status = 'active'`, postColumns)

	args := make([]any, 0, 4)
	argIdx := 1

	if params.Category != "" {
		query += fmt.Sprintf(` AND p.category = $%d`, argIdx)
		args = append(args, params.Category)
		argIdx++
	}
	if params.Tag != "" {
		query += fmt.Sprintf(` AND $%d = ANY(p.tags)`, argIdx)
		args = append(args, params.Tag)
		argIdx++
	}
	if params.Cursor != "" {
		query += fmt.Sprintf(` AND p.created_at < $%d`, argIdx)
		args = append(args, params.Cursor)
		argIdx++
	}

	switch params.Sort {
	case "popular":
		query += ` ORDER BY p.like_count DESC, p.created_at DESC`
	case "trending":
		query += ` AND p.created_at >= NOW() - INTERVAL '48 hours'
		           ORDER BY (p.like_count * 2 + p.view_count) DESC, p.created_at DESC`
	default:
		query += ` ORDER BY p.created_at DESC`
	}

	limit := params.Limit + 1
	query += fmt.Sprintf(` LIMIT $%d`, argIdx)
	args = append(args, limit)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, false, fmt.Errorf("get feed: %w", err)
	}
	defer rows.Close()

	posts, err := scanPostRows(rows)
	if err != nil {
		return nil, false, err
	}

	hasMore := len(posts) > params.Limit
	if hasMore {
		posts = posts[:params.Limit]
	}

	if err := r.enrichViewerFields(ctx, posts, viewerUserID); err != nil {
		return nil, false, err
	}

	return posts, hasMore, nil
}

// GetTrendingFeed returns trending posts from the last 48 hours.
func (r *Repository) GetTrendingFeed(ctx context.Context, limit int, viewerUserID uuid.UUID) ([]Post, error) {
	query := fmt.Sprintf(`
		SELECT %s
		FROM posts p
		JOIN users u ON u.id = p.user_id
		LEFT JOIN files f ON f.id = p.file_id
		WHERE p.status = 'active' AND p.created_at >= NOW() - INTERVAL '48 hours'
		ORDER BY (p.like_count * 2 + p.view_count) DESC
		LIMIT $1`, postColumns)

	rows, err := r.db.Query(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("trending feed: %w", err)
	}
	defer rows.Close()

	posts, err := scanPostRows(rows)
	if err != nil {
		return nil, err
	}

	if err := r.enrichViewerFields(ctx, posts, viewerUserID); err != nil {
		return nil, err
	}

	return posts, nil
}

// GetForYouFeed returns a personalized feed blending subscribed creators (40%),
// watched categories (30%), and popular overall (30%).
func (r *Repository) GetForYouFeed(ctx context.Context, userID uuid.UUID, limit int) ([]Post, error) {
	subLimit := int(float64(limit) * 0.4)
	if subLimit < 1 {
		subLimit = 1
	}
	catLimit := int(float64(limit) * 0.3)
	if catLimit < 1 {
		catLimit = 1
	}
	popLimit := limit - subLimit - catLimit
	if popLimit < 1 {
		popLimit = 1
	}

	// 1. Posts from subscribed creators
	subQuery := fmt.Sprintf(`
		SELECT %s
		FROM posts p
		JOIN users u ON u.id = p.user_id
		LEFT JOIN files f ON f.id = p.file_id
		WHERE p.status = 'active'
		  AND p.user_id IN (SELECT creator_id FROM follows WHERE subscriber_id = $1)
		ORDER BY p.created_at DESC
		LIMIT $2`, postColumns)

	subRows, err := r.db.Query(ctx, subQuery, userID, subLimit)
	if err != nil {
		return nil, fmt.Errorf("foryou sub: %w", err)
	}
	defer subRows.Close()
	subPosts, err := scanPostRows(subRows)
	if err != nil {
		return nil, err
	}

	// 2. Posts in categories user has watched most
	catQuery := fmt.Sprintf(`
		SELECT %s
		FROM posts p
		JOIN users u ON u.id = p.user_id
		LEFT JOIN files f ON f.id = p.file_id
		WHERE p.status = 'active'
		  AND p.category IN (
		      SELECT p2.category FROM watch_history wh
		      JOIN posts p2 ON p2.id = wh.post_id
		      WHERE wh.user_id = $1
		      GROUP BY p2.category
		      ORDER BY COUNT(*) DESC
		      LIMIT 3
		  )
		  AND p.user_id != $1
		ORDER BY p.created_at DESC
		LIMIT $2`, postColumns)

	catRows, err := r.db.Query(ctx, catQuery, userID, catLimit)
	if err != nil {
		return nil, fmt.Errorf("foryou cat: %w", err)
	}
	defer catRows.Close()
	catPosts, err := scanPostRows(catRows)
	if err != nil {
		return nil, err
	}

	// 3. Popular overall
	popQuery := fmt.Sprintf(`
		SELECT %s
		FROM posts p
		JOIN users u ON u.id = p.user_id
		LEFT JOIN files f ON f.id = p.file_id
		WHERE p.status = 'active'
		ORDER BY (p.like_count * 2 + p.view_count) DESC
		LIMIT $1`, postColumns)

	popRows, err := r.db.Query(ctx, popQuery, popLimit)
	if err != nil {
		return nil, fmt.Errorf("foryou pop: %w", err)
	}
	defer popRows.Close()
	popPosts, err := scanPostRows(popRows)
	if err != nil {
		return nil, err
	}

	// Merge and deduplicate
	seen := map[uuid.UUID]bool{}
	var result []Post
	for _, batch := range [][]Post{subPosts, catPosts, popPosts} {
		for _, p := range batch {
			if !seen[p.ID] {
				seen[p.ID] = true
				result = append(result, p)
			}
		}
	}

	if len(result) > limit {
		result = result[:limit]
	}

	if err := r.enrichViewerFields(ctx, result, userID); err != nil {
		return nil, err
	}

	return result, nil
}

// GetSubscriptionFeed returns posts from subscribed creators only.
func (r *Repository) GetSubscriptionFeed(ctx context.Context, userID uuid.UUID, limit int, cursor string) ([]Post, bool, error) {
	query := fmt.Sprintf(`
		SELECT %s
		FROM posts p
		JOIN users u ON u.id = p.user_id
		LEFT JOIN files f ON f.id = p.file_id
		WHERE p.status = 'active'
		  AND p.user_id IN (SELECT creator_id FROM follows WHERE subscriber_id = $1)`, postColumns)

	args := []any{userID}
	argIdx := 2

	if cursor != "" {
		query += fmt.Sprintf(` AND p.created_at < $%d`, argIdx)
		args = append(args, cursor)
		argIdx++
	}

	query += ` ORDER BY p.created_at DESC`
	query += fmt.Sprintf(` LIMIT $%d`, argIdx)
	args = append(args, limit+1)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, false, fmt.Errorf("sub feed: %w", err)
	}
	defer rows.Close()

	posts, err := scanPostRows(rows)
	if err != nil {
		return nil, false, err
	}

	hasMore := len(posts) > limit
	if hasMore {
		posts = posts[:limit]
	}

	if err := r.enrichViewerFields(ctx, posts, userID); err != nil {
		return nil, false, err
	}

	return posts, hasMore, nil
}

// GetRelatedPosts returns posts in the same category or with overlapping tags.
func (r *Repository) GetRelatedPosts(ctx context.Context, postID uuid.UUID, limit int, viewerUserID uuid.UUID) ([]Post, error) {
	// Get the source post's category and tags
	var category string
	var tags []string
	err := r.db.QueryRow(ctx,
		`SELECT category, COALESCE(tags, '{}') FROM posts WHERE id = $1`, postID,
	).Scan(&category, &tags)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get source post: %w", err)
	}

	query := fmt.Sprintf(`
		SELECT %s
		FROM posts p
		JOIN users u ON u.id = p.user_id
		LEFT JOIN files f ON f.id = p.file_id
		WHERE p.status = 'active'
		  AND p.id != $1
		  AND (p.category = $2 OR p.tags && $3)
		ORDER BY p.like_count DESC, p.created_at DESC
		LIMIT $4`, postColumns)

	rows, err := r.db.Query(ctx, query, postID, category, tags, limit)
	if err != nil {
		return nil, fmt.Errorf("related posts: %w", err)
	}
	defer rows.Close()

	posts, err := scanPostRows(rows)
	if err != nil {
		return nil, err
	}

	if err := r.enrichViewerFields(ctx, posts, viewerUserID); err != nil {
		return nil, err
	}

	return posts, nil
}

// GetUserPosts returns posts by a specific user.
func (r *Repository) GetUserPosts(ctx context.Context, userID uuid.UUID, limit int, viewerUserID uuid.UUID) ([]Post, error) {
	query := fmt.Sprintf(`
		SELECT %s
		FROM posts p
		JOIN users u ON u.id = p.user_id
		LEFT JOIN files f ON f.id = p.file_id
		WHERE p.status = 'active' AND p.user_id = $1
		ORDER BY p.created_at DESC
		LIMIT $2`, postColumns)

	rows, err := r.db.Query(ctx, query, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("user posts: %w", err)
	}
	defer rows.Close()

	posts, err := scanPostRows(rows)
	if err != nil {
		return nil, err
	}

	if err := r.enrichViewerFields(ctx, posts, viewerUserID); err != nil {
		return nil, err
	}

	return posts, nil
}

// LikePost adds a like.
func (r *Repository) LikePost(ctx context.Context, postID, userID uuid.UUID) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx,
		`INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		postID, userID)
	if err != nil {
		return fmt.Errorf("insert like: %w", err)
	}

	_, err = tx.Exec(ctx,
		`UPDATE posts SET like_count = (SELECT COUNT(*) FROM post_likes WHERE post_id = $1) WHERE id = $1`,
		postID)
	if err != nil {
		return fmt.Errorf("update like count: %w", err)
	}

	return tx.Commit(ctx)
}

// UnlikePost removes a like.
func (r *Repository) UnlikePost(ctx context.Context, postID, userID uuid.UUID) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx,
		`DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2`,
		postID, userID)
	if err != nil {
		return fmt.Errorf("delete like: %w", err)
	}

	_, err = tx.Exec(ctx,
		`UPDATE posts SET like_count = (SELECT COUNT(*) FROM post_likes WHERE post_id = $1) WHERE id = $1`,
		postID)
	if err != nil {
		return fmt.Errorf("update like count: %w", err)
	}

	return tx.Commit(ctx)
}

// AddComment inserts a comment and increments comment_count.
func (r *Repository) AddComment(ctx context.Context, comment *PostComment) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	err = tx.QueryRow(ctx,
		`INSERT INTO post_comments (post_id, user_id, content) VALUES ($1, $2, $3) RETURNING id, created_at`,
		comment.PostID, comment.UserID, comment.Content,
	).Scan(&comment.ID, &comment.CreatedAt)
	if err != nil {
		return fmt.Errorf("insert comment: %w", err)
	}

	_, err = tx.Exec(ctx,
		`UPDATE posts SET comment_count = (SELECT COUNT(*) FROM post_comments WHERE post_id = $1) WHERE id = $1`,
		comment.PostID)
	if err != nil {
		return fmt.Errorf("update comment count: %w", err)
	}

	return tx.Commit(ctx)
}

// ListComments returns comments for a post, sorted by created_at.
func (r *Repository) ListComments(ctx context.Context, postID uuid.UUID, limit int) ([]PostComment, error) {
	rows, err := r.db.Query(ctx, `
		SELECT c.id, c.post_id, c.user_id, c.content, c.like_count, c.created_at,
		       u.display_name, UPPER(LEFT(u.display_name, 1))
		FROM post_comments c
		JOIN users u ON u.id = c.user_id
		WHERE c.post_id = $1
		ORDER BY c.created_at ASC
		LIMIT $2`, postID, limit)
	if err != nil {
		return nil, fmt.Errorf("list comments: %w", err)
	}
	defer rows.Close()

	var comments []PostComment
	for rows.Next() {
		var c PostComment
		if err := rows.Scan(
			&c.ID, &c.PostID, &c.UserID, &c.Content, &c.LikeCount, &c.CreatedAt,
			&c.UserName, &c.UserAvatarInitial,
		); err != nil {
			return nil, fmt.Errorf("scan comment: %w", err)
		}
		comments = append(comments, c)
	}

	return comments, nil
}

// DeleteComment removes a comment owned by userID and updates comment_count.
func (r *Repository) DeleteComment(ctx context.Context, commentID, userID uuid.UUID) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var postID uuid.UUID
	err = tx.QueryRow(ctx,
		`DELETE FROM post_comments WHERE id = $1 AND user_id = $2 RETURNING post_id`,
		commentID, userID,
	).Scan(&postID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("comment not found or not owned by user")
		}
		return fmt.Errorf("delete comment: %w", err)
	}

	_, err = tx.Exec(ctx,
		`UPDATE posts SET comment_count = (SELECT COUNT(*) FROM post_comments WHERE post_id = $1) WHERE id = $1`,
		postID)
	if err != nil {
		return fmt.Errorf("update comment count: %w", err)
	}

	return tx.Commit(ctx)
}

// Subscribe adds a subscription.
func (r *Repository) Subscribe(ctx context.Context, subscriberID, creatorID uuid.UUID) error {
	if subscriberID == creatorID {
		return fmt.Errorf("cannot subscribe to yourself")
	}
	_, err := r.db.Exec(ctx,
		`INSERT INTO follows (subscriber_id, creator_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		subscriberID, creatorID)
	if err != nil {
		return fmt.Errorf("subscribe: %w", err)
	}
	return nil
}

// Unsubscribe removes a subscription.
func (r *Repository) Unsubscribe(ctx context.Context, subscriberID, creatorID uuid.UUID) error {
	_, err := r.db.Exec(ctx,
		`DELETE FROM follows WHERE subscriber_id = $1 AND creator_id = $2`,
		subscriberID, creatorID)
	if err != nil {
		return fmt.Errorf("unsubscribe: %w", err)
	}
	return nil
}

// GetSubscriberCount returns the subscriber count for a creator.
func (r *Repository) GetSubscriberCount(ctx context.Context, creatorID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM follows WHERE creator_id = $1`, creatorID,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("subscriber count: %w", err)
	}
	return count, nil
}

// IsSubscribed checks if subscriberID follows creatorID.
func (r *Repository) IsSubscribed(ctx context.Context, subscriberID, creatorID uuid.UUID) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM follows WHERE subscriber_id = $1 AND creator_id = $2)`,
		subscriberID, creatorID,
	).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("is subscribed: %w", err)
	}
	return exists, nil
}

// RecordView upserts watch_history and increments view_count.
func (r *Repository) RecordView(ctx context.Context, postID, userID uuid.UUID, durationSec int) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	if userID != uuid.Nil {
		_, err = tx.Exec(ctx, `
			INSERT INTO watch_history (user_id, post_id, watch_duration_seconds, completed)
			VALUES ($1, $2, $3, $4)`,
			userID, postID, durationSec, durationSec > 0)
		if err != nil {
			return fmt.Errorf("insert watch history: %w", err)
		}
	}

	_, err = tx.Exec(ctx,
		`UPDATE posts SET view_count = view_count + 1 WHERE id = $1`, postID)
	if err != nil {
		return fmt.Errorf("increment view count: %w", err)
	}

	return tx.Commit(ctx)
}

// GetWatchHistory returns the user's watch history as posts.
func (r *Repository) GetWatchHistory(ctx context.Context, userID uuid.UUID, limit int) ([]Post, error) {
	query := fmt.Sprintf(`
		SELECT %s
		FROM watch_history wh
		JOIN posts p ON p.id = wh.post_id
		JOIN users u ON u.id = p.user_id
		LEFT JOIN files f ON f.id = p.file_id
		WHERE wh.user_id = $1 AND p.status = 'active'
		ORDER BY wh.created_at DESC
		LIMIT $2`, postColumns)

	rows, err := r.db.Query(ctx, query, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("watch history: %w", err)
	}
	defer rows.Close()

	posts, err := scanPostRows(rows)
	if err != nil {
		return nil, err
	}

	if err := r.enrichViewerFields(ctx, posts, userID); err != nil {
		return nil, err
	}

	return posts, nil
}

// GetCreatorProfile returns a creator's public profile.
func (r *Repository) GetCreatorProfile(ctx context.Context, creatorID, viewerID uuid.UUID) (*CreatorProfile, error) {
	profile := &CreatorProfile{UserID: creatorID}

	err := r.db.QueryRow(ctx,
		`SELECT display_name, UPPER(LEFT(display_name, 1)) FROM users WHERE id = $1`, creatorID,
	).Scan(&profile.Name, &profile.AvatarInitial)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get creator: %w", err)
	}

	_ = r.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM posts WHERE user_id = $1 AND status = 'active'`, creatorID,
	).Scan(&profile.PostCount)

	_ = r.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM follows WHERE creator_id = $1`, creatorID,
	).Scan(&profile.SubscriberCount)

	if viewerID != uuid.Nil {
		_ = r.db.QueryRow(ctx,
			`SELECT EXISTS(SELECT 1 FROM follows WHERE subscriber_id = $1 AND creator_id = $2)`,
			viewerID, creatorID,
		).Scan(&profile.IsSubscribed)
	}

	return profile, nil
}

// ReportPost creates a report for a post.
func (r *Repository) ReportPost(ctx context.Context, postID, userID uuid.UUID, reason, details string) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO post_reports (post_id, user_id, reason, details)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (post_id, user_id) DO UPDATE SET reason = $3, details = $4`,
		postID, userID, reason, details)
	if err != nil {
		return fmt.Errorf("report post: %w", err)
	}
	return nil
}

// GetTrendingTags returns the most-used tags.
func (r *Repository) GetTrendingTags(ctx context.Context, limit int) ([]TagCount, error) {
	rows, err := r.db.Query(ctx, `
		SELECT tag, COUNT(*) as cnt
		FROM posts, unnest(tags) AS tag
		WHERE status = 'active' AND created_at >= NOW() - INTERVAL '7 days'
		GROUP BY tag
		ORDER BY cnt DESC
		LIMIT $1`, limit)
	if err != nil {
		return nil, fmt.Errorf("trending tags: %w", err)
	}
	defer rows.Close()

	var tags []TagCount
	for rows.Next() {
		var t TagCount
		if err := rows.Scan(&t.Tag, &t.Count); err != nil {
			return nil, fmt.Errorf("scan tag: %w", err)
		}
		tags = append(tags, t)
	}

	return tags, nil
}

// SearchPosts performs full-text search on caption.
func (r *Repository) SearchPosts(ctx context.Context, queryStr string, limit int, viewerUserID uuid.UUID) ([]Post, error) {
	searchTerm := "%" + strings.ToLower(queryStr) + "%"
	query := fmt.Sprintf(`
		SELECT %s
		FROM posts p
		JOIN users u ON u.id = p.user_id
		LEFT JOIN files f ON f.id = p.file_id
		WHERE p.status = 'active' AND (LOWER(p.caption) LIKE $1 OR LOWER(u.display_name) LIKE $1)
		ORDER BY p.like_count DESC, p.created_at DESC
		LIMIT $2`, postColumns)

	rows, err := r.db.Query(ctx, query, searchTerm, limit)
	if err != nil {
		return nil, fmt.Errorf("search posts: %w", err)
	}
	defer rows.Close()

	posts, err := scanPostRows(rows)
	if err != nil {
		return nil, err
	}

	if err := r.enrichViewerFields(ctx, posts, viewerUserID); err != nil {
		return nil, err
	}

	return posts, nil
}

// GetCategoryFeed returns a paginated feed for a specific category.
func (r *Repository) GetCategoryFeed(ctx context.Context, category string, limit int, cursor string, viewerUserID uuid.UUID) ([]Post, bool, error) {
	query := fmt.Sprintf(`
		SELECT %s
		FROM posts p
		JOIN users u ON u.id = p.user_id
		LEFT JOIN files f ON f.id = p.file_id
		WHERE p.status = 'active' AND p.category = $1`, postColumns)

	args := []any{category}
	argIdx := 2

	if cursor != "" {
		query += fmt.Sprintf(` AND p.created_at < $%d`, argIdx)
		args = append(args, cursor)
		argIdx++
	}

	query += ` ORDER BY p.created_at DESC`
	query += fmt.Sprintf(` LIMIT $%d`, argIdx)
	args = append(args, limit+1)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, false, fmt.Errorf("category feed: %w", err)
	}
	defer rows.Close()

	posts, err := scanPostRows(rows)
	if err != nil {
		return nil, false, err
	}

	hasMore := len(posts) > limit
	if hasMore {
		posts = posts[:limit]
	}

	if err := r.enrichViewerFields(ctx, posts, viewerUserID); err != nil {
		return nil, false, err
	}

	return posts, hasMore, nil
}

// GetFileMimeType returns the mime_type for a file.
func (r *Repository) GetFileMimeType(ctx context.Context, fileID uuid.UUID) (string, error) {
	var mimeType string
	err := r.db.QueryRow(ctx, `SELECT mime_type FROM files WHERE id = $1`, fileID).Scan(&mimeType)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", fmt.Errorf("file not found")
		}
		return "", fmt.Errorf("get file mime type: %w", err)
	}
	return mimeType, nil
}

// GetFileOwner checks if a file belongs to the user.
func (r *Repository) GetFileOwner(ctx context.Context, fileID uuid.UUID) (uuid.UUID, error) {
	var ownerID uuid.UUID
	err := r.db.QueryRow(ctx, `SELECT user_id FROM files WHERE id = $1`, fileID).Scan(&ownerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return uuid.Nil, fmt.Errorf("file not found")
		}
		return uuid.Nil, fmt.Errorf("get file owner: %w", err)
	}
	return ownerID, nil
}

// GetFileDuration returns the duration for a file if tracked, or 0.
func (r *Repository) GetFileDuration(ctx context.Context, fileID uuid.UUID) (int, error) {
	var dur int
	err := r.db.QueryRow(ctx,
		`SELECT COALESCE(duration, 0) FROM files WHERE id = $1`, fileID,
	).Scan(&dur)
	if err != nil {
		// Column might not exist; return 0
		return 0, nil
	}
	return dur, nil
}

// LastViewedAt checks when the user last viewed this post (to prevent rapid view inflation).
func (r *Repository) LastViewedAt(ctx context.Context, postID, userID uuid.UUID) (*time.Time, error) {
	var t time.Time
	err := r.db.QueryRow(ctx,
		`SELECT created_at FROM watch_history WHERE post_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1`,
		postID, userID,
	).Scan(&t)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("last viewed: %w", err)
	}
	return &t, nil
}
