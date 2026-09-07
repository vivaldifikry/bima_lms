import frappe
import psycopg2
import json
import re
import os
import shutil
from datetime import datetime
from zoneinfo import ZoneInfo
import psycopg2.extras
from bima_lms.api.courses import get_pg_connection, get_current_user_id, update_course_total_lessons

WIB = ZoneInfo("Asia/Jakarta")


def as_wib_iso(value):
    """Serialize naive database timestamps as explicit WIB timestamps."""
    if not value:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=WIB)
    return value.astimezone(WIB).isoformat()

@frappe.whitelist()
def get_section_detail(section_id, active_student_id=None):
    """
    Mengambil detail section beserta materi (lessons) dan tugas (assignments)
    """
    if not section_id:
        frappe.throw("Parameter section_id diperlukan.", frappe.MandatoryError)

    try:
        conn = get_pg_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        user_roles = frappe.get_roles(frappe.session.user)
        active_student_id = active_student_id or None
        is_builtin_admin = frappe.session.user == "Administrator"
        is_parent = not is_builtin_admin and "LMS Parent" in user_roles
        is_teacher = not is_builtin_admin and "LMS Teacher" in user_roles

        if is_parent and active_student_id:
            cursor.execute("""
                SELECT 1
                FROM auth.parent_student_relations psr
                JOIN auth.users pu ON pu.user_id = psr.parent_user_id
                WHERE pu.user_email = %s AND psr.student_user_id = %s
                LIMIT 1
            """, (frappe.session.user, active_student_id))
            if not cursor.fetchone():
                frappe.throw("Akun anak tidak valid untuk pengguna ini.", frappe.PermissionError)

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
            AND (%s = false OR %s IS NULL OR EXISTS (
                SELECT 1
                FROM lms.course_rombels cr_parent
                JOIN master.rombel_students rs_parent ON rs_parent.rombel_id = cr_parent.rombels_id
                WHERE cr_parent.course_id = s.course_id AND rs_parent.student_id = %s
            ))
        """, (section_id, is_parent, active_student_id, active_student_id))
        
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

        # Get quizzes, questions, and options for this section.
        cursor.execute("""
            SELECT
                q.quiz_id,
                q.quiz_title,
                q.duration_minutes,
                q.passing_grade,
                q.max_attempts_allowed,
                qq.quiz_question_id,
                qq.question_id,
                qq.display_order,
                qq.points_override,
                qb.question_text,
                qb.question_type,
                qb.default_points,
                qo.option_id,
                qo.option_text,
                qo.is_correct
            FROM lms.quizzes q
            LEFT JOIN lms.quiz_questions qq ON qq.quiz_id = q.quiz_id
            LEFT JOIN master.lms_question_bank qb ON qb.question_id = qq.question_id
                AND qb.is_deleted = false
            LEFT JOIN master.lms_question_options qo ON qo.question_id = qb.question_id
            WHERE q.section_id = %s
              AND q.is_deleted = false
            ORDER BY q.quiz_id, qq.display_order ASC, qq.quiz_question_id ASC,
                     qo.option_id ASC
        """, (section_id,))
        quiz_rows = cursor.fetchall()

        quiz_attempts = {}
        if is_parent and active_student_id and quiz_rows:
            quiz_ids = list({row["quiz_id"] for row in quiz_rows})
            cursor.execute("""
                SELECT attempt_id, quiz_id, attempt_number, submitted_at,
                       total_score, result_status
                FROM lms.quiz_attempts
                WHERE student_id = ANY(%s)
                  AND quiz_id = ANY(%s)
                ORDER BY quiz_id, submitted_at DESC NULLS LAST, attempt_id DESC
            """, ([int(active_student_id)], quiz_ids))
            for attempt in cursor.fetchall():
                summary = quiz_attempts.setdefault(attempt["quiz_id"], {
                    "attempt_count": 0,
                    "last_submitted_at": None,
                    "last_total_score": None,
                    "last_result_status": None
                })
                summary["attempt_count"] += 1
                if summary["last_submitted_at"] is None:
                    summary["last_submitted_at"] = as_wib_iso(attempt["submitted_at"])
                    summary["last_total_score"] = float(attempt["total_score"]) if attempt["total_score"] is not None else None
                    summary["last_result_status"] = attempt["result_status"]

        submissions = {}
        if (is_parent or is_teacher) and assignments:
            cursor.execute("""
                SELECT sub.submission_id, sub.assignment_id, sub.submitted_at,
                       sub.file_path, sub.score, sub.feedback_notes,
                       s.full_name AS student_name, s.nisn
                FROM lms.assignment_submissions sub
                JOIN kelaskita.students s ON s.id = sub.student_id
                WHERE sub.assignment_id = ANY(%s)
                  AND (%s = false OR sub.student_id = %s)
                ORDER BY submitted_at DESC
            """, ([assignment["assignment_id"] for assignment in assignments], is_parent, active_student_id))
            for submission in cursor.fetchall():
                if is_parent:
                    submissions.setdefault(submission["assignment_id"], submission)
                else:
                    submissions.setdefault(submission["assignment_id"], []).append(submission)

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
            "assignments": [],
            "quizzes": [],
            "is_parent": is_parent,
            "is_teacher": is_teacher,
            "active_student_id": active_student_id if is_parent else None
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
            parent_submission = submissions.get(assignment["assignment_id"]) if is_parent else {}
            result["assignments"].append({
                "assignment_id": assignment["assignment_id"],
                "course_id": assignment["course_id"],
                "section_id": assignment["section_id"],
                "title": assignment["title"] or "Tanpa Judul",
                "instructions": assignment["instructions"] or "",
                "attachment_url": assignment["attachment_url"] or "",
                "display_order": assignment["display_order"],
                "deadline": assignment["deadline"].isoformat() if assignment["deadline"] else None,
                "max_score": float(assignment["max_score"]) if assignment["max_score"] is not None else 100.0,
                "submitted_at": as_wib_iso((parent_submission or {}).get("submitted_at")),
                "submission_file_path": (parent_submission or {}).get("file_path"),
                "score": float(parent_submission["score"]) if parent_submission and parent_submission["score"] is not None else None,
                "feedback_notes": (parent_submission or {}).get("feedback_notes") or "",
                "submissions": [
                    {
                        "submission_id": submission["submission_id"],
                        "student_name": submission["student_name"] or "Tanpa Nama",
                        "nisn": submission["nisn"] or "-",
                        "submitted_at": as_wib_iso(submission["submitted_at"]),
                        "file_path": submission["file_path"],
                        "score": float(submission["score"]) if submission["score"] is not None else None,
                        "feedback_notes": submission["feedback_notes"] or ""
                    }
                    for submission in (submissions.get(assignment["assignment_id"]) or [])
                ] if is_teacher else []
            })

        quizzes_by_id = {}
        for row in quiz_rows:
            quiz = quizzes_by_id.setdefault(row["quiz_id"], {
                "quiz_id": row["quiz_id"],
                "quiz_title": row["quiz_title"] or "Quiz Tanpa Judul",
                "duration_minutes": row["duration_minutes"] or 0,
                "passing_grade": float(row["passing_grade"]) if row["passing_grade"] is not None else 0,
                "max_attempts_allowed": row["max_attempts_allowed"] or 0,
                "questions": [],
                "attempt_count": quiz_attempts.get(row["quiz_id"], {}).get("attempt_count", 0),
                "last_submitted_at": quiz_attempts.get(row["quiz_id"], {}).get("last_submitted_at"),
                "last_total_score": quiz_attempts.get(row["quiz_id"], {}).get("last_total_score"),
                "last_result_status": quiz_attempts.get(row["quiz_id"], {}).get("last_result_status")
            })
            if row["question_id"] is None:
                continue

            question = next(
                (item for item in quiz["questions"] if item["question_id"] == row["question_id"]),
                None
            )
            if not question:
                question = {
                    "quiz_question_id": row["quiz_question_id"],
                    "question_id": row["question_id"],
                    "question_text": row["question_text"] or "",
                    "question_type": row["question_type"] or "multiple_choice",
                    "points": float(row["points_override"] if row["points_override"] is not None else row["default_points"] or 0),
                    "options": []
                }
                quiz["questions"].append(question)

            if row["option_id"] is not None:
                question["options"].append({
                    "option_id": row["option_id"],
                    "option_text": row["option_text"] or "",
                    "is_correct": bool(row["is_correct"])
                })

        result["quizzes"] = list(quizzes_by_id.values())

        return result

    except Exception as e:
        frappe.logger("bima_lms").error(f"Error get_section_detail: {str(e)}")
        frappe.throw(f"Gagal mengambil detail bab: {str(e)}")


@frappe.whitelist()
def rename_uploaded_file(file_path):
    """Rename an uploaded Frappe file with a unique WIB timestamp."""
    if not file_path or not file_path.startswith(("/files/", "/private/files/")):
        frappe.throw("Lokasi file tidak valid.", frappe.ValidationError)

    file_doc = frappe.db.get_value(
        "File", {"file_url": file_path}, ["name", "file_name", "is_private", "owner"], as_dict=True
    )
    if not file_doc or file_doc.owner != frappe.session.user:
        frappe.throw("File tidak ditemukan atau tidak dapat diubah.", frappe.PermissionError)

    original_name = os.path.basename(file_doc.file_name or file_path.rsplit("/", 1)[-1])
    stem, extension = os.path.splitext(original_name)
    if extension.lower() != ".pdf":
        frappe.throw("File jawaban harus berformat PDF.", frappe.ValidationError)

    timestamp = datetime.now(WIB).strftime("%Y%m%d_%H%M%S_%f")
    new_name = f"{stem}_{timestamp}{extension.lower()}"
    base_path = frappe.get_site_path("private" if file_doc.is_private else "public", "files")
    old_path = os.path.join(base_path, os.path.basename(file_path))
    new_path = os.path.join(base_path, new_name)
    if not os.path.isfile(old_path):
        frappe.throw("File hasil upload tidak ditemukan.", frappe.DoesNotExistError)

    shutil.move(old_path, new_path)
    new_url = f"/private/files/{new_name}" if file_doc.is_private else f"/files/{new_name}"
    frappe.db.set_value("File", file_doc.name, {"file_name": new_name, "file_url": new_url})
    return {"file_url": new_url, "file_name": new_name}


@frappe.whitelist()
def submit_assignment(assignment_id, file_path, student_id=None):
    """Simpan satu submission PDF untuk siswa aktif milik parent."""
    if not assignment_id or not file_path:
        frappe.throw("Assignment dan file jawaban wajib diisi.", frappe.MandatoryError)

    if not str(file_path).lower().endswith(".pdf"):
        frappe.throw("File jawaban harus berformat PDF.", frappe.ValidationError)

    if not student_id:
        frappe.throw("Akun anak belum dipilih.", frappe.PermissionError)

    conn = get_pg_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT 1
                FROM auth.parent_student_relations psr
                JOIN auth.users pu ON pu.user_id = psr.parent_user_id
                WHERE pu.user_email = %s AND psr.student_user_id = %s
                LIMIT 1
            """, (frappe.session.user, student_id))
            if not cur.fetchone():
                frappe.throw("Akun anak tidak valid untuk pengguna ini.", frappe.PermissionError)

            cur.execute("""
                SELECT a.assignment_id, a.deadline
                FROM lms.assignments a
                WHERE a.assignment_id = %s AND a.is_deleted = false
                FOR UPDATE
            """, (assignment_id,))
            assignment = cur.fetchone()
            if not assignment:
                frappe.throw("Tugas tidak ditemukan.", frappe.DoesNotExistError)

            cur.execute("""
                SELECT submission_id, submitted_at
                FROM lms.assignment_submissions
                WHERE assignment_id = %s AND student_id = %s
                LIMIT 1
            """, (assignment_id, student_id))
            existing = cur.fetchone()
            if existing:
                return {
                    "status": "already_submitted",
                    "submitted_at": as_wib_iso(existing["submitted_at"])
                }

            cur.execute("""
                INSERT INTO lms.assignment_submissions
                    (assignment_id, student_id, file_path, submitted_at, is_late,
                     score, feedback_notes, graded_by, graded_at)
                VALUES (%s, %s, %s, NOW() AT TIME ZONE 'Asia/Jakarta',
                    (%s IS NOT NULL AND (NOW() AT TIME ZONE 'Asia/Jakarta') > %s),
                    NULL, NULL, NULL, NULL)
                RETURNING submission_id, submitted_at
            """, (
                assignment_id,
                student_id,
                file_path,
                assignment["deadline"],
                assignment["deadline"]
            ))
            submission = cur.fetchone()
        conn.commit()
        return {
            "status": "success",
            "submission_id": submission["submission_id"],
            "submitted_at": as_wib_iso(submission["submitted_at"])
        }
    except Exception as e:
        conn.rollback()
        frappe.logger("bima_lms").error(f"Error submit_assignment: {str(e)}")
        frappe.throw(f"Gagal mengumpulkan tugas: {str(e)}")
    finally:
        conn.close()


@frappe.whitelist()
def submit_quiz_attempt(quiz_id, student_id, answers=None):
    """Calculate and persist one quiz attempt for the active child account."""
    if not quiz_id or not student_id:
        frappe.throw("Quiz dan akun anak wajib diisi.", frappe.MandatoryError)

    try:
        answers = json.loads(answers) if isinstance(answers, str) else (answers or {})
        answers = {int(question_id): int(option_id) for question_id, option_id in answers.items() if option_id}
    except (TypeError, ValueError, json.JSONDecodeError):
        frappe.throw("Format jawaban quiz tidak valid.", frappe.ValidationError)

    conn = get_pg_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            user_roles = frappe.get_roles(frappe.session.user)
            if frappe.session.user == "Administrator" or "LMS Parent" not in user_roles:
                frappe.throw("Hanya orang tua yang dapat mengirimkan quiz.", frappe.PermissionError)

            cur.execute("""
                SELECT 1
                FROM auth.parent_student_relations psr
                JOIN auth.users pu ON pu.user_id = psr.parent_user_id
                WHERE pu.user_email = %s AND psr.student_user_id = %s
                LIMIT 1
            """, (frappe.session.user, student_id))
            if not cur.fetchone():
                frappe.throw("Akun anak tidak valid untuk pengguna ini.", frappe.PermissionError)

            cur.execute("""
                SELECT quiz_id, section_id, passing_grade, max_attempts_allowed
                FROM lms.quizzes
                WHERE quiz_id = %s AND is_deleted = false
                FOR UPDATE
            """, (quiz_id,))
            quiz = cur.fetchone()
            if not quiz:
                frappe.throw("Quiz tidak ditemukan.", frappe.DoesNotExistError)

            cur.execute("""
                SELECT COUNT(*) AS attempt_count
                FROM lms.quiz_attempts
                WHERE quiz_id = %s AND student_id = %s
            """, (quiz_id, student_id))
            attempt_count = int(cur.fetchone()["attempt_count"])
            max_attempts = int(quiz["max_attempts_allowed"] or 0)
            if attempt_count >= max_attempts:
                frappe.throw("Batas maksimal percobaan quiz sudah tercapai.", frappe.PermissionError)

            cur.execute("""
                SELECT qq.question_id, qq.points_override,
                       qb.default_points, qo.option_id, qo.is_correct
                FROM lms.quiz_questions qq
                JOIN master.lms_question_bank qb ON qb.question_id = qq.question_id
                    AND qb.is_deleted = false
                JOIN master.lms_question_options qo ON qo.question_id = qb.question_id
                WHERE qq.quiz_id = %s
            """, (quiz_id,))
            question_rows = cur.fetchall()
            questions = {}
            for row in question_rows:
                question = questions.setdefault(row["question_id"], {
                    "points": float(row["points_override"] if row["points_override"] is not None else row["default_points"] or 0),
                    "options": {}
                })
                question["options"][row["option_id"]] = bool(row["is_correct"])

            total_score = 0.0
            answer_rows = []
            for question_id, question in questions.items():
                selected_option_id = answers.get(question_id)
                is_correct = bool(selected_option_id and question["options"].get(selected_option_id, False))
                points_earned = question["points"] if is_correct else 0.0
                total_score += points_earned
                answer_rows.append((question_id, selected_option_id, points_earned, is_correct))

            result_status = "Lulus" if total_score >= float(quiz["passing_grade"] or 0) else "Tidak Lulus"
            attempt_number = attempt_count + 1
            cur.execute("""
                INSERT INTO lms.quiz_attempts
                    (quiz_id, student_id, attempt_number, started_at, submitted_at,
                     total_score, result_status)
                VALUES (%s, %s, %s, NOW() AT TIME ZONE 'Asia/Jakarta',
                        NOW() AT TIME ZONE 'Asia/Jakarta', %s, %s)
                RETURNING attempt_id, submitted_at
            """, (quiz_id, student_id, attempt_number, total_score, result_status))
            attempt = cur.fetchone()

            for question_id, selected_option_id, points_earned, is_correct in answer_rows:
                cur.execute("""
                    INSERT INTO lms.quiz_attempt_answers
                        (attempt_id, question_id, selected_option_id, essay_answer,
                         points_earned, is_correct, is_doubtful)
                    VALUES (%s, %s, %s, '-', %s, %s, false)
                """, (attempt["attempt_id"], question_id, selected_option_id,
                      points_earned, is_correct))

        conn.commit()
        return {
            "status": "success",
            "attempt_id": attempt["attempt_id"],
            "attempt_number": attempt_number,
            "submitted_at": as_wib_iso(attempt["submitted_at"]),
            "total_score": total_score,
            "result_status": result_status
        }
    except Exception as e:
        conn.rollback()
        frappe.logger("bima_lms").error(f"Error submit_quiz_attempt: {str(e)}")
        frappe.throw(f"Gagal menyimpan hasil quiz: {str(e)}")
    finally:
        conn.close()


@frappe.whitelist()
def grade_assignment_submission(submission_id, score, feedback_notes=None):
    """Simpan nilai dan catatan guru untuk satu submission."""
    if not submission_id:
        frappe.throw("Submission tidak ditemukan.", frappe.MandatoryError)

    user_roles = frappe.get_roles(frappe.session.user)
    is_admin = frappe.session.user == "Administrator" or any(
        role in user_roles for role in ["LMS Admin", "System Manager"]
    )
    if not is_admin and "LMS Teacher" not in user_roles:
        frappe.throw("Anda tidak memiliki akses untuk menilai tugas.", frappe.PermissionError)

    try:
        from decimal import Decimal, InvalidOperation
        score_value = Decimal(str(score))
        if not score_value.is_finite():
            raise InvalidOperation
    except (InvalidOperation, TypeError, ValueError):
        frappe.throw("Nilai harus berupa angka.", frappe.ValidationError)

    conn = get_pg_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            current_user_id = get_current_user_id(conn)
            cur.execute("""
                SELECT sub.submission_id, a.max_score, c.instructor_id
                FROM lms.assignment_submissions sub
                JOIN lms.assignments a ON a.assignment_id = sub.assignment_id
                JOIN lms.course_sections cs ON cs.section_id = a.section_id
                JOIN lms.courses c ON c.course_id = cs.course_id
                WHERE sub.submission_id = %s AND a.is_deleted = false
                FOR UPDATE
            """, (submission_id,))
            submission = cur.fetchone()
            if not submission:
                frappe.throw("Submission tidak ditemukan.", frappe.DoesNotExistError)
            if not is_admin and submission["instructor_id"] != current_user_id:
                frappe.throw("Anda hanya dapat menilai tugas pada course sendiri.", frappe.PermissionError)

            max_score = Decimal(str(submission["max_score"] or 100))
            if score_value < 0 or score_value > max_score:
                frappe.throw(f"Nilai harus berada di antara 0 dan {max_score}.", frappe.ValidationError)

            cur.execute("""
                UPDATE lms.assignment_submissions
                SET score = %s,
                    feedback_notes = %s,
                    graded_by = %s,
                    graded_at = NOW() AT TIME ZONE 'Asia/Jakarta'
                WHERE submission_id = %s
            """, (score_value, feedback_notes or None, current_user_id, submission_id))
        conn.commit()
        return {"status": "success", "message": "Nilai berhasil disimpan."}
    except Exception as e:
        conn.rollback()
        frappe.logger("bima_lms").error(f"Error grade_assignment_submission: {str(e)}")
        frappe.throw(f"Gagal menyimpan nilai: {str(e)}")
    finally:
        conn.close()


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

        update_course_total_lessons(cursor, course_id)

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
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, false)
                    """, (course_id, section_id, title, instructions, attachment_url, deadline, max_score, display_order, current_user_id))

        conn.commit()
        cursor.close()
        conn.close()

        return {"status": "success", "message": "Berhasil memperbarui data bab, materi, dan tugas."}

    except Exception as e:
        frappe.logger("bima_lms").error(f"Error batch_save_section_detail: {str(e)}")
        frappe.throw(f"Gagal menyimpan data: {str(e)}")