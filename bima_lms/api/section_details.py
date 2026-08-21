import frappe
import psycopg2
import json
import re
import psycopg2.extras
from bima_lms.api.courses import get_pg_connection, get_current_user_id

@frappe.whitelist()
def get_section_detail(section_id):
    """
    Mengambil detail section beserta materi (lessons) dan tugas (assignments)
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

        # 3. Get all assignments for this section
        cursor.execute("""
            SELECT 
                assignment_id,
                course_id,
                section_id,
                title,
                instructions,
                attachment_url,
                deadline,
                max_score,
                display_order
            FROM lms.assignments
            WHERE section_id = %s 
            AND is_deleted = false
            ORDER BY display_order ASC, assignment_id ASC
        """, (section_id,))

        assignments = cursor.fetchall()

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
            "lessons": [],
            "assignments": []
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

        for assignment in assignments:
            result["assignments"].append({
                "assignment_id": assignment["assignment_id"],
                "course_id": assignment["course_id"],
                "section_id": assignment["section_id"],
                "title": assignment["title"] or "Tanpa Judul",
                "instructions": assignment["instructions"] or "",
                "attachment_url": assignment["attachment_url"] or "",
                "display_order": assignment["display_order"],
                "deadline": assignment["deadline"].isoformat() if assignment["deadline"] else None,
                "max_score": float(assignment["max_score"]) if assignment["max_score"] is not None else 100.0
            })

        return result

    except Exception as e:
        frappe.logger("bima_lms").error(f"Error get_section_detail: {str(e)}")
        frappe.throw(f"Gagal mengambil detail bab: {str(e)}")


def get_embed_video_url(url):
    if not url:
        return None
    youtube_match = re.search(r'(?:youtu\.be/|youtube\.com/(?:watch\?v=|embed/|v/|shorts/))([\w-]{11})', url)
    if youtube_match:
        return f"https://www.youtube.com/embed/{youtube_match.group(1)}"
    vimeo_match = re.search(r'vimeo\.com/(\d+)', url)
    if vimeo_match:
        return f"https://player.vimeo.com/video/{vimeo_match.group(1)}"
    return url


def normalize_lesson_types(value):
    allowed_types = {"ARTICLE", "PDF", "VIDEO"}
    raw_types = value if isinstance(value, (list, tuple)) else str(value or "ARTICLE").split(",")
    types = []
    for raw_type in raw_types:
        lesson_type = str(raw_type).strip().upper()
        if lesson_type in allowed_types and lesson_type not in types:
            types.append(lesson_type)
    return ", ".join(types or ["ARTICLE"])


@frappe.whitelist()
def batch_save_section_detail(section_id, section_title=None, description=None, lessons=None, deleted_lesson_ids=None, assignments=None, deleted_assignment_ids=None):
    """
    Menyimpan detail section, daftar lesson, dan daftar assignment (tugas) secara batch.
    """
    if not section_id:
        frappe.throw("Parameter section_id diperlukan.")

    if isinstance(lessons, str):
        lessons = json.loads(lessons)
    if isinstance(deleted_lesson_ids, str):
        deleted_lesson_ids = json.loads(deleted_lesson_ids)
    if isinstance(assignments, str):
        assignments = json.loads(assignments)
    if isinstance(deleted_assignment_ids, str):
        deleted_assignment_ids = json.loads(deleted_assignment_ids)

    deleted_lesson_ids = deleted_lesson_ids or []
    deleted_assignment_ids = deleted_assignment_ids or []

    try:
        conn = get_pg_connection()
        cursor = conn.cursor()

        # Ambil user_id numerik dari session Frappe via courses.py
        current_user_id = get_current_user_id(conn)

        # Fallback jika user ID tidak ditemukan dari session
        if not current_user_id:
            cursor.execute("SELECT user_id FROM auth.users WHERE is_deleted = false ORDER BY user_id ASC LIMIT 1;")
            user_row = cursor.fetchone()
            current_user_id = user_row[0] if user_row else 1

        # 1. Update Detail Bab (Judul & Deskripsi)
        if section_title is not None:
            cursor.execute("""
                UPDATE lms.course_sections
                SET 
                    section_title = %s,
                    description = %s
                WHERE section_id = %s
            """, (section_title, description or "", section_id))

        # 2. Ambil course_id dari section
        cursor.execute("SELECT course_id FROM lms.course_sections WHERE section_id = %s", (section_id,))
        sec_row = cursor.fetchone()
        course_id = sec_row[0] if sec_row else None

        # 3. Handle Lessons (Soft Delete & Insert/Update)
        if deleted_lesson_ids:
            cursor.execute("""
                UPDATE lms.course_lessons
                SET is_deleted = true
                WHERE section_id = %s AND lesson_id = ANY(%s)
            """, (section_id, [int(lid) for lid in deleted_lesson_ids]))

        if lessons:
            for display_order, lesson in enumerate(lessons, start=1):
                lesson_id = lesson.get("lesson_id")
                lesson_title = lesson.get("lesson_title")
                lesson_type = normalize_lesson_types(lesson.get("lesson_type"))
                article_content = lesson.get("article_content", "")
                pdf_attachment_url = lesson.get("pdf_attachment_url", "")
                video_url = lesson.get("video_url", "")

                if lesson_id:
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
                    """, (lesson_title, lesson_type, article_content, pdf_attachment_url, video_url, display_order, lesson_id, section_id))
                else:
                    cursor.execute("""
                        INSERT INTO lms.course_lessons (
                            section_id, lesson_title, lesson_type, article_content, pdf_attachment_url, video_url, display_order, is_deleted
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, false)
                    """, (section_id, lesson_title, lesson_type, article_content, pdf_attachment_url, video_url, display_order))

        # 4. Handle Assignments (Soft Delete & Insert/Update)
        if deleted_assignment_ids:
            cursor.execute("""
                UPDATE lms.assignments
                SET is_deleted = true
                WHERE section_id = %s AND assignment_id = ANY(%s)
            """, (section_id, [int(aid) for aid in deleted_assignment_ids]))

        if assignments:
            for display_order, assignment in enumerate(assignments, start=1):
                assignment_id = assignment.get("assignment_id")
                title = assignment.get("title")
                instructions = assignment.get("instructions", "")
                attachment_url = assignment.get("attachment_url", "")
                deadline = assignment.get("deadline") or None
                max_score = assignment.get("max_score") or 100

                if assignment_id:
                    cursor.execute("""
                        UPDATE lms.assignments
                        SET 
                            title = %s,
                            instructions = %s,
                            attachment_url = %s,
                            deadline = %s,
                            max_score = %s,
                            display_order = %s
                        WHERE assignment_id = %s AND section_id = %s AND is_deleted = false
                    """, (title, instructions, attachment_url, deadline, max_score, display_order, assignment_id, section_id))
                else:
                    cursor.execute("""
                        INSERT INTO lms.assignments (
                            course_id, section_id, title, instructions, attachment_url, deadline, max_score, display_order, created_by, is_deleted
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, false)
                    """, (course_id, section_id, title, instructions, attachment_url, deadline, max_score, display_order, current_user_id))

        conn.commit()
        cursor.close()
        conn.close()

        return {"status": "success", "message": "Berhasil memperbarui data bab, materi, dan tugas."}

    except Exception as e:
        frappe.logger("bima_lms").error(f"Error batch_save_section_detail: {str(e)}")
        frappe.throw(f"Gagal menyimpan data: {str(e)}")