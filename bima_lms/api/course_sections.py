import frappe
import psycopg2
import psycopg2.extras
from bima_lms.auth import get_db_config

def get_pg_connection():
    """Membuka koneksi ke database PostgreSQL berdasarkan konfigurasi Frappe."""
    return psycopg2.connect(**get_db_config())

def get_current_user_id():
    current_user_email = frappe.session.user
    if not current_user_email:
        return None
    conn = get_pg_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT user_id FROM auth.users WHERE user_email = %s AND is_deleted = false LIMIT 1;", (current_user_email,))
            row = cur.fetchone()
            return row[0] if row else None
    finally:
        conn.close()

@frappe.whitelist()
def get_course_sections(course_id):
    """Mengambil daftar bab/section berdasarkan course_id."""
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
                description,
                display_order
            FROM lms.course_sections
            WHERE course_id = %s AND is_deleted = false
            ORDER BY display_order ASC, section_id ASC;
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
                "description": row["description"] or "",
                "display_order": row["display_order"]
            })

        return sections

    except Exception as e:
        frappe.logger("bima_lms").error(f"Error get_course_sections: {str(e)}")
        frappe.throw(f"Gagal mengambil data section/bab: {str(e)}")

@frappe.whitelist()
def batch_save_course_sections(course_id, sections_data, deleted_section_ids=None):
    """
    Menyimpan seluruh perubahan daftar bab (Update, Insert Baru, Reorder, dan Soft-Delete) sekaligus.
    - `sections_data`: JSON string list object bab yang aktif.
    - `deleted_section_ids`: JSON string list ID bab yang dihapus pengguna di UI.
    """
    if not course_id:
        frappe.throw("Course ID diperlukan.")

    if isinstance(sections_data, str):
        sections_data = frappe.parse_json(sections_data) or []

    if isinstance(deleted_section_ids, str):
        deleted_section_ids = frappe.parse_json(deleted_section_ids) or []

    current_user_id = get_current_user_id()
    conn = get_pg_connection()

    try:
        with conn.cursor() as cur:
            # 1. Eksekusi Soft-Delete untuk bab yang ditandai hapus di UI
            valid_deleted_ids = [s_id for s_id in deleted_section_ids if s_id and not str(s_id).startswith("temp_")]
            if valid_deleted_ids:
                cur.execute("""
                    UPDATE lms.course_sections
                    SET is_deleted = true
                    WHERE section_id = ANY(%s) AND course_id = %s
                """, (valid_deleted_ids, course_id))

            # 2. Insert atau Update untuk bab yang aktif
            for index, sec in enumerate(sections_data, start=1):
                sec_id = sec.get("section_id")
                title = (sec.get("section_title") or "").strip()
                desc = (sec.get("description") or "").strip()

                if not title:
                    title = f"Bab {index}"

                # Cek jika ID bertipe temporary (misal "temp_123") -> INSERT
                if sec_id and str(sec_id).startswith("temp_"):
                    cur.execute("""
                        INSERT INTO lms.course_sections (
                            course_id, section_title, description, display_order, is_deleted
                        ) VALUES (%s, %s, %s, %s, false)
                    """, (course_id, title, desc, index))
                else:
                    # Update data yang sudah ada (tanpa trailing comma)
                    cur.execute("""
                        UPDATE lms.course_sections
                        SET section_title = %s,
                            description = %s,
                            display_order = %s
                        WHERE section_id = %s AND course_id = %s
                    """, (title, desc, index, sec_id, course_id))

        conn.commit()
        return {"status": "success", "message": "Daftar bab berhasil diperbarui."}
    except Exception as e:
        conn.rollback()
        frappe.logger("bima_lms").error(f"Error batch_save_course_sections: {str(e)}")
        frappe.throw(f"Gagal memperbarui daftar bab: {str(e)}")
    finally:
        conn.close()

@frappe.whitelist()
def delete_course_section(section_id):
    """Soft-delete section/bab secara individual"""
    if not section_id:
        frappe.throw("Section ID tidak ditemukan.")

    conn = get_pg_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE lms.course_sections
                SET is_deleted = true
                WHERE section_id = %s
            """, (section_id,))
        conn.commit()
        return {"status": "success", "message": "Bab berhasil dihapus."}
    except Exception as e:
        conn.rollback()
        frappe.throw(f"Gagal menghapus bab: {str(e)}")
    finally:
        conn.close()