frappe.pages['courses-dashboard'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Courses',
		single_column: true
	});
}