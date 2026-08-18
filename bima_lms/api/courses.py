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
        conn = get_pg_connection() # Menggunakan fungsi get_pg_connection / psycopg2.connect(**get_db_config())
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
        conn = psycopg2.connect(**get_db_config())
        cursor = conn.cursor()

        # Dapatkan pg_user_id
        cursor.execute("SELECT user_id FROM auth.users WHERE user_email = %s AND is_deleted = false LIMIT 1;", (current_user_email,))
        pg_user = cursor.fetchone()
        pg_user_id = pg_user[0] if pg_user else None

        # Query detail course
        query = """
            SELECT 
                c.course_id,
                c.course_title,
                c.short_description,
                c.full_description,
                c.video_link,
                cat.category_name,
                u.user_full_name AS instructor_name,
                c.instructor_id
            FROM lms.courses c
            LEFT JOIN master.lms_course_categories cat ON c.category_id = cat.category_id
            LEFT JOIN auth.users u ON c.instructor_id = u.user_id
            WHERE c.course_id = %s
        """
        
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

        video_raw = row[4] or ""
        embed_video = get_embed_video_url(video_raw)

        return {
            "course_id": row[0],
            "course_title": row[1] or "Tanpa Judul",
            "short_description": row[2] or "",
            "full_description": row[3] or "Belum ada deskripsi lengkap.",
            "video_link": video_raw,
            "embed_video_url": embed_video,
            "category_name": row[5] or "Umum",
            "instructor_name": row[6] or "Unassigned"
        }

    except Exception as e:
        frappe.logger("bima_lms").error(f"Error get_course_detail: {str(e)}")
        frappe.throw(f"Gagal mengambil detail mata pelajaran: {str(e)}")

# API untuk mengambil daftar mata pelajaran (courses) berdasarkan user yang sedang login di PostgreSQL
@frappe.whitelist()
def get_user_courses():
    """
    Mengambil statistik dan daftar mata pelajaran (courses) dari PostgreSQL
    berdasarkan user yang sedang login.
    """
    current_user_email = frappe.session.user

    # 1. Validasi Role Access
    user_roles = frappe.get_roles(current_user_email)
    allowed_roles = ["LMS Admin", "LMS Teacher", "System Manager"]
    
    if not any(role in user_roles for role in allowed_roles):
        frappe.throw("Anda tidak memiliki akses untuk melihat halaman ini.", frappe.PermissionError)

    is_admin = any(role in user_roles for role in ["LMS Admin", "System Manager"])

    try:
        conn = get_pg_connection()
        cursor = conn.cursor()

        # 2. Dapatkan user_id PostgreSQL menggunakan helper function
        pg_user_id = get_current_user_id(conn=conn)

        if not pg_user_id and not is_admin:
            cursor.close()
            conn.close()
            return {"stats": {"total_courses": 0}, "courses": []}

        # 3. Query Data Courses + Categories + Instructors
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
            # Admin melihat semua course
            query = base_query + " ORDER BY c.course_id DESC;"
            cursor.execute(query)
        else:
            # Guru hanya melihat course yang diampunya
            query = base_query + " WHERE c.instructor_id = %s ORDER BY c.course_id DESC;"
            cursor.execute(query, (pg_user_id,))

        rows = cursor.fetchall()

        cursor.close()
        conn.close()

        # 4. Format Output Data
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
    
# API untuk mengambil daftar kategori course di dropdown edit course
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

# API untuk menyimpan pembaruan data course di halaman edit course
@frappe.whitelist()
def update_course_detail(course_id, course_title, category_id, short_description=None, full_description=None, embed_video_url=None):
    """Update data course ke PostgreSQL menggunakan nama kolom last_modified_on & last_modified_by"""
    if not course_id:
        frappe.throw("Course ID tidak ditemukan.")
    if not course_title or not course_title.strip():
        frappe.throw("Judul Course tidak boleh kosong.")
    if not category_id:
        frappe.throw("Kategori wajib dipilih.")

    current_user_id = get_current_user_id()

    conn = get_pg_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE "lms"."courses"
                SET 
                    course_title = %s,
                    category_id = %s,
                    short_description = %s,
                    full_description = %s,
                    video_link = %s,
                    last_modified_on = NOW(),
                    last_modified_by = %s
                WHERE course_id = %s
            """, (
                course_title.strip(), 
                category_id, 
                short_description, 
                full_description, 
                embed_video_url, 
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