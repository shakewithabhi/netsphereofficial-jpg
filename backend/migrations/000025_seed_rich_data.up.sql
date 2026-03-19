-- Rich seed data for development: users, folders, files, shares, favorites, audit logs
-- Only runs if migration 8 seed users exist but this migration's data does not yet.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE id = 'a0000000-0000-0000-0000-000000000001')
     AND NOT EXISTS (SELECT 1 FROM users WHERE id = 'a0000000-0000-0000-0000-000000000003') THEN

    -- =========================================================
    -- USERS
    -- =========================================================
    -- All new seed users share the same password hash as test@bytebox.dev (Password1!)
    INSERT INTO users (id, email, password_hash, display_name, storage_used, storage_limit, plan, is_active, is_admin, email_verified, approval_status)
    VALUES
        ('a0000000-0000-0000-0000-000000000003', 'alice@bytebox.dev',
         '$2a$10$PTGuZVuoLdbs.tDjXpQFPO83KocoGcuSKLRjkm/mECG733H8ccn.G',
         'Alice Chen', 0, 107374182400, 'pro', true, false, true, 'approved'),

        ('a0000000-0000-0000-0000-000000000004', 'bob@bytebox.dev',
         '$2a$10$PTGuZVuoLdbs.tDjXpQFPO83KocoGcuSKLRjkm/mECG733H8ccn.G',
         'Bob Martinez', 0, 5368709120, 'free', true, false, true, 'approved'),

        ('a0000000-0000-0000-0000-000000000005', 'charlie@bytebox.dev',
         '$2a$10$PTGuZVuoLdbs.tDjXpQFPO83KocoGcuSKLRjkm/mECG733H8ccn.G',
         'Charlie Kim', 0, 5368709120, 'free', true, false, true, 'approved'),

        ('a0000000-0000-0000-0000-000000000006', 'diana@bytebox.dev',
         '$2a$10$PTGuZVuoLdbs.tDjXpQFPO83KocoGcuSKLRjkm/mECG733H8ccn.G',
         'Diana Patel', 0, 1099511627776, 'premium', true, false, true, 'approved'),

        ('a0000000-0000-0000-0000-000000000007', 'evan@bytebox.dev',
         '$2a$10$PTGuZVuoLdbs.tDjXpQFPO83KocoGcuSKLRjkm/mECG733H8ccn.G',
         'Evan Torres', 0, 107374182400, 'pro', true, false, true, 'approved')
    ON CONFLICT (email) DO NOTHING;

    -- =========================================================
    -- FOLDERS
    -- =========================================================
    -- Test user root folders
    INSERT INTO folders (id, user_id, parent_id, name, path)
    VALUES
        ('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', NULL, 'Photos',    '/Photos'),
        ('f0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', NULL, 'Documents', '/Documents'),
        ('f0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', NULL, 'Videos',    '/Videos'),
        ('f0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', NULL, 'Music',     '/Music'),
        ('f0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', NULL, 'Work',      '/Work'),
        -- Subfolder inside Photos
        ('f0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001',
         'f0000000-0000-0000-0000-000000000001', 'Vacation 2024', '/Photos/Vacation 2024'),
        -- Alice's folder
        ('f0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000003', NULL, 'Projects', '/Projects'),
        -- Diana's folder
        ('f0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000006', NULL, 'Media',    '/Media')
    ON CONFLICT DO NOTHING;

    -- =========================================================
    -- FILES — TEST USER
    -- =========================================================
    -- Root files
    INSERT INTO files (id, user_id, folder_id, name, storage_key, size, mime_type, scan_status, current_version,
                       created_at)
    VALUES
        ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', NULL,
         'welcome_photo.jpg', 'seeds/test/welcome_photo.jpg', 2411724, 'image/jpeg', 'clean', 1,
         NOW() - INTERVAL '30 days'),

        ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', NULL,
         'project_notes.txt', 'seeds/test/project_notes.txt', 12288, 'text/plain', 'clean', 1,
         NOW() - INTERVAL '25 days'),

        ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', NULL,
         'budget_2024.pdf', 'seeds/test/budget_2024.pdf', 4298342, 'application/pdf', 'clean', 1,
         NOW() - INTERVAL '20 days'),

        ('e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', NULL,
         'intro_music.mp3', 'seeds/test/intro_music.mp3', 8912896, 'audio/mpeg', 'clean', 1,
         NOW() - INTERVAL '18 days'),

        ('e0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', NULL,
         'demo_reel.mp4', 'seeds/test/demo_reel.mp4', 54525952, 'video/mp4', 'clean', 1,
         NOW() - INTERVAL '15 days')
    ON CONFLICT DO NOTHING;

    -- Photos folder
    INSERT INTO files (id, user_id, folder_id, name, storage_key, size, mime_type, scan_status, current_version,
                       created_at)
    VALUES
        ('e0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001',
         'f0000000-0000-0000-0000-000000000001',
         'beach_sunset.jpg', 'seeds/test/beach_sunset.jpg', 3250586, 'image/jpeg', 'clean', 1,
         NOW() - INTERVAL '28 days'),

        ('e0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001',
         'f0000000-0000-0000-0000-000000000001',
         'mountain_hike.jpg', 'seeds/test/mountain_hike.jpg', 2936012, 'image/jpeg', 'clean', 1,
         NOW() - INTERVAL '27 days'),

        ('e0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001',
         'f0000000-0000-0000-0000-000000000001',
         'city_skyline.jpg', 'seeds/test/city_skyline.jpg', 4404019, 'image/jpeg', 'clean', 1,
         NOW() - INTERVAL '22 days'),

        ('e0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001',
         'f0000000-0000-0000-0000-000000000001',
         'portrait_shot.png', 'seeds/test/portrait_shot.png', 5767168, 'image/png', 'clean', 1,
         NOW() - INTERVAL '10 days')
    ON CONFLICT DO NOTHING;

    -- Vacation 2024 subfolder
    INSERT INTO files (id, user_id, folder_id, name, storage_key, size, mime_type, scan_status, current_version,
                       created_at)
    VALUES
        ('e0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001',
         'f0000000-0000-0000-0000-000000000006',
         'paris_trip.jpg', 'seeds/test/paris_trip.jpg', 3461734, 'image/jpeg', 'clean', 1,
         NOW() - INTERVAL '14 days')
    ON CONFLICT DO NOTHING;

    -- Documents folder
    INSERT INTO files (id, user_id, folder_id, name, storage_key, size, mime_type, scan_status, current_version,
                       created_at)
    VALUES
        ('e0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001',
         'f0000000-0000-0000-0000-000000000002',
         'resume_2024.pdf', 'seeds/test/resume_2024.pdf', 1258291, 'application/pdf', 'clean', 1,
         NOW() - INTERVAL '45 days'),

        ('e0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001',
         'f0000000-0000-0000-0000-000000000002',
         'meeting_notes.docx', 'seeds/test/meeting_notes.docx', 696320,
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'clean', 1,
         NOW() - INTERVAL '12 days'),

        ('e0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000001',
         'f0000000-0000-0000-0000-000000000002',
         'README.md', 'seeds/test/README.md', 8192, 'text/markdown', 'clean', 1,
         NOW() - INTERVAL '60 days'),

        ('e0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000001',
         'f0000000-0000-0000-0000-000000000002',
         'data_analysis.xlsx', 'seeds/test/data_analysis.xlsx', 2202009,
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'clean', 1,
         NOW() - INTERVAL '8 days')
    ON CONFLICT DO NOTHING;

    -- Videos folder
    INSERT INTO files (id, user_id, folder_id, name, storage_key, size, mime_type, scan_status, current_version,
                       created_at)
    VALUES
        ('e0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000001',
         'f0000000-0000-0000-0000-000000000003',
         'tutorial_part1.mp4', 'seeds/test/tutorial_part1.mp4', 131072000, 'video/mp4', 'clean', 1,
         NOW() - INTERVAL '50 days'),

        ('e0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000001',
         'f0000000-0000-0000-0000-000000000003',
         'product_demo.mp4', 'seeds/test/product_demo.mp4', 89128960, 'video/mp4', 'clean', 1,
         NOW() - INTERVAL '35 days'),

        ('e0000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000001',
         'f0000000-0000-0000-0000-000000000003',
         'family_memories.mov', 'seeds/test/family_memories.mov', 209715200, 'video/quicktime', 'clean', 1,
         NOW() - INTERVAL '5 days')
    ON CONFLICT DO NOTHING;

    -- Music folder
    INSERT INTO files (id, user_id, folder_id, name, storage_key, size, mime_type, scan_status, current_version,
                       created_at)
    VALUES
        ('e0000000-0000-0000-0000-000000000018', 'a0000000-0000-0000-0000-000000000001',
         'f0000000-0000-0000-0000-000000000004',
         'summer_mix.mp3', 'seeds/test/summer_mix.mp3', 9650610, 'audio/mpeg', 'clean', 1,
         NOW() - INTERVAL '40 days'),

        ('e0000000-0000-0000-0000-000000000019', 'a0000000-0000-0000-0000-000000000001',
         'f0000000-0000-0000-0000-000000000004',
         'podcast_ep1.m4a', 'seeds/test/podcast_ep1.m4a', 47185920, 'audio/mp4', 'clean', 1,
         NOW() - INTERVAL '20 days'),

        ('e0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000001',
         'f0000000-0000-0000-0000-000000000004',
         'classical_piano.flac', 'seeds/test/classical_piano.flac', 36700160, 'audio/flac', 'clean', 1,
         NOW() - INTERVAL '55 days')
    ON CONFLICT DO NOTHING;

    -- =========================================================
    -- FILES — ALICE
    -- =========================================================
    INSERT INTO files (id, user_id, folder_id, name, storage_key, size, mime_type, scan_status, current_version,
                       created_at)
    VALUES
        ('e0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000003', NULL,
         'design_mockup.png', 'seeds/alice/design_mockup.png', 8912896, 'image/png', 'clean', 1,
         NOW() - INTERVAL '7 days'),

        ('e0000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000003', NULL,
         'product_photos.zip', 'seeds/alice/product_photos.zip', 157286400, 'application/zip', 'clean', 1,
         NOW() - INTERVAL '9 days'),

        ('e0000000-0000-0000-0000-000000000023', 'a0000000-0000-0000-0000-000000000003', NULL,
         'team_photo.jpg', 'seeds/alice/team_photo.jpg', 4509818, 'image/jpeg', 'clean', 1,
         NOW() - INTERVAL '3 days'),

        ('e0000000-0000-0000-0000-000000000024', 'a0000000-0000-0000-0000-000000000003',
         'f0000000-0000-0000-0000-000000000007',
         'brand_video.mp4', 'seeds/alice/brand_video.mp4', 335544320, 'video/mp4', 'clean', 1,
         NOW() - INTERVAL '14 days'),

        ('e0000000-0000-0000-0000-000000000025', 'a0000000-0000-0000-0000-000000000003',
         'f0000000-0000-0000-0000-000000000007',
         'wireframes.pdf', 'seeds/alice/wireframes.pdf', 12582912, 'application/pdf', 'clean', 1,
         NOW() - INTERVAL '6 days')
    ON CONFLICT DO NOTHING;

    -- =========================================================
    -- FILES — BOB
    -- =========================================================
    INSERT INTO files (id, user_id, folder_id, name, storage_key, size, mime_type, scan_status, current_version,
                       created_at)
    VALUES
        ('e0000000-0000-0000-0000-000000000026', 'a0000000-0000-0000-0000-000000000004', NULL,
         'holiday_photo.jpg', 'seeds/bob/holiday_photo.jpg', 3774873, 'image/jpeg', 'clean', 1,
         NOW() - INTERVAL '11 days'),

        ('e0000000-0000-0000-0000-000000000027', 'a0000000-0000-0000-0000-000000000004', NULL,
         'report_q4.pdf', 'seeds/bob/report_q4.pdf', 2202009, 'application/pdf', 'clean', 1,
         NOW() - INTERVAL '16 days'),

        ('e0000000-0000-0000-0000-000000000028', 'a0000000-0000-0000-0000-000000000004', NULL,
         'code_backup.zip', 'seeds/bob/code_backup.zip', 47185920, 'application/zip', 'clean', 1,
         NOW() - INTERVAL '4 days')
    ON CONFLICT DO NOTHING;

    -- =========================================================
    -- FILES — CHARLIE
    -- =========================================================
    INSERT INTO files (id, user_id, folder_id, name, storage_key, size, mime_type, scan_status, current_version,
                       created_at)
    VALUES
        ('e0000000-0000-0000-0000-000000000029', 'a0000000-0000-0000-0000-000000000005', NULL,
         'profile_pic.jpg', 'seeds/charlie/profile_pic.jpg', 1048576, 'image/jpeg', 'clean', 1,
         NOW() - INTERVAL '2 days'),

        ('e0000000-0000-0000-0000-000000000030', 'a0000000-0000-0000-0000-000000000005', NULL,
         'notes.txt', 'seeds/charlie/notes.txt', 4096, 'text/plain', 'clean', 1,
         NOW() - INTERVAL '1 day')
    ON CONFLICT DO NOTHING;

    -- =========================================================
    -- FILES — DIANA
    -- =========================================================
    INSERT INTO files (id, user_id, folder_id, name, storage_key, size, mime_type, scan_status, current_version,
                       created_at)
    VALUES
        ('e0000000-0000-0000-0000-000000000031', 'a0000000-0000-0000-0000-000000000006', NULL,
         'nature_4k.jpg', 'seeds/diana/nature_4k.jpg', 12582912, 'image/jpeg', 'clean', 1,
         NOW() - INTERVAL '21 days'),

        ('e0000000-0000-0000-0000-000000000032', 'a0000000-0000-0000-0000-000000000006', NULL,
         'landscape.jpg', 'seeds/diana/landscape.jpg', 8493465, 'image/jpeg', 'clean', 1,
         NOW() - INTERVAL '17 days'),

        ('e0000000-0000-0000-0000-000000000033', 'a0000000-0000-0000-0000-000000000006', NULL,
         'abstract_art.png', 'seeds/diana/abstract_art.png', 15728640, 'image/png', 'clean', 1,
         NOW() - INTERVAL '13 days'),

        ('e0000000-0000-0000-0000-000000000034', 'a0000000-0000-0000-0000-000000000006',
         'f0000000-0000-0000-0000-000000000008',
         'wedding_video.mp4', 'seeds/diana/wedding_video.mp4', 4831838208, 'video/mp4', 'clean', 1,
         NOW() - INTERVAL '90 days'),

        ('e0000000-0000-0000-0000-000000000035', 'a0000000-0000-0000-0000-000000000006',
         'f0000000-0000-0000-0000-000000000008',
         'concert.mp4', 'seeds/diana/concert.mp4', 2469606195, 'video/mp4', 'clean', 1,
         NOW() - INTERVAL '45 days')
    ON CONFLICT DO NOTHING;

    -- =========================================================
    -- FILES — EVAN
    -- =========================================================
    INSERT INTO files (id, user_id, folder_id, name, storage_key, size, mime_type, scan_status, current_version,
                       created_at)
    VALUES
        ('e0000000-0000-0000-0000-000000000036', 'a0000000-0000-0000-0000-000000000007', NULL,
         'podcast_recording.mp3', 'seeds/evan/podcast_recording.mp3', 125829120, 'audio/mpeg', 'clean', 1,
         NOW() - INTERVAL '19 days'),

        ('e0000000-0000-0000-0000-000000000037', 'a0000000-0000-0000-0000-000000000007', NULL,
         'travel_photos.jpg', 'seeds/evan/travel_photos.jpg', 6502170, 'image/jpeg', 'clean', 1,
         NOW() - INTERVAL '8 days'),

        ('e0000000-0000-0000-0000-000000000038', 'a0000000-0000-0000-0000-000000000007', NULL,
         'screen_recording.mp4', 'seeds/evan/screen_recording.mp4', 293601280, 'video/mp4', 'clean', 1,
         NOW() - INTERVAL '2 days')
    ON CONFLICT DO NOTHING;

    -- =========================================================
    -- UPDATE STORAGE USED
    -- =========================================================
    -- Test user: root + Photos + Vacation 2024 + Documents + Videos + Music
    UPDATE users SET storage_used = (
        2411724 + 12288 + 4298342 + 8912896 + 54525952  -- root
        + 3250586 + 2936012 + 4404019 + 5767168 + 3461734  -- Photos + Vacation
        + 1258291 + 696320 + 8192 + 2202009               -- Documents
        + 131072000 + 89128960 + 209715200                 -- Videos
        + 9650610 + 47185920 + 36700160                    -- Music
    ) WHERE id = 'a0000000-0000-0000-0000-000000000001';

    -- Alice
    UPDATE users SET storage_used = (
        8912896 + 157286400 + 4509818  -- root
        + 335544320 + 12582912          -- Projects
    ) WHERE id = 'a0000000-0000-0000-0000-000000000003';

    -- Bob
    UPDATE users SET storage_used = (
        3774873 + 2202009 + 47185920
    ) WHERE id = 'a0000000-0000-0000-0000-000000000004';

    -- Charlie
    UPDATE users SET storage_used = (
        1048576 + 4096
    ) WHERE id = 'a0000000-0000-0000-0000-000000000005';

    -- Diana
    UPDATE users SET storage_used = (
        12582912 + 8493465 + 15728640  -- root
        + 4831838208 + 2469606195       -- Media
    ) WHERE id = 'a0000000-0000-0000-0000-000000000006';

    -- Evan
    UPDATE users SET storage_used = (
        125829120 + 6502170 + 293601280
    ) WHERE id = 'a0000000-0000-0000-0000-000000000007';

    -- =========================================================
    -- SHARES (powers the Explore screen)
    -- =========================================================
    INSERT INTO shares (id, file_id, user_id, code, download_count, is_active, created_at)
    VALUES
        ('b0000000-0000-0000-0000-000000000001',
         'e0000000-0000-0000-0000-000000000006',  -- beach_sunset.jpg
         'a0000000-0000-0000-0000-000000000001',
         'abc123def456', 42, true, NOW() - INTERVAL '26 days'),

        ('b0000000-0000-0000-0000-000000000002',
         'e0000000-0000-0000-0000-000000000005',  -- demo_reel.mp4
         'a0000000-0000-0000-0000-000000000001',
         'xyz789uvw012', 18, true, NOW() - INTERVAL '14 days'),

        ('b0000000-0000-0000-0000-000000000003',
         'e0000000-0000-0000-0000-000000000021',  -- design_mockup.png (alice)
         'a0000000-0000-0000-0000-000000000003',
         'mnp345qrs678', 67, true, NOW() - INTERVAL '6 days'),

        ('b0000000-0000-0000-0000-000000000004',
         'e0000000-0000-0000-0000-000000000024',  -- brand_video.mp4 (alice)
         'a0000000-0000-0000-0000-000000000003',
         'ghi901jkl234', 25, true, NOW() - INTERVAL '13 days'),

        ('b0000000-0000-0000-0000-000000000005',
         'e0000000-0000-0000-0000-000000000031',  -- nature_4k.jpg (diana)
         'a0000000-0000-0000-0000-000000000006',
         'stu567vwx890', 89, true, NOW() - INTERVAL '20 days'),

        ('b0000000-0000-0000-0000-000000000006',
         'e0000000-0000-0000-0000-000000000033',  -- abstract_art.png (diana)
         'a0000000-0000-0000-0000-000000000006',
         'yza123bcd456', 34, true, NOW() - INTERVAL '12 days'),

        ('b0000000-0000-0000-0000-000000000007',
         'e0000000-0000-0000-0000-000000000037',  -- travel_photos.jpg (evan)
         'a0000000-0000-0000-0000-000000000007',
         'efg789hij012', 12, true, NOW() - INTERVAL '7 days'),

        ('b0000000-0000-0000-0000-000000000008',
         'e0000000-0000-0000-0000-000000000032',  -- landscape.jpg (diana)
         'a0000000-0000-0000-0000-000000000006',
         'klm345nop678', 56, true, NOW() - INTERVAL '16 days'),

        ('b0000000-0000-0000-0000-000000000009',
         'e0000000-0000-0000-0000-000000000023',  -- team_photo.jpg (alice)
         'a0000000-0000-0000-0000-000000000003',
         'qrs901tuv234', 23, true, NOW() - INTERVAL '2 days'),

        ('b0000000-0000-0000-0000-000000000010',
         'e0000000-0000-0000-0000-000000000038',  -- screen_recording.mp4 (evan)
         'a0000000-0000-0000-0000-000000000007',
         'wxy567zab890', 8, true, NOW() - INTERVAL '1 day')
    ON CONFLICT (code) DO NOTHING;

    -- =========================================================
    -- FAVORITES (file_stars)
    -- =========================================================
    INSERT INTO file_stars (file_id, user_id, starred_at)
    VALUES
        ('e0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', NOW() - INTERVAL '25 days'),  -- beach_sunset.jpg
        ('e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', NOW() - INTERVAL '17 days'),  -- intro_music.mp3
        ('e0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', NOW() - INTERVAL '44 days'),  -- resume_2024.pdf
        ('e0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000001', NOW() - INTERVAL '6 days')    -- design_mockup.png (alice's)
    ON CONFLICT DO NOTHING;

    -- =========================================================
    -- AUDIT LOGS
    -- =========================================================
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata, created_at)
    VALUES
        -- Test user logins
        ('a0000000-0000-0000-0000-000000000001', 'login', 'session', NULL,
         '{"device": "Android", "ip": "192.168.1.10"}'::jsonb, NOW() - INTERVAL '30 days'),
        ('a0000000-0000-0000-0000-000000000001', 'login', 'session', NULL,
         '{"device": "Web", "ip": "192.168.1.10"}'::jsonb, NOW() - INTERVAL '7 days'),
        ('a0000000-0000-0000-0000-000000000001', 'login', 'session', NULL,
         '{"device": "Android", "ip": "10.0.0.5"}'::jsonb, NOW() - INTERVAL '1 day'),

        -- Test user file uploads
        ('a0000000-0000-0000-0000-000000000001', 'file_upload', 'file',
         'e0000000-0000-0000-0000-000000000005',
         '{"filename": "demo_reel.mp4", "size": 54525952}'::jsonb, NOW() - INTERVAL '15 days'),
        ('a0000000-0000-0000-0000-000000000001', 'file_upload', 'file',
         'e0000000-0000-0000-0000-000000000017',
         '{"filename": "family_memories.mov", "size": 209715200}'::jsonb, NOW() - INTERVAL '5 days'),

        -- Test user shares
        ('a0000000-0000-0000-0000-000000000001', 'share_create', 'share',
         'b0000000-0000-0000-0000-000000000001',
         '{"code": "abc123def456", "file": "beach_sunset.jpg"}'::jsonb, NOW() - INTERVAL '26 days'),
        ('a0000000-0000-0000-0000-000000000001', 'share_create', 'share',
         'b0000000-0000-0000-0000-000000000002',
         '{"code": "xyz789uvw012", "file": "demo_reel.mp4"}'::jsonb, NOW() - INTERVAL '14 days'),

        -- Alice logins
        ('a0000000-0000-0000-0000-000000000003', 'login', 'session', NULL,
         '{"device": "Web", "ip": "10.1.1.25"}'::jsonb, NOW() - INTERVAL '5 days'),
        ('a0000000-0000-0000-0000-000000000003', 'login', 'session', NULL,
         '{"device": "Android", "ip": "10.1.1.25"}'::jsonb, NOW() - INTERVAL '2 days'),

        -- Alice file uploads
        ('a0000000-0000-0000-0000-000000000003', 'file_upload', 'file',
         'e0000000-0000-0000-0000-000000000024',
         '{"filename": "brand_video.mp4", "size": 335544320}'::jsonb, NOW() - INTERVAL '14 days'),
        ('a0000000-0000-0000-0000-000000000003', 'file_upload', 'file',
         'e0000000-0000-0000-0000-000000000021',
         '{"filename": "design_mockup.png", "size": 8912896}'::jsonb, NOW() - INTERVAL '7 days'),

        -- Diana logins
        ('a0000000-0000-0000-0000-000000000006', 'login', 'session', NULL,
         '{"device": "Web", "ip": "172.16.0.5"}'::jsonb, NOW() - INTERVAL '10 days'),

        -- Admin logins
        ('a0000000-0000-0000-0000-000000000002', 'login', 'session', NULL,
         '{"device": "Web", "ip": "127.0.0.1"}'::jsonb, NOW() - INTERVAL '3 days'),
        ('a0000000-0000-0000-0000-000000000002', 'login', 'session', NULL,
         '{"device": "Web", "ip": "127.0.0.1"}'::jsonb, NOW() - INTERVAL '1 day'),

        -- Evan file upload
        ('a0000000-0000-0000-0000-000000000007', 'file_upload', 'file',
         'e0000000-0000-0000-0000-000000000038',
         '{"filename": "screen_recording.mp4", "size": 293601280}'::jsonb, NOW() - INTERVAL '2 days');

  END IF;
END $$;
