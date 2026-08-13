import frappe

def get_context(context):
    # Cek apakah user sudah login, jika belum arahkan ke halaman login
    if frappe.session.user == "Guest":
        frappe.local.flags.redirect_location = "/login"
        raise frappe.Redirect

    # Ambil data user yang sedang login
    user_doc = frappe.get_doc("User", frappe.session.user)
    
    # Ambil daftar role milik user (selain role default 'Guest' dan 'All')
    roles = [r.role for r in user_doc.roles if r.role not in ["Guest", "All"]]
    
    # Kirim variabel ke HTML (Jinja Context)
    context.full_name = user_doc.full_name
    context.email = user_doc.email
    context.user_roles = ", ".join(roles) if roles else "Standard User"
    
    return context