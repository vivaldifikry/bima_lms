import psycopg2
import frappe
from bima_lms.auth import get_db_config

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
        conn = psycopg2.connect(**get_db_config())
        cursor = conn.cursor()

        # 2. Dapatkan user_id PostgreSQL dari email session
        cursor.execute("SELECT user_id FROM auth.users WHERE user_email = %s AND is_deleted = false LIMIT 1;", (current_user_email,))
        pg_user = cursor.fetchone()

        if not pg_user and not is_admin:
            return {"stats": {"total_courses": 0}, "courses": []}

        pg_user_id = pg_user[0] if pg_user else None

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