import frappe
import psycopg2
import psycopg2.extras
from bima_lms.auth import get_db_config

def get_pg_connection():
    """Membuka koneksi ke database PostgreSQL berdasarkan konfigurasi Frappe."""
    return psycopg2.connect(**get_db_config())

@frappe.whitelist()
def get_course_sections(course_id):
    """
    Mengambil daftar bab/section berdasarkan course_id.
    """
    if not course_id:
        frappe.throw("Parameter course_id wajib diisi.")

    try:
        conn = get_pg_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        query = """
            SELECT 
                section_id,
                course_id,
                section_title,
                description
            FROM lms.course_sections
            WHERE course_id = %s AND is_deleted = false;
        """
        
        cursor.execute(query, (course_id,))
        rows = cursor.fetchall()

        cursor.close()
        conn.close()

        sections = []
        for row in rows:
            sections.append({
                "section_id": row["section_id"],
                "course_id": row["course_id"],
                "section_title": row["section_title"] or "Bab Tanpa Judul",
                "description": row["description"] or ""
            })

        return sections

    except Exception as e:
        frappe.logger("bima_lms").error(f"Error get_course_sections: {str(e)}")
        frappe.throw(f"Gagal mengambil data section/bab: {str(e)}")