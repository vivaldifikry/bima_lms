app_name = "bima_lms"
app_title = "Learning Management System"
app_publisher = "users"
app_description = "Bima LMS"
app_email = "vivaldifikry2@gmail.com"
app_license = "mit"


# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "bima_lms",
# 		"logo": "/assets/bima_lms/logo.png",
# 		"title": "Learning Management System",
# 		"route": "/bima_lms",
# 		"has_permission": "bima_lms.api.permission.has_app_permission"
# 	}
# ]

# Includes in <head>
# ------------------

# override_whitelisted_methods = {
#     "frappe.core.doctype.user.user.login": "bima_lms.auth.custom_login"
# }

# include js, css files in header of web template
# web_include_css = "/assets/bima_lms/css/bima_lms.css"
# web_include_js = "/assets/bima_lms/js/bima_lms.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "bima_lms/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "bima_lms/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "bima_lms.utils.jinja_methods",
# 	"filters": "bima_lms.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "bima_lms.install.before_install"
# after_install = "bima_lms.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "bima_lms.uninstall.before_uninstall"
# after_uninstall = "bima_lms.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "bima_lms.utils.before_app_install"
# after_app_install = "bima_lms.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "bima_lms.utils.before_app_uninstall"
# after_app_uninstall = "bima_lms.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "bima_lms.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"bima_lms.tasks.all"
# 	],
# 	"daily": [
# 		"bima_lms.tasks.daily"
# 	],
# 	"hourly": [
# 		"bima_lms.tasks.hourly"
# 	],
# 	"weekly": [
# 		"bima_lms.tasks.weekly"
# 	],
# 	"monthly": [
# 		"bima_lms.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "bima_lms.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "bima_lms.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "bima_lms.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["bima_lms.utils.before_request"]
# after_request = ["bima_lms.utils.after_request"]

# Job Events
# ----------
# before_job = ["bima_lms.utils.before_job"]
# after_job = ["bima_lms.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"bima_lms.auth.validate"
# ]

# Overriding Methods
# ------------------------------

# override_whitelisted_methods = {
#     "frappe.core.doctype.user.user.login": "bima_lms.auth.custom_login",
#     "login": "bima_lms.auth.custom_login"
# }


# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# Translation
# ------------
# List of apps whose translatable strings should be excluded from this app's translations.
# ignore_translatable_strings_from = []

