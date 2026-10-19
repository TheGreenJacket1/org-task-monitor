-- ========================================================================
-- Schema: Aplikasi Monitoring Tugas Organisasi (Biaya Rp0 - Supabase Free)
-- Model Akses: Tanpa Login / Public Anon Access
-- ========================================================================
-- CATATAN KEAMANAN & ARSITEKTUR:
-- Aplikasi ini dirancang tanpa sistem autentikasi pengguna (login/register).
-- Sesuai kebutuhan operasional Rp0 dan kemudahan akses bagi panitia/staf,
-- kredensial anon key Supabase digunakan untuk membaca dan menulis data.
-- Kode organisasi dan peran staf hanya berlaku sebagai pembeda tampilan di UI,
-- bukan batas keamanan kriptografis. Jangan menyimpan data rahasia/sensitif.
-- ========================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABEL: ORGANISASI
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. TABEL: ANGGOTA / STAF
CREATE TABLE IF NOT EXISTS members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    avatar_color VARCHAR(20) DEFAULT '#22c55e',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. TABEL: KEGIATAN
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT false,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT check_activity_dates CHECK (end_date >= start_date)
);

-- Index parsial: Memastikan hanya ada MAKSIMAL 1 kegiatan aktif per organisasi
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_activity_per_org
ON activities (organization_id)
WHERE is_active = true;

-- Function dan Trigger untuk mengotomatiskan penonaktifan kegiatan lama
-- ketika ada kegiatan baru yang diubah menjadi aktif (is_active = true)
CREATE OR REPLACE FUNCTION handle_single_active_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_active = true THEN
        UPDATE activities
        SET is_active = false,
            updated_at = timezone('utc'::text, now())
        WHERE organization_id = NEW.organization_id
          AND id <> NEW.id
          AND is_active = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_single_active_activity ON activities;
CREATE TRIGGER trg_single_active_activity
BEFORE INSERT OR UPDATE OF is_active ON activities
FOR EACH ROW
WHEN (NEW.is_active = true)
EXECUTE FUNCTION handle_single_active_activity();

-- 5. TABEL: TUGAS
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    category VARCHAR(50) NOT NULL,
    phase VARCHAR(50) NOT NULL,
    priority VARCHAR(50) NOT NULL,
    pic_id UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    deadline DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Belum dikerjakan',
    progress INTEGER NOT NULL DEFAULT 0,
    review_status VARCHAR(50) NOT NULL DEFAULT 'Belum diajukan',
    revision_notes TEXT DEFAULT '',
    reference_links JSONB NOT NULL DEFAULT '[]'::jsonb,
    result_links JSONB NOT NULL DEFAULT '[]'::jsonb,
    completed_at TIMESTAMPTZ,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    
    -- Validasi Constraints
    CONSTRAINT check_task_dates CHECK (deadline >= start_date),
    CONSTRAINT check_task_progress CHECK (progress >= 0 AND progress <= 100),
    CONSTRAINT check_task_category CHECK (category IN ('Desain', 'Publikasi', 'Dokumentasi', 'Administrasi', 'Lainnya')),
    CONSTRAINT check_task_phase CHECK (phase IN ('Pra-acara', 'Hari-H', 'Pasca-acara')),
    CONSTRAINT check_task_priority CHECK (priority IN ('Rendah', 'Sedang', 'Tinggi', 'Mendesak')),
    CONSTRAINT check_task_status CHECK (status IN ('Belum dikerjakan', 'Dikerjakan', 'Revisi', 'Selesai')),
    CONSTRAINT check_task_review_status CHECK (review_status IN ('Belum diajukan', 'Menunggu review', 'Disetujui', 'Perlu revisi')),
    
    -- Tugas Selesai WAJIB progres 100% dan memiliki tanggal selesai
    CONSTRAINT check_task_completed_rules CHECK (
        status <> 'Selesai' OR (progress = 100 AND completed_at IS NOT NULL)
    ),
    
    -- Status Revisi WAJIB memiliki catatan revisi
    CONSTRAINT check_task_revision_notes CHECK (
        (status <> 'Revisi' AND review_status <> 'Perlu revisi') OR (revision_notes IS NOT NULL AND length(trim(revision_notes)) > 0)
    )
);

-- 6. TABEL: LOG AKTIVITAS (AUDIT TRAIL)
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    actor_name VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. INDEXES UNTUK PERFORMA QUERY
CREATE INDEX IF NOT EXISTS idx_members_org ON members(organization_id);
CREATE INDEX IF NOT EXISTS idx_activities_org ON activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_activity ON tasks(activity_id);
CREATE INDEX IF NOT EXISTS idx_tasks_org ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_pic ON tasks(pic_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_activity_logs_org ON activity_logs(organization_id, created_at DESC);

-- 8. ROW LEVEL SECURITY (RLS) DENGAN AKSES ANON
-- Karena tidak ada login pengguna, RLS dibuka penuh untuk peran anon
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Akses publik organisasi" ON organizations FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Akses publik anggota" ON members FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Akses publik kegiatan" ON activities FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Akses publik tugas" ON tasks FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Akses publik log" ON activity_logs FOR ALL TO anon USING (true) WITH CHECK (true);

-- 9. SUPABASE REALTIME REPLICATION
-- Mengaktifkan sinkronisasi realtime pada tabel utama
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE organizations, members, activities, tasks, activity_logs;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
END $$;
