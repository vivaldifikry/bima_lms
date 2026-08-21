import frappe
import psycopg2
import json
import re
import psycopg2.extras
from bima_lms.api.courses import get_pg_connection

@frappe.whitelist()
def get_section_detail(section_id):
    """
    Mengambil detail section beserta semua lesson-nya
    """
    if not section_id:
        frappe.throw("Parameter section_id diperlukan.", frappe.MandatoryError)

    try:
        conn = get_pg_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # 1. Get section detail
        cursor.execute("""
            SELECT 
                s.section_id,
                s.course_id,
                s.section_title,
                s.description,
                s.display_order,
                c.course_title
            FROM lms.course_sections s
            LEFT JOIN lms.courses c ON s.course_id = c.course_id
            WHERE s.section_id = %s 
            AND s.is_deleted = false
        """, (section_id,))
        
        section = cursor.fetchone()
        
        if not section:
            cursor.close()
            conn.close()
            frappe.throw("Bab tidak ditemukan.", frappe.DoesNotExistError)

        # 2. Get all lessons for this section
        cursor.execute("""
            SELECT 
                lesson_id,
                section_id,
                lesson_title,
                lesson_type,
                article_content,
                pdf_attachment_url,
                video_provider,
                video_url,
                estimated_duration_minutes,
                min_watch_percentage,
                display_order,
                is_deleted,
                lesson_code,
                is_preview
            FROM lms.course_lessons
            WHERE section_id = %s 
            AND is_deleted = false
            ORDER BY display_order ASC, lesson_id ASC
        """, (section_id,))
        
        lessons = cursor.fetchall()

        cursor.close()
        conn.close()

        # Format response
        result = {
            "section_id": section["section_id"],
            "course_id": section["course_id"],
            "course_title": section["course_title"],
            "section_title": section["section_title"] or "",
            "description": section["description"] or "",
            "display_order": section["display_order"],
            "lessons": []
        }

        for lesson in lessons:
            result["lessons"].append({
                "lesson_id": lesson["lesson_id"],
                "section_id": lesson["section_id"],
                "lesson_title": lesson["lesson_title"] or "Tanpa Judul",
                "lesson_type": normalize_lesson_types(lesson["lesson_type"]),
                "article_content": lesson["article_content"] or "",
                "pdf_attachment_url": lesson["pdf_attachment_url"] or "",
                "video_provider": lesson["video_provider"],
                "video_url": lesson["video_url"] or "",
                "embed_video_url": get_embed_video_url(lesson["video_url"]) if lesson["video_url"] else None,
                "estimated_duration_minutes": lesson["estimated_duration_minutes"] or 0,
                "min_watch_percentage": lesson["min_watch_percentage"] or 0,
                "display_order": lesson["display_order"],
                "is_preview": lesson["is_preview"] or False,
                "lesson_code": lesson["lesson_code"] or ""
            })

        return result

    except Exception as e:
        frappe.logger("bima_lms").error(f"Error get_section_detail: {str(e)}")
        frappe.throw(f"Gagal mengambil detail bab: {str(e)}")


def get_embed_video_url(url):
    """Convert YouTube/Vimeo URL to embed URL"""
    if not url:
        return None
    
    # YouTube
    youtube_match = re.search(r'(?:youtu\.be/|youtube\.com/(?:watch\?v=|embed/|v/|shorts/))([\w-]{11})', url)
    if youtube_match:
        return f"https://www.youtube.com/embed/{youtube_match.group(1)}"
    
    # Vimeo
    vimeo_match = re.search(r'vimeo\.com/(\d+)', url)
    if vimeo_match:
        return f"https://player.vimeo.com/video/{vimeo_match.group(1)}"
    
    return url


def normalize_lesson_types(value):
    """Return lesson types as a normalized comma-separated string."""
    allowed_types = {"ARTICLE", "PDF", "VIDEO"}
    raw_types = value if isinstance(value, (list, tuple)) else str(value or "ARTICLE").split(",")
    types = []
    for raw_type in raw_types:
        lesson_type = str(raw_type).strip().upper()
        if lesson_type in allowed_types and lesson_type not in types:
            types.append(lesson_type)
    return ", ".join(types or ["ARTICLE"])


@frappe.whitelist()
def batch_save_lessons(section_id, section_title=None, description=None, lessons=None, deleted_lesson_ids=None):
    """
    Menyimpan detail section dan daftar lesson secara batch via PostgreSQL.
    """
    if not section_id:
        frappe.throw("Parameter section_id diperlukan.")

    if isinstance(lessons, str):
        lessons = json.loads(lessons)
    if isinstance(deleted_lesson_ids, str):
        deleted_lesson_ids = json.loads(deleted_lesson_ids)
    deleted_lesson_ids = deleted_lesson_ids or []

    try:
        conn = get_pg_connection()
        cursor = conn.cursor()

        # 1. Update Detail Bab (Judul & Deskripsi)
        if section_title is not None:
            cursor.execute("""
                UPDATE lms.course_sections
                SET 
                    section_title = %s,
                    description = %s
                WHERE section_id = %s
            """, (section_title, description or "", section_id))

        # 2. Soft-delete lessons removed in the editor.
        if deleted_lesson_ids:
            cursor.execute("""
                UPDATE lms.course_lessons
                SET is_deleted = true
                WHERE section_id = %s AND lesson_id = ANY(%s)
            """, (section_id, [int(lesson_id) for lesson_id in deleted_lesson_ids]))

        # 3. Update every remaining lesson and preserve the editor order.
        if lessons:
            for display_order, lesson in enumerate(lessons, start=1):
                lesson_id = lesson.get("lesson_id")
                lesson_title = lesson.get("lesson_title")
                lesson_type = normalize_lesson_types(lesson.get("lesson_type"))
                article_content = lesson.get("article_content", "")
                pdf_attachment_url = lesson.get("pdf_attachment_url", "")
                video_url = lesson.get("video_url", "")

                cursor.execute("""
                    UPDATE lms.course_lessons
                    SET 
                        lesson_title = %s,
                        lesson_type = %s,
                        article_content = %s,
                        pdf_attachment_url = %s,
                        video_url = %s,
                        display_order = %s
                    WHERE lesson_id = %s AND section_id = %s AND is_deleted = false
                """, (
                    lesson_title,
                    lesson_type,
                    article_content,
                    pdf_attachment_url,
                    video_url,
                    display_order,
                    lesson_id,
                    section_id
                ))

        conn.commit()
        cursor.close()
        conn.close()

        return {"status": "success", "message": "Berhasil memperbarui data bab dan materi."}

    except Exception as e:
        frappe.logger("bima_lms").error(f"Error batch_save_lessons: {str(e)}")
        frappe.throw(f"Gagal menyimpan materi: {str(e)}")


@frappe.whitelist()
def get_lesson_types():
    """Mengambil daftar tipe lesson yang tersedia"""
    return [
        {"value": "ARTICLE", "label": "Artikel"},
        {"value": "PDF", "label": "PDF"},
        {"value": "VIDEO", "label": "Video"}
    ]