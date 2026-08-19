import psycopg2
import frappe
import re
import psycopg2.extras
from bima_lms.auth import get_db_config

# Fungsi untuk membuat koneksi ke database PostgreSQL diambil dari config site
def get_pg_connection():
    """Membuat koneksi ke database PostgreSQL berdasarkan config site"""
    site_config = frappe.get_site_config()
    return psycopg2.connect(
        host=site_config.get("pg_db_host"),
        port=site_config.get("pg_db_port", 5432),
        user=site_config.get("pg_db_user"),
        password=site_config.get("pg_db_password"),
        dbname=site_config.get("pg_db_name")
    )

# Fungsi untuk mendapatkan user_id dari session Frappe atau database PostgreSQL
def get_current_user_id(conn=None):
    """
    Mengambil ID numerik (bigint) user dari PostgreSQL (auth.users)
    berdasarkan email session Frappe (frappe.session.user).
    """
    current_user_email = frappe.session.user
    if not current_user_email:
        return None

    should_close_conn = False
    if conn is None:
        conn = get_pg_connection()
        should_close_conn = True

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT user_id FROM auth.users WHERE user_email = %s AND is_deleted = false LIMIT 1;", 
                (current_user_email,)
            )
            pg_user = cursor.fetchone()
            return pg_user[0] if pg_user else None
    finally:
        if should_close_conn:
            conn.close()
            
# Fungsi untuk mengubah URL video menjadi format embed di iframe, mendukung YouTube dan Vimeo
def get_embed_video_url(url):
    """
    Mengubah URL YouTube/Vimeo biasa menjadi URL Embed iframe.
    """
    if not url:
        return None
    
    # YouTube Embed conversion
    youtube_match = re.search(r'(?:youtu\.be/|youtube\.com/(?:watch\?v=|embed/|v/|shorts/))([\w-]{11})', url)
    if youtube_match:
        return f"https://www.youtube.com/embed/{youtube_match.group(1)}"
    
    # Vimeo Embed conversion
    vimeo_match = re.search(r'vimeo\.com/(\d+)', url)
    if vimeo_match:
        return f"https://player.vimeo.com/video/{vimeo_match.group(1)}"
    
    return url

# API untuk mengambil detail mata pelajaran (course) berdasarkan course_id di PostgreSQL
@frappe.whitelist()
def get_course_detail(course_id=None):
    """
    Mengambil detail mata pelajaran berdasarkan course_id.
    """
    if not course_id:
        frappe.throw("Parameter course_id diperlukan.", frappe.MandatoryError)

    current_user_email = frappe.session.user
    user_roles = frappe.get_roles(current_user_email)
    allowed_roles = ["LMS Admin", "LMS Teacher", "System Manager"]

    if not any(role in user_roles for role in allowed_roles):
        frappe.throw("Anda tidak memiliki akses untuk melihat halaman ini.", frappe.PermissionError)

    is_admin = any(role in user_roles for role in ["LMS Admin", "System Manager"])

    try:
        conn = get_pg_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Dapatkan pg_user_id
        cursor.execute("SELECT user_id FROM auth.users WHERE user_email = %s AND is_deleted = false LIMIT 1;", (current_user_email,))
        pg_user = cursor.fetchone()
        pg_user_id = pg_user["user_id"] if pg_user else None

        # Query detail course lengkap
        query = """
            SELECT 
                c.course_id,
                c.course_title,
                c.category_id,
                cat.category_name,
                c.short_description,
                c.full_description,
                c.video_link,
                u.user_full_name AS instructor_name,
                c.instructor_id,
                c.status,
                c.created_by,
                c.created_on,
                c.published_on,
                c.last_modified_on,
                c.total_enrollments,
                c.total_lessons
            FROM lms.courses c
            LEFT JOIN master.lms_course_categories cat ON c.category_id = cat.category_id
            LEFT JOIN auth.users u ON c.instructor_id = u.user_id
            WHERE c.course_id = %s
        """

        cursor.execute("""
            SELECT r.id, r.name 
            FROM lms.course_rombels cr
            JOIN master.rombels r ON cr.rombels_id = r.id
            WHERE cr.course_id = %s
            ORDER BY r.name ASC;
        """, (course_id,))
        assigned_rombels = cursor.fetchall()
        
        # Non-admin hanya bisa melihat course milik sendiri
        if not is_admin:
            query += " AND c.instructor_id = %s"
            cursor.execute(query, (course_id, pg_user_id))
        else:
            cursor.execute(query, (course_id,))

        row = cursor.fetchone()
        cursor.close()
        conn.close()

        if not row:
            frappe.throw("Data mata pelajaran tidak ditemukan atau Anda tidak memiliki akses.", frappe.DoesNotExistError)

        video_raw = row["video_link"] or ""
        embed_video = get_embed_video_url(video_raw)

        return {
            "course_id": row["course_id"],
            "course_title": row["course_title"] or "Tanpa Judul",
            "category_id": row["category_id"],
            "category_name": row["category_name"] or "Umum",
            "short_description": row["short_description"] or "",
            "full_description": row["full_description"] or "Belum ada deskripsi lengkap.",
            "video_link": video_raw,
            "embed_video_url": embed_video,
            "instructor_name": row["instructor_name"] or "Unassigned",
            "status": row.get("status") or "Draft",
            "created_by": row.get("created_by") or "-",
            "created_on": str(row["created_on"]) if row.get("created_on") else "-",
            "published_on": str(row["published_on"]) if row.get("published_on") else "-",
            "last_modified_on": str(row["last_modified_on"]) if row.get("last_modified_on") else "-",
            "total_enrollments": row.get("total_enrollments") or 0,
            "total_lessons": row.get("total_lessons") or 0,
            "assigned_rombels": [{"id": r["id"], "name": r["name"]} for r in assigned_rombels]
        }

    except Exception as e:
        frappe.logger("bima_lms").error(f"Error get_course_detail: {str(e)}")
        frappe.throw(f"Gagal mengambil detail mata pelajaran: {str(e)}")

# API untuk mengambil daftar mata pelajaran (courses) berdasarkan user yang sedang login di PostgreSQL
@frappe.whitelist()
def get_user_courses():
    current_user_email = frappe.session.user

    user_roles = frappe.get_roles(current_user_email)
    allowed_roles = ["LMS Admin", "LMS Teacher", "System Manager"]
    
    if not any(role in user_roles for role in allowed_roles):
        frappe.throw("Anda tidak memiliki akses untuk melihat halaman ini.", frappe.PermissionError)

    is_admin = any(role in user_roles for role in ["LMS Admin", "System Manager"])

    try:
        conn = get_pg_connection()
        cursor = conn.cursor()

        pg_user_id = get_current_user_id(conn=conn)

        if not pg_user_id and not is_admin:
            cursor.close()
            conn.close()
            return {"stats": {"total_courses": 0}, "courses": []}

        base_query = """
            SELECT 
                c.course_id,
                c.course_title,
                c.short_description,
                cat.category_name,
                u.user_full_name AS instructor_name
            FROM lms.courses c
            LEFT JOIN master.lms_course_categories cat ON c.category_id = cat.category_id
            LEFT JOIN auth.users u ON c.instructor_id = u.user_id
        """

        if is_admin:
            query = base_query + " ORDER BY c.course_id DESC;"
            cursor.execute(query)
        else:
            query = base_query + " WHERE c.instructor_id = %s ORDER BY c.course_id DESC;"
            cursor.execute(query, (pg_user_id,))

        rows = cursor.fetchall()

        cursor.close()
        conn.close()

        courses = []
        for row in rows:
            courses.append({
                "course_id": row[0],
                "course_title": row[1] or "Tanpa Judul",
                "short_description": row[2] or "Tidak ada deskripsi singkat.",
                "category_name": row[3] or "Umum",
                "instructor_name": row[4] or "Unassigned"
            })

        return {
            "stats": {
                "total_courses": len(courses)
            },
            "is_admin": is_admin,
            "courses": courses
        }

    except Exception as e:
        frappe.logger("bima_lms").error(f"Error get_user_courses: {str(e)}")
        frappe.throw(f"Gagal mengambil data mata pelajaran: {str(e)}")
    
@frappe.whitelist()
def get_course_categories():
    """Mengambil daftar kategori dari PostgreSQL (schema master)"""
    conn = get_pg_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT category_id, category_name 
                FROM "master"."lms_course_categories"
                ORDER BY category_name ASC
            """)
            categories = cur.fetchall()
            return categories
    finally:
        conn.close()

@frappe.whitelist()
def update_course_detail(course_id, course_title, category_id, status=None, short_description=None, full_description=None, embed_video_url=None):
    """Update data course ke PostgreSQL"""
    if not course_id:
        frappe.throw("Course ID tidak ditemukan.")
    if not course_title or not course_title.strip():
        frappe.throw("Judul Course tidak boleh kosong.")
    if not category_id:
        frappe.throw("Kategori wajib dipilih.")

    # Validasi status
    status_value = (status or "DRAFT").upper()
    if status_value not in ["PUBLISHED", "DRAFT"]:
        status_value = "DRAFT"

    current_user_id = get_current_user_id()

    conn = get_pg_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE "lms"."courses"
                SET 
                    course_title = %s,
                    category_id = %s,
                    status = %s,
                    short_description = %s,
                    full_description = %s,
                    video_link = %s,
                    published_on = CASE 
                        WHEN %s = 'PUBLISHED' AND published_on IS NULL THEN NOW() 
                        ELSE published_on 
                    END,
                    last_modified_on = NOW() AT TIME ZONE 'Asia/Jakarta',
                    last_modified_by = %s
                WHERE course_id = %s
            """, (
                course_title.strip(), 
                category_id, 
                status_value,
                short_description, 
                full_description, 
                embed_video_url, 
                status_value,
                current_user_id, 
                course_id
            ))
            
        conn.commit()
        return {"status": "success", "message": "Data course berhasil diperbarui."}
    except Exception as e:
        conn.rollback()
        frappe.throw(f"Gagal memperbarui course: {str(e)}")
    finally:
        conn.close()

# API untuk mengambil daftar rombel yang terkait dengan course_id di PostgreSQL
@frappe.whitelist()
def get_course_rombels(course_id):
    """
    Mengambil seluruh daftar rombel aktif dari master.rombels 
    dan menandai mana yang sudah terhubung dengan course_id di lms.course_rombels.
    """
    if not course_id:
        frappe.throw("Parameter course_id diperlukan.")

    conn = get_pg_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Mengambil semua rombel aktif beserta flag assigned
            cur.execute("""
                SELECT 
                    r.id AS rombel_id,
                    r.name AS rombel_name,
                    r.grade_level,
                    CASE WHEN cr.course_id IS NOT NULL THEN true ELSE false END AS is_assigned
                FROM master.rombels r
                LEFT JOIN lms.course_rombels cr 
                    ON r.id = cr.rombels_id AND cr.course_id = %s
                WHERE r.is_active = true AND (r.is_deleted = false OR r.is_deleted IS NULL)
                ORDER BY r.grade_level ASC, r.name ASC;
            """, (course_id,))
            
            rombels = cur.fetchall()
            return rombels
    except Exception as e:
        frappe.logger("bima_lms").error(f"Error get_course_rombels: {str(e)}")
        frappe.throw(f"Gagal mengambil daftar rombel: {str(e)}")
    finally:
        conn.close()

# API untuk menyimpan atau memperbarui daftar rombel yang di-assign ke course_id di PostgreSQL
@frappe.whitelist()
def save_course_rombels(course_id, rombel_ids=None):
    """
    Menyimpan atau memperbarui daftar rombel yang di-assign ke course.
    """
    if not course_id:
        frappe.throw("Parameter course_id diperlukan.")

    import json

    # Normalisasi rombel_ids agar selalu menjadi Python List
    parsed_rombel_ids = []
    if rombel_ids:
        if isinstance(rombel_ids, str):
            try:
                parsed_rombel_ids = json.loads(rombel_ids)
            except Exception:
                parsed_rombel_ids = []
        elif isinstance(rombel_ids, list):
            parsed_rombel_ids = rombel_ids

    current_user_id = get_current_user_id()
    conn = get_pg_connection()
    
    try:
        with conn.cursor() as cur:
            # 1. Hapus alokasi rombel lama untuk course_id ini
            cur.execute("DELETE FROM lms.course_rombels WHERE course_id = %s;", (course_id,))

            # 2. Insert kembali rombel yang dipilih
            if parsed_rombel_ids:
                insert_query = """
                    INSERT INTO lms.course_rombels (course_id, rombels_id, created_at, created_by)
                    VALUES (%s, %s, NOW() AT TIME ZONE 'Asia/Jakarta', %s);
                """
                # Pastikan bentuk datanya tuple (course_id, rombel_id, created_by)
                records_to_insert = [
                    (course_id, r_id, current_user_id) 
                    for r_id in parsed_rombel_ids if r_id
                ]

                if records_to_insert:
                    cur.executemany(insert_query, records_to_insert)

        conn.commit()
        return {"status": "success", "message": "Penugasan rombel berhasil diperbarui."}

    except Exception as e:
        conn.rollback()
        frappe.logger("bima_lms").error(f"Error save_course_rombels: {str(e)}")
        frappe.throw(f"Gagal menyimpan penugasan rombel: {str(e)}")
    finally:
        conn.close()