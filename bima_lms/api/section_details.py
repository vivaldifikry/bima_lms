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
import boto3
import base64
import io
from botocore.client import Config

WIB = ZoneInfo("Asia/Jakarta")

def get_minio_config():
    """Mendapatkan konfigurasi MinIO dinamis dari site_config.json"""
    return {
        "ACCESS_KEY": frappe.conf.get("minio_access_key"),
        "SECRET_KEY": frappe.conf.get("minio_secret_key"),
        "ENDPOINT_URL": frappe.conf.get("minio_endpoint_url"),
        "BUCKET_NAME": frappe.conf.get("minio_bucket_name"),
        "REGION": frappe.conf.get("minio_region", "ap-southeast-1")
    }

def get_minio_client():
    """Membuat instance client boto3 S3 untuk MinIO"""
    cfg = get_minio_config()
    return boto3.client(
        's3',
        endpoint_url=cfg["ENDPOINT_URL"],
        aws_access_key_id=cfg["ACCESS_KEY"],
        aws_secret_access_key=cfg["SECRET_KEY"],
        config=Config(
            signature_version='s3v4',
            s3={'addressing_style': 'path'} # Membantu menghindari isu routing proxy S3
        ),
        region_name=cfg["REGION"]
    )


QUIZ_MEDIA_ALLOWED_IMAGES = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
QUIZ_MEDIA_MAX_BYTES = 5 * 1024 * 1024  # 5 MB

def _detect_content_type(ext):
    ext = ext.lower()
    if ext in (".jpg", ".jpeg"):
        return "image/jpeg"
    if ext == ".png":
        return "image/png"
    if ext == ".webp":
        return "image/webp"
    if ext == ".gif":
        return "image/gif"
    if ext == ".pdf":
        return "application/pdf"
    return "application/octet-stream"

def generate_minio_presigned_url(object_name, expires_in=3600):
    """Generates a presigned URL to view/download private MinIO objects."""
    if not object_name:
        return ""
    if object_name.startswith(("/files/", "/private/files/", "http://", "https://")):
        return object_name
    try:
        cfg = get_minio_config()
        s3_client = get_minio_client()
        url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': cfg["BUCKET_NAME"], 'Key': object_name},
            ExpiresIn=expires_in
        )
        return url
    except Exception as e:
        frappe.logger("bima_lms").error(f"Error generating presigned URL for {object_name}: {str(e)}")
        return ""


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
                q.display_order,
                qq.quiz_question_id,
                qq.question_id,
                qq.display_order,
                qq.points_override,
                qb.question_text,
                qb.question_type,
                qb.default_points,
                qb.url_image,
                qb.url_pdf,
                qb.url_video,
                qo.option_id,
                qo.option_text,
                qo.is_correct
            FROM lms.quizzes q
            LEFT JOIN lms.quiz_questions qq ON qq.quiz_id = q.quiz_id
            LEFT JOIN master.lms_question_bank qb ON qb.question_id = qq.question_id
                AND qb.is_deleted = false
            LEFT JOIN master.lms_question_options qo ON qo.question_id = qb.question_id
                AND qo.is_deleted = false
            WHERE q.section_id = %s
              AND q.is_deleted = false
            ORDER BY q.display_order ASC NULLS LAST, q.quiz_id,
                     qq.display_order ASC, qq.quiz_question_id ASC,
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
            parent_file_path = (parent_submission or {}).get("file_path")
            
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
                "submission_file_path": generate_minio_presigned_url(parent_file_path) if parent_file_path else None,
                "score": float(parent_submission["score"]) if parent_submission and parent_submission["score"] is not None else None,
                "feedback_notes": (parent_submission or {}).get("feedback_notes") or "",
                "submissions": [
                    {
                        "submission_id": submission["submission_id"],
                        "student_name": submission["student_name"] or "Tanpa Nama",
                        "nisn": submission["nisn"] or "-",
                        "submitted_at": as_wib_iso(submission["submitted_at"]),
                        "file_path": generate_minio_presigned_url(submission["file_path"]),
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
                "display_order": row["display_order"] or 0,
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
                raw_image = row.get("url_image")
                raw_pdf = row.get("url_pdf")
                raw_video = row.get("url_video")

                question = {
                    "quiz_question_id": row["quiz_question_id"],
                    "question_id": row["question_id"],
                    "question_text": row["question_text"] or "",
                    "question_type": row["question_type"] or "multiple_choice",
                    "points": float(row["points_override"] if row["points_override"] is not None else row["default_points"] or 0),
                    "url_image_raw": raw_image or "",
                    "url_pdf_raw": raw_pdf or "",
                    "url_video": raw_video or "",
                    "url_image": generate_minio_presigned_url(raw_image) if raw_image else "",
                    "url_pdf": generate_minio_presigned_url(raw_pdf) if raw_pdf else "",
                    "embed_video_url": get_embed_video_url(raw_video) if raw_video else "",
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
def submit_assignment_minio(assignment_id, student_id, file_name, file_data):
    """
    Upload file PDF langsung ke MinIO dengan format penamaan nama_timestamp.pdf
    dan simpan nama object MinIO ke database PostgreSQL.
    """
    if not assignment_id or not student_id or not file_data or not file_name:
        frappe.throw("Parameter tugas, siswa, dan file wajib diisi.", frappe.MandatoryError)

    if not str(file_name).lower().endswith(".pdf"):
        frappe.throw("File jawaban harus berformat PDF.", frappe.ValidationError)

    try:
        # Format penamaan file: (current_file_name_timestamp)
        original_stem, ext = os.path.splitext(file_name)
        timestamp = datetime.now(WIB).strftime("%Y%m%d_%H%M%S_%f")

        # Tambahkan prefix folder 'lms_assignments/' di sini
        minio_object_name = f"lms_assignments/{original_stem}_{timestamp}{ext.lower()}"

        # 1. Hapus header Data URL dari Base64 jika ada (misal: "data:application/pdf;base64,...")
        if "," in file_data:
            file_data = file_data.split(",")[1]

        # 2. Decode Base64 menjadi raw bytes
        file_bytes = base64.b64decode(file_data)
        file_length = len(file_bytes)  # Hitung ukuran file dalam bytes

        # Gunakan io.BytesIO agar boto3 dapat melakukan seek() dan mengukur Content-Length secara native
        file_stream = io.BytesIO(file_bytes)

        # 3. Unggah ke MinIO dengan menyertakan ContentLength
        cfg = get_minio_config()
        s3_client = get_minio_client()
        s3_client.put_object(
            Bucket=cfg["BUCKET_NAME"],
            Key=minio_object_name,
            Body=file_stream,
            ContentLength=file_length,
            ContentType='application/pdf'
        )

    except Exception as e:
        frappe.logger("bima_lms").error(f"Error upload to MinIO: {str(e)}")
        frappe.throw(f"Gagal mengunggah file ke MinIO: {str(e)}")

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

            # Simpan nama object MinIO ke kolom file_path database
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
                minio_object_name,
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
        frappe.logger("bima_lms").error(f"Error submit_assignment_minio: {str(e)}")
        frappe.throw(f"Gagal mengumpulkan tugas: {str(e)}")
    finally:
        conn.close()

@frappe.whitelist()
def upload_quiz_media_minio(file_name, file_data, media_type):
    """
    Upload gambar atau PDF untuk media soal quiz ke MinIO folder lms_media_question_quiz/.
    Return object name (belum disimpan ke DB; disimpan saat save_quiz_questions).
    """
    if not file_name or not file_data or not media_type:
        frappe.throw("Parameter file dan tipe media wajib diisi.", frappe.MandatoryError)

    user_roles = frappe.get_roles(frappe.session.user)
    if frappe.session.user != "Administrator" and "LMS Teacher" not in user_roles:
        frappe.throw("Hanya guru yang dapat mengunggah media quiz.", frappe.PermissionError)

    original_stem, ext = os.path.splitext(file_name)
    ext = ext.lower()

    if media_type == "image":
        if ext not in QUIZ_MEDIA_ALLOWED_IMAGES:
            frappe.throw(
                "Format gambar harus salah satu dari: jpg, jpeg, png, webp, gif.",
                frappe.ValidationError
            )
    elif media_type == "pdf":
        if ext != ".pdf":
            frappe.throw("File harus berformat PDF.", frappe.ValidationError)
    else:
        frappe.throw("Tipe media tidak dikenal.", frappe.ValidationError)

    try:
        if "," in file_data:
            file_data = file_data.split(",", 1)[1]

        file_bytes = base64.b64decode(file_data)
        file_length = len(file_bytes)

        if file_length == 0:
            frappe.throw("File kosong.", frappe.ValidationError)
        if file_length > QUIZ_MEDIA_MAX_BYTES:
            frappe.throw("Ukuran file maksimal 5 MB.", frappe.ValidationError)

        timestamp = datetime.now(WIB).strftime("%Y%m%d_%H%M%S_%f")
        minio_object_name = f"lms_media_question_quiz/{original_stem}_{timestamp}{ext}"

        cfg = get_minio_config()
        s3_client = get_minio_client()
        s3_client.put_object(
            Bucket=cfg["BUCKET_NAME"],
            Key=minio_object_name,
            Body=io.BytesIO(file_bytes),
            ContentLength=file_length,
            ContentType=_detect_content_type(ext),
        )
    except frappe.ValidationError:
        raise
    except Exception as e:
        frappe.logger("bima_lms").error(f"Error upload quiz media to MinIO: {str(e)}")
        frappe.throw(f"Gagal mengunggah media quiz ke MinIO: {str(e)}")

    return {
        "status": "success",
        "object_name": minio_object_name,
    }

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


# === QUIZ ===
@frappe.whitelist()
def get_temp_quiz_answers(quiz_id, student_id):
    """Ambil jawaban sementara quiz untuk siswa aktif yang dipilih orang tua."""
    if not quiz_id or not student_id:
        frappe.throw("Quiz dan akun anak wajib diisi.", frappe.MandatoryError)

    user_roles = frappe.get_roles(frappe.session.user)
    if frappe.session.user == "Administrator" or "LMS Parent" not in user_roles:
        frappe.throw("Hanya orang tua yang dapat mengakses jawaban sementara quiz.", frappe.PermissionError)

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
                SELECT question_id, option_id, remaining_time, updated_at
                FROM lms.temp_quiz_answer
                WHERE quiz_id = %s AND student_id = %s
                ORDER BY updated_at DESC, question_id ASC
            """, (quiz_id, student_id))
            rows = cur.fetchall()

            if not rows:
                return {"status": "not_found", "answers": {}, "remaining_time": 0}

            remaining_time = int(rows[0]["remaining_time"] or 0)
            answers = {}
            for row in rows:
                if row["question_id"] is not None and row["option_id"] is not None:
                    answers[int(row["question_id"])] = int(row["option_id"])

            return {
                "status": "success",
                "answers": answers,
                "remaining_time": remaining_time,
                "updated_at": as_wib_iso(rows[0]["updated_at"])
            }
    finally:
        conn.close()


@frappe.whitelist()
def save_temp_quiz_answers(quiz_id, student_id, answers=None, remaining_time=0):
    """Simpan jawaban sementara quiz untuk siswa aktif milik orang tua."""
    if not quiz_id or not student_id:
        frappe.throw("Quiz dan akun anak wajib diisi.", frappe.MandatoryError)

    try:
        answers = json.loads(answers) if isinstance(answers, str) else (answers or {})
        answers = {int(question_id): int(option_id) for question_id, option_id in answers.items() if option_id}
    except (TypeError, ValueError, json.JSONDecodeError):
        frappe.throw("Format jawaban quiz tidak valid.", frappe.ValidationError)

    user_roles = frappe.get_roles(frappe.session.user)
    if frappe.session.user == "Administrator" or "LMS Parent" not in user_roles:
        frappe.throw("Hanya orang tua yang dapat menyimpan jawaban sementara quiz.", frappe.PermissionError)

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
                SELECT quiz_id
                FROM lms.quizzes
                WHERE quiz_id = %s AND is_deleted = false
                LIMIT 1
            """, (quiz_id,))
            if not cur.fetchone():
                frappe.throw("Quiz tidak ditemukan.", frappe.DoesNotExistError)

            cur.execute("""
                DELETE FROM lms.temp_quiz_answer
                WHERE quiz_id = %s AND student_id = %s
            """, (quiz_id, student_id))

            if answers:
                rows = []
                for question_id, option_id in answers.items():
                    rows.append((int(quiz_id), int(student_id), int(question_id), int(option_id), int(remaining_time or 0), datetime.now(WIB)))
                cur.executemany("""
                    INSERT INTO lms.temp_quiz_answer
                        (quiz_id, student_id, question_id, option_id, remaining_time, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, rows)

        conn.commit()
        return {"status": "success", "message": "Jawaban sementara berhasil disimpan."}
    except Exception as e:
        conn.rollback()
        frappe.logger("bima_lms").error(f"Error save_temp_quiz_answers: {str(e)}")
        frappe.throw(f"Gagal menyimpan jawaban sementara quiz: {str(e)}")
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
        
        # Setelah conn.commit() sukses di submit_quiz_attempt, tambahkan:
        try:
            with conn.cursor() as cleanup_cur:
                cleanup_cur.execute("""
                    DELETE FROM lms.temp_quiz_answer
                    WHERE quiz_id = %s AND student_id = %s
                """, (quiz_id, student_id))
            conn.commit()
        except Exception as cleanup_err:
            frappe.logger("bima_lms").warning(f"Gagal hapus draft quiz: {str(cleanup_err)}")
            
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
def save_quiz_questions(quiz_id, questions=None, deleted_question_ids=None, deleted_option_ids=None):
    """Save teacher-managed quiz questions and options in one transaction."""
    if not quiz_id:
        frappe.throw("Quiz wajib diisi.", frappe.MandatoryError)

    if isinstance(questions, str):
        questions = json.loads(questions)
    if isinstance(deleted_question_ids, str):
        deleted_question_ids = json.loads(deleted_question_ids)
    if isinstance(deleted_option_ids, str):
        deleted_option_ids = json.loads(deleted_option_ids)
    questions = questions or []
    deleted_question_ids = [int(value) for value in (deleted_question_ids or [])]
    deleted_option_ids = [int(value) for value in (deleted_option_ids or [])]

    conn = get_pg_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if "LMS Teacher" not in frappe.get_roles(frappe.session.user):
                frappe.throw("Hanya guru yang dapat mengubah isi quiz.", frappe.PermissionError)

            cur.execute("""
                SELECT quiz_id
                FROM lms.quizzes
                WHERE quiz_id = %s AND is_deleted = false
                FOR UPDATE
            """, (quiz_id,))
            if not cur.fetchone():
                frappe.throw("Quiz tidak ditemukan.", frappe.DoesNotExistError)

            current_user_id = get_current_user_id(conn)
            if not current_user_id:
                cur.execute("SELECT user_id FROM auth.users WHERE is_deleted = false ORDER BY user_id ASC LIMIT 1")
                user_row = cur.fetchone()
                current_user_id = user_row["user_id"] if user_row else 1

            if deleted_question_ids:
                cur.execute("""
                    UPDATE master.lms_question_bank qb
                    SET is_deleted = true
                    WHERE qb.question_id = ANY(%s)
                      AND EXISTS (
                          SELECT 1 FROM lms.quiz_questions qq
                          WHERE qq.quiz_id = %s AND qq.question_id = qb.question_id
                      )
                """, (deleted_question_ids, quiz_id))
            if deleted_option_ids:
                cur.execute("""
                    UPDATE master.lms_question_options qo
                    SET is_deleted = true
                    WHERE qo.option_id = ANY(%s)
                      AND EXISTS (
                          SELECT 1
                          FROM lms.quiz_questions qq
                          WHERE qq.quiz_id = %s AND qq.question_id = qo.question_id
                      )
                """, (deleted_option_ids, quiz_id))

            for display_order, question in enumerate(questions, start=1):
                question_text = (question.get("question_text") or "").strip()
                points = float(question.get("points") or 0)
                options = question.get("options") or []
                url_image = (question.get("url_image") or "").strip() or None
                url_pdf = (question.get("url_pdf") or "").strip() or None
                url_video = (question.get("url_video") or "").strip() or None

                if not question_text:
                    frappe.throw("Pertanyaan tidak boleh kosong.", frappe.ValidationError)
                if points < 1:
                    frappe.throw("Bobot setiap soal minimal 1.", frappe.ValidationError)
                if len(options) < 2:
                    frappe.throw("Setiap soal minimal memiliki 2 pilihan jawaban.", frappe.ValidationError)
                correct_count = sum(1 for option in options if option.get("is_correct"))
                if correct_count != 1:
                    frappe.throw("Setiap soal harus memiliki tepat 1 kunci jawaban.", frappe.ValidationError)

                question_id = question.get("question_id")
                if question_id:
                    cur.execute("""
                        UPDATE master.lms_question_bank
                        SET question_text = %s,
                            question_type = 'multiple_choice',
                            url_image = %s,
                            url_pdf = %s,
                            url_video = %s,
                            is_deleted = false
                        WHERE question_id = %s
                    """, (question_text, url_image, url_pdf, url_video, question_id))
                else:
                    cur.execute("""
                        SELECT setval(
                            'master.lms_question_bank_question_id_seq'::regclass,
                            GREATEST(
                                COALESCE((SELECT MAX(question_id) FROM master.lms_question_bank), 0),
                                (SELECT last_value FROM master.lms_question_bank_question_id_seq)
                            ),
                            true
                        )
                    """)
                    cur.execute("""
                        INSERT INTO master.lms_question_bank
                            (question_text, question_type, default_points, 
                            url_image, url_pdf, url_video,
                            created_by, created_on, is_deleted)
                        VALUES (%s, 'multiple_choice', 5.00, %s,
                                NOW() AT TIME ZONE 'Asia/Jakarta', false)
                        RETURNING question_id
                    """, (question_text, url_image, url_pdf, url_video, current_user_id))
                    question_id = cur.fetchone()["question_id"]

                quiz_question_id = question.get("quiz_question_id")
                if quiz_question_id:
                    cur.execute("""
                        UPDATE lms.quiz_questions
                        SET question_id = %s, display_order = %s, points_override = %s
                        WHERE quiz_question_id = %s AND quiz_id = %s
                    """, (question_id, display_order, points, quiz_question_id, quiz_id))
                else:
                    cur.execute("""
                        SELECT setval(
                            'lms.quiz_questions_quiz_question_id_seq'::regclass,
                            GREATEST(
                                COALESCE((SELECT MAX(quiz_question_id) FROM lms.quiz_questions), 0),
                                (SELECT last_value FROM lms.quiz_questions_quiz_question_id_seq)
                            ),
                            true
                        )
                    """)
                    cur.execute("""
                        INSERT INTO lms.quiz_questions
                            (quiz_id, question_id, display_order, points_override)
                        VALUES (%s, %s, %s, %s)
                    """, (quiz_id, question_id, display_order, points))

                for option in options:
                    option_text = (option.get("option_text") or "").strip()
                    if not option_text:
                        frappe.throw("Teks pilihan jawaban tidak boleh kosong.", frappe.ValidationError)
                    option_id = option.get("option_id")
                    if option_id:
                        cur.execute("""
                            UPDATE master.lms_question_options
                            SET option_text = %s, is_correct = %s, is_deleted = false
                            WHERE option_id = %s AND question_id = %s
                        """, (option_text, bool(option.get("is_correct")), option_id, question_id))
                    else:
                        cur.execute("""
                            SELECT setval(
                                'master.lms_question_options_option_id_seq'::regclass,
                                GREATEST(
                                    COALESCE((SELECT MAX(option_id) FROM master.lms_question_options), 0),
                                    (SELECT last_value FROM master.lms_question_options_option_id_seq)
                                ),
                                true
                            )
                        """)
                        cur.execute("""
                            INSERT INTO master.lms_question_options
                                (question_id, option_text, is_correct, is_deleted)
                            VALUES (%s, %s, %s, false)
                        """, (question_id, option_text, bool(option.get("is_correct"))))

            cur.execute("""
                SELECT qq.quiz_question_id, qq.question_id, qq.display_order,
                       qq.points_override, qb.question_text, qb.question_type,
                       qb.default_points, qb.url_image, qb.url_pdf, qb.url_video,
                       qo.option_id, qo.option_text, qo.is_correct
                FROM lms.quiz_questions qq
                JOIN master.lms_question_bank qb ON qb.question_id = qq.question_id
                    AND qb.is_deleted = false
                LEFT JOIN master.lms_question_options qo ON qo.question_id = qb.question_id
                    AND qo.is_deleted = false
                WHERE qq.quiz_id = %s
                ORDER BY qq.display_order ASC, qq.quiz_question_id ASC, qo.option_id ASC
            """, (quiz_id,))
            rows = cur.fetchall()

        conn.commit()
        return {"status": "success", "questions": group_quiz_question_rows(rows)}
    except Exception as e:
        conn.rollback()
        frappe.logger("bima_lms").error(f"Error save_quiz_questions: {str(e)}")
        frappe.throw(f"Gagal menyimpan soal quiz: {str(e)}")
    finally:
        conn.close()

def group_quiz_question_rows(rows):
    questions = []
    for row in rows:
        question = next((item for item in questions if item["question_id"] == row["question_id"]), None)
        if not question:
            raw_image = row.get("url_image")
            raw_pdf = row.get("url_pdf")
            raw_video = row.get("url_video")
            question = {
                "quiz_question_id": row["quiz_question_id"],
                "question_id": row["question_id"],
                "question_text": row["question_text"] or "",
                "question_type": row["question_type"] or "multiple_choice",
                "points": float(row["points_override"] if row["points_override"] is not None else row["default_points"] or 0),
                "url_image_raw": raw_image or "",
                "url_pdf_raw": raw_pdf or "",
                "url_video": raw_video or "",
                "url_image": generate_minio_presigned_url(raw_image) if raw_image else "",
                "url_pdf": generate_minio_presigned_url(raw_pdf) if raw_pdf else "",
                "embed_video_url": get_embed_video_url(raw_video) if raw_video else "",
                "options": []
            }
            questions.append(question)
        if row["option_id"] is not None:
            question["options"].append({
                "option_id": row["option_id"],
                "option_text": row["option_text"] or "",
                "is_correct": bool(row["is_correct"])
            })
    return questions


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
def batch_save_section_detail(section_id, section_title=None, description=None, lessons=None, deleted_lesson_ids=None, assignments=None, deleted_assignment_ids=None, quizzes=None, deleted_quiz_ids=None):
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
    if isinstance(quizzes, str):
        quizzes = json.loads(quizzes)
    if isinstance(deleted_quiz_ids, str):
        deleted_quiz_ids = json.loads(deleted_quiz_ids)

    deleted_lesson_ids = deleted_lesson_ids or []
    deleted_assignment_ids = deleted_assignment_ids or []
    deleted_quiz_ids = deleted_quiz_ids or []

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

        # 5. Handle Quiz metadata (soft delete, insert, update, and reorder).
        if deleted_quiz_ids:
            cursor.execute("""
                UPDATE lms.quizzes
                SET is_deleted = true
                WHERE section_id = %s AND quiz_id = ANY(%s)
            """, (section_id, [int(qid) for qid in deleted_quiz_ids]))

        if quizzes:
            for display_order, quiz in enumerate(quizzes, start=1):
                quiz_id = quiz.get("quiz_id")
                quiz_title = (quiz.get("quiz_title") or "Quiz Baru").strip()
                duration_minutes = int(quiz.get("duration_minutes") or 1)
                passing_grade = float(quiz.get("passing_grade") or 1)
                max_attempts_allowed = int(quiz.get("max_attempts_allowed") or 1)
                if duration_minutes < 1 or passing_grade < 1 or max_attempts_allowed < 1:
                    frappe.throw("Durasi, nilai lulus, dan maksimal percobaan harus minimal 1.", frappe.ValidationError)

                if quiz_id:
                    cursor.execute("""
                        UPDATE lms.quizzes
                        SET quiz_title = %s,
                            duration_minutes = %s,
                            passing_grade = %s,
                            max_attempts_allowed = %s,
                            display_order = %s
                        WHERE quiz_id = %s AND section_id = %s AND is_deleted = false
                    """, (quiz_title, duration_minutes, passing_grade,
                          max_attempts_allowed, display_order, quiz_id, section_id))
                else:
                    cursor.execute("""
                        INSERT INTO lms.quizzes
                            (course_id, section_id, quiz_title, duration_minutes,
                             passing_grade, max_attempts_allowed, created_by,
                             created_on, display_order, is_deleted)
                        VALUES (%s, %s, %s, %s, %s, %s, %s,
                                NOW() AT TIME ZONE 'Asia/Jakarta', %s, false)
                    """, (course_id, section_id, quiz_title, duration_minutes,
                          passing_grade, max_attempts_allowed, current_user_id,
                          display_order))

        conn.commit()
        cursor.close()
        conn.close()

        return {"status": "success", "message": "Berhasil memperbarui data bab, materi, tugas, dan quiz."}

    except Exception as e:
        frappe.logger("bima_lms").error(f"Error batch_save_section_detail: {str(e)}")
        frappe.throw(f"Gagal menyimpan data: {str(e)}")