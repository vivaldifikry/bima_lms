import frappe
import random
from bima_lms.api.courses import get_pg_connection

def generate_colors(n):
    # Gunakan warna yang valid dan konsisten
    color_palette = [
        "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF", 
        "#FF9F40", "#FF6384", "#C9CBCF", "#7BC8F6", "#F7464A",
        "#46BFBD", "#FDB45C", "#949FB1", "#4D5360", "#E8743C",
        "#E8A73C", "#6EBC6C", "#3D8F8F", "#F39C12", "#8E44AD",
        "#2ECC71", "#E74C3C", "#3498DB", "#1ABC9C", "#9B59B6",
        "#2C3E50", "#E67E22", "#27AE60", "#2980B9", "#8E44AD"
    ]
    
    # Kembalikan warna sesuai jumlah yang dibutuhkan
    if n <= len(color_palette):
        return color_palette[:n]
    else:
        # Jika lebih dari palette, generate random dengan format yang benar
        colors = color_palette.copy()
        for _ in range(n - len(color_palette)):
            # Pastikan format hex benar
            color = "#{:06x}".format(random.randint(0, 0xFFFFFF))
            colors.append(color)
        return colors

@frappe.whitelist()
def get_data(chart_name=None, filters=None, timespan=None, time_interval=None, from_date=None, to_date=None, chart=None):
    try:
        conn = get_pg_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT 
                COALESCE(a.title, CONCAT('Tugas #', sub.assignment_id)) AS assignment_title,
                COALESCE(st.full_name, CONCAT('Siswa #', sub.student_id)) AS student_name,
                COALESCE(sub.score, 0) AS score
            FROM lms.assignment_submissions sub
            LEFT JOIN lms.assignments a ON sub.assignment_id = a.assignment_id
            LEFT JOIN kelaskita.students st ON sub.student_id = st.id
            WHERE sub.score IS NOT NULL
            ORDER BY st.full_name ASC NULLS LAST, a.display_order ASC NULLS LAST;
        """)
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        if not rows:
            return {"labels": [], "datasets": []}

        # 1. Sumbu X = Daftar Nama Siswa
        labels = list(dict.fromkeys([r[1] for r in rows]))

        # 2. Ambil daftar tugas unik untuk dijadikan Series Legend (Dataset)
        assignments = list(dict.fromkeys([r[0] for r in rows]))

        # 3. Peta Nilai per Tugas
        assignment_data = {}
        for assignment_title, student_name, score in rows:
            if assignment_title not in assignment_data:
                assignment_data[assignment_title] = {s: 0 for s in labels}
            assignment_data[assignment_title][student_name] = float(score)

        # 4. Generate colors untuk semua dataset
        colors = generate_colors(len(assignments))

        # 5. Buat Datasets per Tugas
        datasets = []
        for idx, assignment_title in enumerate(assignments):
            student_map = assignment_data[assignment_title]
            # Potong judul tugas jika terlalu panjang untuk Legend UI
            short_title = assignment_title[:15] + '..' if len(assignment_title) > 15 else assignment_title
            datasets.append({
                "name": short_title,
                "values": [student_map[s] for s in labels],
                "color": colors[idx]  # Assign warna ke setiap dataset
            })

        # Log untuk debugging
        frappe.logger("bima_lms").info(f"Generated {len(datasets)} datasets with colors: {colors}")

        return {
            "labels": labels,
            "datasets": datasets,
            "colors": colors  # Kirim semua colors untuk referensi
        }

    except Exception as e:
        frappe.logger("bima_lms").error(f"Error assignment_scores_source: {str(e)}")
        return {"labels": [], "datasets": []}