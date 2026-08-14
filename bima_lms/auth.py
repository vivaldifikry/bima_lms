import psycopg2
import bcrypt
import frappe
from frappe.auth import LoginManager
from frappe.utils.password import update_password

# Konfigurasi Database PostgreSQL
def get_db_config():
    """Mengambil konfigurasi DB secara safe dari frappe.conf saat runtime"""
    conf = getattr(frappe, "conf", {}) or {}
    
    return {
        "host": conf.get("pg_db_host", "localhost"),
        "port": int(conf.get("pg_db_port", 5432) or 5432),
        "user": conf.get("pg_db_user", ""),
        "password": conf.get("pg_db_password", ""),
        "dbname": conf.get("pg_db_name", "")
    }

# Tempat Anda melakukan koneksi DB (misal dalam suatu fungsi/method):
def connect_to_postgres():
    config = get_db_config()
    # Contoh koneksi menggunakan psycopg2:
    # conn = psycopg2.connect(**config)
    return config

# Simpan fungsi authenticate asli bawaan Frappe
original_authenticate = LoginManager.authenticate
ROLE_MAPPING = {
    1: "LMS Admin",
    3: "LMS Student",
    7: "LMS Teacher",
    9: "LMS Parent",
}


def custom_authenticate(self, user=None, pwd=None):

    usr = user or frappe.form_dict.get("usr") or frappe.form_dict.get("user")
    password = pwd or frappe.form_dict.get("pwd") or frappe.form_dict.get("password")

    if not usr or not password:
        return original_authenticate(
            self,
            user=user,
            pwd=pwd
        )

    try:
        conn = psycopg2.connect(**get_db_config())
        cursor = conn.cursor()

        query = """
            SELECT
                u.user_id,
                u.user_email,
                u.user_full_name,
                u.user_password,
                u.role_id,
                r.role_name
            FROM auth.users u
            LEFT JOIN auth.role r
                ON u.role_id = r.role_id
            WHERE u.user_email = %s
              AND u.is_deleted = false
            LIMIT 1;
        """

        cursor.execute(query, (usr,))
        pg_user = cursor.fetchone()

        cursor.close()
        conn.close()

        if not pg_user:
            return original_authenticate(
                self,
                user=user,
                pwd=password
            )

        (
            user_id,
            email,
            full_name,
            hashed_password,
            role_id,
            role_name
        ) = pg_user

        # Cek password Kelaskita
        if not hashed_password or not bcrypt.checkpw(
            password.encode("utf-8"),
            hashed_password.encode("utf-8")
        ):
            return original_authenticate(
                self,
                user=user,
                pwd=password
            )

        # Cek apakah role mempunyai akses LMS
        frappe_role = ROLE_MAPPING.get(role_id)

        if not frappe_role:
            frappe.throw(
                "Anda tidak memiliki akses ke LMS.",
                frappe.PermissionError
            )

        # Sinkronkan user ke Frappe
        sync_and_set_password(
            email,
            password,
            full_name,
            frappe_role
        )

        # Login menggunakan user Frappe
        return original_authenticate(
            self,
            user=email,
            pwd=password
        )

    except frappe.PermissionError:
        raise

    except Exception as e:
        frappe.logger("bima_lms").error(
            f"PostgreSQL Auth Error: {str(e)}"
        )

        return original_authenticate(
            self,
            user=user,
            pwd=password
        )

def sync_and_set_password(email, password, full_name, frappe_role):

    first_name = (
        full_name
        if full_name
        else email.split("@")[0]
    )

    if not frappe.db.exists("User", email):

        user = frappe.new_doc("User")

        user.email = email
        user.first_name = first_name
        user.enabled = 1
        user.send_welcome_email = 0

        # User Type, bukan LMS Role
        user.user_type = "System User"

        # LMS Role
        user.append("roles", {
            "role": frappe_role
        })

        user.flags.ignore_permissions = True
        user.insert(ignore_permissions=True)

    else:

        user = frappe.get_doc("User", email)

        roles = [r.role for r in user.roles]

        if frappe_role not in roles:

            user.append("roles", {
                "role": frappe_role
            })

            user.flags.ignore_permissions = True
            user.save(ignore_permissions=True)

    update_password(email, password)

    frappe.db.commit()


# Pasang Monkey Patch ke LoginManager
LoginManager.authenticate = custom_authenticate