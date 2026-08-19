import psycopg2
import psycopg2.extras
import frappe
from bima_lms.api.courses import get_pg_connection, get_current_user_id

@frappe.whitelist()
def get_my_students():
    """
    Mengambil daftar anak dari Orang Tua yang sedang login berdasarkan:
    - auth.users (mencari parent_user_id dari email session)
    - auth.parent_student_relations
    - kelaskita.students
    """
    current_user_email = frappe.session.user
    if not current_user_email or current_user_email == "Guest":
        frappe.throw("Akses ditolak. Silakan login terlebih dahulu.", frappe.PermissionError)

    conn = get_pg_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # 1. Cari parent_user_id
            cur.execute("""
                SELECT user_id 
                FROM auth.users 
                WHERE user_email = %s AND is_deleted = false 
                LIMIT 1;
            """, (current_user_email,))
            parent = cur.fetchone()

            if not parent:
                return []

            parent_user_id = parent["user_id"]

            # 2. Query daftar anak beserta detail student
            query = """
                SELECT 
                    s.id AS student_id,
                    s.full_name AS student_name,
                    s.nisn,
                    s.nis,
                    s.gender,
                    psr.relationship_type
                FROM auth.parent_student_relations psr
                JOIN kelaskita.students s ON psr.student_user_id = s.id
                WHERE psr.parent_user_id = %s
                ORDER BY s.full_name ASC;
            """
            cur.execute(query, (parent_user_id,))
            students = cur.fetchall()

            return students

    except Exception as e:
        frappe.logger("bima_lms").error(f"Error get_my_students: {str(e)}")
        frappe.throw(f"Gagal mengambil data anak: {str(e)}")
    finally:
        conn.close()


@frappe.whitelist()
def validate_parent_student_access(student_id):
    """
    Memastikan student_id yang dikirim dari client memang sah anak dari parent_user_id yang login.
    """
    if not student_id:
        return False

    current_user_email = frappe.session.user
    conn = get_pg_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 1
                FROM auth.parent_student_relations psr
                JOIN auth.users u ON psr.parent_user_id = u.user_id
                WHERE u.user_email = %s AND psr.student_user_id = %s
                LIMIT 1;
            """, (current_user_email, student_id))
            return cur.fetchone() is not None
    finally:
        conn.close()