import frappe


def execute():
    frappe.db.sql("""
        ALTER TABLE lms.quiz_attempts
        DROP CONSTRAINT IF EXISTS fk_attempts_student
    """)
    frappe.db.sql("""
        ALTER TABLE lms.quiz_attempts
        ADD CONSTRAINT fk_attempts_student
        FOREIGN KEY (student_id) REFERENCES kelaskita.students(id)
    """)
