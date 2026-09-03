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

# API untuk mengambil data chart assignment di workspace
@frappe.whitelist()
def get_assignment_chart_for_workspace(chart_name=None, filters=None):
    """
    Fungsi khusus untuk Frappe Dashboard Chart di Workspace
    """
    conn = get_pg_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT 
            a.title AS assignment_title,
            st.full_name AS student_name,
            COALESCE(sub.score, 0) AS score
        FROM lms.assignment_submissions sub
        JOIN lms.assignments a ON sub.assignment_id = a.assignment_id
        JOIN kelaskita.students st ON sub.student_id = st.id
        WHERE sub.score IS NOT NULL AND sub.is_deleted = false
        ORDER BY a.display_order ASC, st.full_name ASC;
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    if not rows:
        return {"data": {"labels": [], "datasets": []}}

    labels = list(dict.fromkeys([r[0] for r in rows]))
    students_data = {}
    for assignment_title, student_name, score in rows:
        if student_name not in students_data:
            students_data[student_name] = {l: 0 for l in labels}
        students_data[student_name][assignment_title] = float(score)

    datasets = []
    for student_name, scores_map in students_data.items():
        datasets.append({
            "name": student_name,
            "values": [scores_map[l] for l in labels]
        })

    # PENTING: Frappe Dashboard Chart membaca atribut "data"
    return {
        "data": {
            "labels": labels,
            "datasets": datasets
        }
    }

# Fungsi untuk memperbarui jumlah total lesson di course
def update_course_total_lessons(cursor, course_id):
    """Update the cached count of active lessons across the course sections."""
    if not course_id:
        return

    cursor.execute("""
        UPDATE lms.courses c
        SET total_lessons = (
            SELECT COUNT(*)
            FROM lms.course_lessons cl
            JOIN lms.course_sections cs ON cs.section_id = cl.section_id
            WHERE cs.course_id = c.course_id
              AND cs.is_deleted = false
              AND cl.is_deleted = false
        )
        WHERE c.course_id = %s
    """, (course_id,))


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
def get_course_detail(course_id=None, active_student_id=None):
    """
    Mengambil detail mata pelajaran berdasarkan course_id.
    """
    if not course_id:
        frappe.throw("Parameter course_id diperlukan.", frappe.MandatoryError)

    current_user_email = frappe.session.user
    active_student_id = active_student_id or None
    user_roles = frappe.get_roles(current_user_email)
    is_builtin_admin = current_user_email == "Administrator"
    allowed_roles = ["Administrator", "Admin", "LMS Admin", "LMS Teacher", "LMS Parent", "System Manager"]

    if not is_builtin_admin and not any(role in user_roles for role in allowed_roles):
        frappe.throw("Anda tidak memiliki akses untuk melihat halaman ini.", frappe.PermissionError)

    is_admin = is_builtin_admin or any(role in user_roles for role in ["Administrator", "Admin", "LMS Admin", "System Manager"])
    is_parent = not is_builtin_admin and "LMS Parent" in user_roles

    try:
        conn = get_pg_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Dapatkan pg_user_id
        cursor.execute("SELECT user_id FROM auth.users WHERE user_email = %s AND is_deleted = false LIMIT 1;", (current_user_email,))
        pg_user = cursor.fetchone()
        pg_user_id = pg_user["user_id"] if pg_user else None

        if is_parent:
            if not active_student_id:
                frappe.throw("Silakan pilih akun anak terlebih dahulu.", frappe.PermissionError)
            cursor.execute("""
                SELECT 1
                FROM auth.parent_student_relations psr
                JOIN auth.users pu ON pu.user_id = psr.parent_user_id
                WHERE pu.user_email = %s AND psr.student_user_id = %s
                LIMIT 1;
            """, (current_user_email, active_student_id))
            if not cursor.fetchone():
                frappe.throw("Akun anak tidak valid untuk pengguna ini.", frappe.PermissionError)

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
              AND (%s = false OR EXISTS (
                  SELECT 1 FROM master.rombel_students rs
                  WHERE rs.rombel_id = cr.rombels_id AND rs.student_id = %s
              ))
            ORDER BY r.name ASC;
        """, (course_id, is_parent, active_student_id))
        assigned_rombels = cursor.fetchall()
        
        # Non-admin hanya bisa melihat course milik sendiri
        if not is_admin:
            if is_parent:
                query += """ AND EXISTS (
                    SELECT 1
                    FROM lms.course_rombels cr_parent
                    JOIN master.rombel_students rs_parent ON rs_parent.rombel_id = cr_parent.rombels_id
                    WHERE cr_parent.course_id = c.course_id AND rs_parent.student_id = %s
                )"""
                cursor.execute(query, (course_id, active_student_id))
            else:
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
            "assigned_rombels": [{"id": r["id"], "name": r["name"]} for r in assigned_rombels],
            "is_parent": is_parent,
            "can_edit": not is_parent,
            "active_student_id": active_student_id if is_parent else None
        }

    except Exception as e:
        frappe.logger("bima_lms").error(f"Error get_course_detail: {str(e)}")
        frappe.throw(f"Gagal mengambil detail mata pelajaran: {str(e)}")

# API untuk mengambil daftar mata pelajaran (courses) berdasarkan user yang sedang login di PostgreSQL
@frappe.whitelist()
def get_user_courses(student_id=None, rombel_ids=None, category_ids=None):
    """
    Mengambil daftar mata pelajaran berdasarkan user yang sedang login.
    Jika parent dengan student_id, ambil berdasarkan rombel siswa.
    Jika rombel_ids diberikan, filter berdasarkan rombel tersebut.
    Jika category_ids diberikan, filter berdasarkan kategori tersebut.
    """
    current_user_email = frappe.session.user

    user_roles = frappe.get_roles(current_user_email) or []
    allowed_roles = [
        "Administrator",
        "Admin",
        "LMS Admin",
        "LMS Teacher",
        "LMS Parent",
        "LMS Student",
        "System Manager"
    ]

    if current_user_email == "Administrator":
        user_roles = list(dict.fromkeys(user_roles + ["Administrator"]))

    if not any(role in user_roles for role in allowed_roles):
        frappe.throw("Anda tidak memiliki akses untuk melihat halaman ini.", frappe.PermissionError)

    is_admin = any(role in user_roles for role in ["Administrator", "Admin", "LMS Admin", "System Manager"])
    is_parent = "LMS Parent" in user_roles
    is_teacher = "LMS Teacher" in user_roles

    try:
        conn = get_pg_connection()
        cursor = conn.cursor()

        pg_user_id = get_current_user_id(conn=conn)

        # Parse rombel_ids jika berupa string JSON
        parsed_rombel_ids = []
        if rombel_ids:
            import json
            if isinstance(rombel_ids, str):
                try:
                    parsed_rombel_ids = json.loads(rombel_ids)
                except:
                    parsed_rombel_ids = []
            elif isinstance(rombel_ids, list):
                parsed_rombel_ids = rombel_ids

        # Parse category_ids jika berupa string JSON
        parsed_category_ids = []
        if category_ids:
            import json
            if isinstance(category_ids, str):
                try:
                    parsed_category_ids = json.loads(category_ids)
                except:
                    parsed_category_ids = []
            elif isinstance(category_ids, list):
                parsed_category_ids = category_ids

        base_query = """
            SELECT DISTINCT
                c.course_id,
                c.course_title,
                c.short_description,
                cat.category_name,
                u.user_full_name AS instructor_name,
                array_agg(DISTINCT r.id) AS rombel_ids,
                array_agg(DISTINCT r.name) AS rombel_names,
                c.category_id
            FROM lms.courses c
            LEFT JOIN master.lms_course_categories cat ON c.category_id = cat.category_id
            LEFT JOIN auth.users u ON c.instructor_id = u.user_id
            LEFT JOIN lms.course_rombels cr ON c.course_id = cr.course_id
            LEFT JOIN master.rombels r ON cr.rombels_id = r.id
        """

        where_conditions = []
        params = []

        if is_admin:
            # Admin: lihat semua course
            pass
            
        elif is_parent and student_id:
            # Parent: lihat course berdasarkan rombel siswa
            where_conditions.append("EXISTS (SELECT 1 FROM master.rombel_students rs WHERE rs.rombel_id = cr.rombels_id AND rs.student_id = %s)")
            params.append(student_id)
            where_conditions.append("c.status = 'PUBLISHED'")
            
            # Filter rombel jika ada
            if parsed_rombel_ids:
                placeholders = ','.join(['%s'] * len(parsed_rombel_ids))
                where_conditions.append(f"cr.rombels_id IN ({placeholders})")
                params.extend(parsed_rombel_ids)
            
        elif is_teacher:
            # Teacher: lihat course milik sendiri
            where_conditions.append("c.instructor_id = %s")
            params.append(pg_user_id)
            
        else:
            # Student: lihat course berdasarkan rombel sendiri
            where_conditions.append("EXISTS (SELECT 1 FROM master.rombel_students rs WHERE rs.rombel_id = cr.rombels_id AND rs.student_id = %s)")
            params.append(pg_user_id)
            where_conditions.append("c.status = 'PUBLISHED'")
            
            # Filter rombel jika ada
            if parsed_rombel_ids:
                placeholders = ','.join(['%s'] * len(parsed_rombel_ids))
                where_conditions.append(f"cr.rombels_id IN ({placeholders})")
                params.extend(parsed_rombel_ids)

        # Filter kategori (untuk semua role)
        if parsed_category_ids:
            placeholders = ','.join(['%s'] * len(parsed_category_ids))
            where_conditions.append(f"c.category_id IN ({placeholders})")
            params.extend(parsed_category_ids)

        # Gabungkan query
        if where_conditions:
            base_query += " WHERE " + " AND ".join(where_conditions)
        
        base_query += " GROUP BY c.course_id, c.course_title, c.short_description, cat.category_name, u.user_full_name, c.category_id"
        base_query += " ORDER BY c.course_id DESC;"

        cursor.execute(base_query, tuple(params))
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
                "instructor_name": row[4] or "Unassigned",
                "rombel_ids": row[5] if row[5] else [],
                "rombel_names": row[6] if row[6] else [],
                "category_id": row[7]
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

# Fungsi untuk mengambil data chart nilai siswa
@frappe.whitelist()
def get_course_score_chart_data(student_id=None):
    """
    Mengambil data nilai siswa untuk chart.
    - Jika student_id diberikan: data untuk 1 siswa (vertical bar chart untuk parent)
    - Jika tidak: data untuk semua siswa (horizontal bar chart untuk admin/guru)
    """
    current_user_email = frappe.session.user
    user_roles = frappe.get_roles(current_user_email) or []
    
    frappe.logger("bima_lms").info(f"=== get_course_score_chart_data START ===")
    frappe.logger("bima_lms").info(f"User: {current_user_email}")
    frappe.logger("bima_lms").info(f"Roles: {user_roles}")
    frappe.logger("bima_lms").info(f"student_id: {student_id}")
    
    # Cek role
    is_admin = current_user_email == "Administrator" or any(role in user_roles for role in ["Administrator", "Admin", "LMS Admin", "System Manager"])
    is_teacher = "LMS Teacher" in user_roles
    is_parent = "LMS Parent" in user_roles
    
    frappe.logger("bima_lms").info(f"is_admin: {is_admin}, is_teacher: {is_teacher}, is_parent: {is_parent}")
    
    # Logika akses
    if is_admin or is_teacher:
        pass
    elif is_parent:
        if not student_id:
            return {
                "visible": False,
                "message": "Silakan pilih akun anak terlebih dahulu.",
                "labels": [],
                "datasets": [],
                "is_single_student": False
            }
    else:
        return {
            "visible": False,
            "message": "Anda tidak memiliki akses untuk melihat chart nilai siswa.",
            "labels": [],
            "datasets": [],
            "is_single_student": False
        }

    try:
        conn = get_pg_connection()
        cursor = conn.cursor()

        pg_user_id = get_current_user_id(conn=conn)
        frappe.logger("bima_lms").info(f"pg_user_id: {pg_user_id}")

        # STEP 1: Dapatkan daftar course yang relevan
        course_query = """
            SELECT DISTINCT
                c.course_id,
                c.course_title
            FROM lms.courses c
            WHERE c.is_deleted = false 
              AND c.status = 'PUBLISHED'
              AND EXISTS (
                  SELECT 1 FROM lms.assignments a 
                  WHERE a.course_id = c.course_id 
                  AND a.is_deleted = false
              )
        """
        
        course_params = []
        
        if is_teacher and not is_admin:
            course_query += " AND c.instructor_id = %s"
            course_params.append(pg_user_id)
            frappe.logger("bima_lms").info(f"Filtering courses for teacher: {pg_user_id}")
        
        cursor.execute(course_query, tuple(course_params))
        relevant_courses = cursor.fetchall()
        
        if not relevant_courses:
            return {
                "visible": True,
                "labels": [],
                "datasets": [],
                "message": "Tidak ada course dengan tugas yang tersedia.",
                "is_single_student": bool(student_id)
            }
        
        course_ids = [row[0] for row in relevant_courses]
        frappe.logger("bima_lms").info(f"Relevant course IDs: {course_ids}")
        
        # STEP 2: Query untuk mengambil data
        # PERBAIKAN: Gunakan f-string dengan hati-hati untuk placeholders
        placeholders = ','.join(['%s'] * len(course_ids))
        
        # PERBAIKAN: Query dengan parameter yang benar
        query = f"""
            SELECT 
                cs.student_id AS student_id,
                cs.student_name AS student_name,
                cs.course_id AS course_id,
                al.assignment_id AS assignment_id,
                al.title AS assignment_title,
                al.max_score AS max_score,
                al.deadline AS deadline,
                COALESCE(sub.score, -1) AS score,
                sub.submitted_at AS submitted_at,
                sub.is_late AS is_late,
                CASE 
                    WHEN sub.submission_id IS NOT NULL THEN 'submitted'
                    ELSE 'not_submitted'
                END AS submission_status,
                rc.instructor_id AS instructor_id,
                rc.course_title AS course_title
            FROM (
                SELECT DISTINCT
                    ce.course_id AS course_id,
                    ce.student_id AS student_id,
                    st.full_name AS student_name,
                    st.id AS student_id_internal
                FROM lms.course_enrollments ce
                JOIN kelaskita.students st ON ce.student_id = st.id
                WHERE ce.course_id IN ({placeholders})
                  AND ce.status = 'ENROLLED'
                  AND st.is_deleted = false
        """
        
        # Jika student_id diberikan, tambahkan filter
        if student_id:
            query += " AND ce.student_id = %s"
        
        query += f"""
            ) cs
            JOIN (
                SELECT 
                    c.course_id AS course_id,
                    c.instructor_id AS instructor_id,
                    c.course_title AS course_title
                FROM lms.courses c
                WHERE c.course_id IN ({placeholders})
                  AND c.is_deleted = false 
                  AND c.status = 'PUBLISHED'
            ) rc ON cs.course_id = rc.course_id
            JOIN (
                SELECT 
                    a.assignment_id AS assignment_id,
                    a.course_id AS course_id,
                    a.title AS title,
                    a.max_score AS max_score,
                    a.deadline AS deadline,
                    a.section_id AS section_id
                FROM lms.assignments a
                WHERE a.is_deleted = false
                  AND a.course_id IN ({placeholders})
            ) al ON cs.course_id = al.course_id
            LEFT JOIN lms.assignment_submissions sub 
                ON sub.assignment_id = al.assignment_id 
                AND sub.student_id = cs.student_id
            ORDER BY cs.student_name ASC, al.assignment_id ASC;
        """
        
        # PERBAIKAN: Build parameters dengan benar
        params = []
        
        # Untuk course_students (IN clause pertama)
        params.extend(course_ids)
        
        # Tambahkan student_id jika ada
        if student_id:
            params.append(student_id)
        
        # Untuk relevant_courses (IN clause kedua)
        params.extend(course_ids)
        
        # Untuk assignment_list (IN clause ketiga)
        params.extend(course_ids)
        
        frappe.logger("bima_lms").info(f"Query params count: {len(params)}")
        frappe.logger("bima_lms").info(f"Query params: {params}")
        
        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        
        frappe.logger("bima_lms").info(f"Query returned {len(rows)} rows")
        
        cursor.close()
        conn.close()

        if not rows:
            return {
                "visible": True,
                "labels": [],
                "datasets": [],
                "message": "Tidak ada data nilai yang tersedia.",
                "is_single_student": bool(student_id)
            }

        # Proses data
        students_data = {}
        assignments_info = {}
        student_courses = {}
        course_names = {}
        
        for row in rows:
            (student_id_val, student_name, course_id, assignment_id, assignment_title, 
             max_score, deadline, score, submitted_at, is_late, submission_status, 
             instructor_id, course_title) = row
            
            if course_id not in course_names:
                course_names[course_id] = course_title or f"Course {course_id}"
            
            if student_name not in students_data:
                students_data[student_name] = {
                    'student_id': student_id_val,
                    'courses': {}
                }
            
            if course_id not in students_data[student_name]['courses']:
                students_data[student_name]['courses'][course_id] = {
                    'course_title': course_names[course_id],
                    'assignments': {}
                }
            
            if assignment_id not in assignments_info:
                assignments_info[assignment_id] = {
                    'title': assignment_title,
                    'max_score': float(max_score) if max_score else 100,
                    'deadline': deadline,
                    'course_id': course_id,
                    'course_title': course_names[course_id]
                }
            
            students_data[student_name]['courses'][course_id]['assignments'][assignment_id] = {
                'title': assignment_title,
                'score': float(score) if score and score != -1 else None,
                'max_score': float(max_score) if max_score else 100,
                'submitted_at': submitted_at,
                'is_late': is_late,
                'status': submission_status
            }
            
            if student_name not in student_courses:
                student_courses[student_name] = set()
            student_courses[student_name].add(course_id)

        student_names = sorted(students_data.keys())
        assignment_ids = sorted(assignments_info.keys(), key=lambda x: (assignments_info[x]['course_id'], assignments_info[x]['title']))
        
        frappe.logger("bima_lms").info(f"Processed: {len(student_names)} students, {len(assignment_ids)} assignments")
        
        datasets = []
        for assignment_id in assignment_ids:
            assignment = assignments_info[assignment_id]
            values = []
            statuses = []
            
            for student_name in student_names:
                student = students_data[student_name]
                is_enrolled = assignment['course_id'] in student['courses']
                
                if not is_enrolled:
                    values.append(0)
                    statuses.append('not_enrolled')
                else:
                    assignment_data = student['courses'][assignment['course_id']]['assignments'].get(assignment_id)
                    if assignment_data and assignment_data['status'] == 'submitted':
                        values.append(assignment_data['score'] or 0)
                        statuses.append('submitted')
                    else:
                        values.append(0)
                        statuses.append('not_submitted')
            
            label = f"{assignment['title']} ({assignment['course_title']})"
            if len(label) > 30:
                label = label[:27] + '...'
            
            datasets.append({
                'name': label,
                'assignment_id': assignment_id,
                'course_id': assignment['course_id'],
                'course_title': assignment['course_title'],
                'max_score': assignment['max_score'],
                'deadline': assignment['deadline'],
                'values': values,
                'statuses': statuses,
                'color': ''
            })

        is_single = bool(student_id and len(student_names) == 1)
        title = "Perbandingan Nilai Siswa per Tugas"
        if is_single and student_names:
            title = f"Nilai {student_names[0]}"
        
        result = {
            "visible": True,
            "labels": student_names,
            "datasets": datasets,
            "students_data": students_data,
            "assignments_info": assignments_info,
            "student_courses": student_courses,
            "course_names": course_names,
            "title": title,
            "subtitle": f"{len(student_names)} siswa · {len(datasets)} tugas",
            "is_single_student": is_single
        }
        
        frappe.logger("bima_lms").info(f"Returning result with {len(datasets)} datasets, {len(student_names)} students")
        frappe.logger("bima_lms").info(f"is_single_student: {result['is_single_student']}")
        frappe.logger("bima_lms").info(f"=== get_course_score_chart_data END ===")
        
        return result

    except Exception as e:
        frappe.logger("bima_lms").error(f"Error get_course_score_chart_data: {str(e)}")
        import traceback
        frappe.logger("bima_lms").error(traceback.format_exc())
        return {
            "visible": False,
            "message": str(e),
            "labels": [],
            "datasets": [],
            "is_single_student": False
        }

# API untuk mengambil daftar rombel yang diikuti oleh seorang siswa
@frappe.whitelist()
def get_student_rombels(student_id):
    """
    Mengambil daftar rombel yang diikuti oleh seorang siswa
    """
    if not student_id:
        frappe.throw("Parameter student_id diperlukan.", frappe.MandatoryError)

    try:
        conn = get_pg_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        cursor.execute("""
            SELECT 
                r.id AS rombel_id,
                r.name AS rombel_name,
                r.grade_level
            FROM master.rombel_students rs
            JOIN master.rombels r ON rs.rombel_id = r.id
            WHERE rs.student_id = %s
            ORDER BY r.grade_level ASC, r.name ASC;
        """, (student_id,))
        
        rombels = cursor.fetchall()
        cursor.close()
        conn.close()
        
        return rombels
        
    except Exception as e:
        frappe.logger("bima_lms").error(f"Error get_student_rombels: {str(e)}")
        frappe.throw(f"Gagal mengambil daftar rombel: {str(e)}")

# API untuk mengambil daftar kategori course dari PostgreSQL
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

# API untuk memperbarui detail course di PostgreSQL
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

# API untuk menyimpan atau memperbarui daftar rombel yang di-assign ke course
@frappe.whitelist()
def save_course_rombels(course_id, rombel_ids=None):
    """
    Menyimpan atau memperbarui daftar rombel yang di-assign ke course.
    Juga melakukan enrollment siswa ke course berdasarkan rombel yang dipilih.
    """
    if not course_id:
        frappe.throw("Parameter course_id diperlukan.", frappe.MandatoryError)

    import json
    from datetime import datetime

    # Normalisasi rombel_ids
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
    new_enrollments_count = 0
    
    try:
        with conn.cursor() as cur:
            # 1. Hapus alokasi rombel lama
            cur.execute("DELETE FROM lms.course_rombels WHERE course_id = %s;", (course_id,))

            # 2. Insert rombel yang dipilih
            if parsed_rombel_ids:
                insert_query = """
                    INSERT INTO lms.course_rombels (course_id, rombels_id, created_at, created_by)
                    VALUES (%s, %s, NOW() AT TIME ZONE 'Asia/Jakarta', %s);
                """
                records_to_insert = [
                    (course_id, r_id, current_user_id) 
                    for r_id in parsed_rombel_ids if r_id
                ]

                if records_to_insert:
                    cur.executemany(insert_query, records_to_insert)

                # 3. Dapatkan semua student_id dari master.rombel_students
                placeholders = ','.join(['%s'] * len(parsed_rombel_ids))
                cur.execute(f"""
                    SELECT DISTINCT rs.student_id 
                    FROM master.rombel_students rs
                    WHERE rs.rombel_id IN ({placeholders}) 
                    AND (rs.is_deleted = false OR rs.is_deleted IS NULL);
                """, parsed_rombel_ids)
                student_ids = [row[0] for row in cur.fetchall()]

                if student_ids:
                    # 4. Dapatkan daftar student yang sudah terdaftar di course ini
                    student_placeholders = ','.join(['%s'] * len(student_ids))
                    cur.execute(f"""
                        SELECT student_id 
                        FROM lms.course_enrollments 
                        WHERE course_id = %s 
                        AND student_id IN ({student_placeholders});
                    """, [course_id] + student_ids)
                    existing_student_ids = [row[0] for row in cur.fetchall()]

                    # 5. Filter student yang belum terdaftar
                    new_student_ids = [s_id for s_id in student_ids if s_id not in existing_student_ids]

                    # 6. Insert enrollment untuk student yang belum terdaftar
                    if new_student_ids:
                        new_enrollments_count = len(new_student_ids)
                        enrollment_records = [
                            (
                                course_id,
                                s_id,
                                datetime.now(),
                                'ENROLLED',
                                0,
                                None,  # completed_at
                                None   # last_accessed_at
                            )
                            for s_id in new_student_ids
                        ]

                        cur.executemany("""
                            INSERT INTO lms.course_enrollments 
                            (course_id, student_id, enrollment_date, status, completion_percentage, completed_at, last_accessed_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s);
                        """, enrollment_records)

                        # 7. Update total_enrollments di lms.courses
                        cur.execute("""
                            UPDATE lms.courses 
                            SET total_enrollments = (
                                SELECT COUNT(*) 
                                FROM lms.course_enrollments 
                                WHERE course_id = %s
                            )
                            WHERE course_id = %s;
                        """, (course_id, course_id))

        conn.commit()
        
        message = "Penugasan rombel berhasil diperbarui."
        if new_enrollments_count > 0:
            message += f" {new_enrollments_count} siswa berhasil didaftarkan ke course."
        else:
            message += " Tidak ada siswa baru yang didaftarkan (semua sudah terdaftar)."
        
        return {
            "status": "success", 
            "message": message,
            "enrolled_students": new_enrollments_count
        }

    except Exception as e:
        conn.rollback()
        frappe.logger("bima_lms").error(f"Error save_course_rombels: {str(e)}")
        frappe.throw(f"Gagal menyimpan penugasan rombel: {str(e)}")
    finally:
        conn.close()