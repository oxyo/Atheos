/*
	*  Copyright (c) atheos & Kent Safranski (atheos.com), distributed
	*  as-is and without warranty under the MIT License. See
	*  [root]/license.txt for more. This information must remain intact.
	*/

(function(global, $) {
	'use strict';
	var user = null;

	var atheos = global.atheos,
		ajax = global.ajax,
		amplify = global.amplify,
		i18n = global.i18n,
		oX = global.onyx;


	amplify.subscribe('atheos.loaded', () => atheos.user.init());


	atheos.user = {

		loginForm: oX('#login'),
		controller: 'components/user/controller.php',
		dialog: 'components/user/dialog.php',

		//////////////////////////////////////////////////////////////////
		// Initilization
		//////////////////////////////////////////////////////////////////

		init: function() {
			user = this;

			if (user.loginForm) {
				user.loginForm.on('submit', function(e) {
					e.preventDefault();
					// Save Language
					atheos.storage('language', oX('#language').value());
					// Save Theme
					atheos.storage('theme', oX('#theme').value());
					user.authenticate();
				});


				// Get Theme
				var theme = atheos.storage('theme');
				var select = oX('#theme');
				if (select && select.find('option') > 1) {
					select.find('option').forEach(function(option) {
						if (option.value() === theme) {
							console.log('found');
							option.attr('selected', 'selected');
						}
					});
				}

				// Get Language
				var language = atheos.storage('language');
				select = oX('#language');
				if (select && select.find('option') > 1) {
					select.find('option').forEach(function(option) {
						if (option.value() === language) {
							option.attr('selected', 'selected');
						}
					});
				}

				// More Selector
				oX('#show_login_options').on('click', function(e) {
					oX(e.target).hide();
					oX('#login_options').show();
				});
			}

			amplify.subscribe('chrono.mega', function() {
				// Run controller to check session (also acts as keep-alive) & Check user
				ajax({
					url: atheos.user.controller,
					type: 'post',
					data: {
						'action': 'verify'
					},
					success: function(data) {
						data = JSON.parse(data);
						if(data.debug) {
							console.log(data.debug);
						}
						if (data.pass === 'false') {
							atheos.user.logout();
						}
					}
				});
			});

		},

		//////////////////////////////////////////////////////////////////
		// Authenticate User
		//////////////////////////////////////////////////////////////////

		authenticate: function() {
			var data = atheos.common.serializeForm(user.loginForm.el);
			data.action = 'authenticate';
			ajax({
				url: user.controller,
				type: 'post',
				data: data,
				success: function(response) {
					response = JSON.parse(response);
					if (response.status !== 'error') {
						window.location.reload();
					} else {
						atheos.toast.error(response.message);

					}
				}
			});
		},

		//////////////////////////////////////////////////////////////////
		// Logout
		//////////////////////////////////////////////////////////////////

		logout: function() {
			var forcelogout = true;
			var unsaved = oX('#list-active-files').find('li.changed');
			if (unsaved.length > 0) {
				forcelogout = confirm(i18n('You have unsaved files.'));
			}
			if (forcelogout) {
				unsaved.forEach(function(changed) {
					changed.removeClass('changed');
				});

				amplify.publish('user.logout');
				atheos.settings.save();
				ajax({
					url: user.controller,
					type: 'post',
					data: {
						'action': 'logout'
					},
					success: function() {
						window.location.reload();
					}
				});
			}
		},

		//////////////////////////////////////////////////////////////////
		// Open the user manager dialog
		//////////////////////////////////////////////////////////////////
		list: function() {
			atheos.modal.load(400, this.dialog + '?action=list');
		},

		//////////////////////////////////////////////////////////////////
		// Create User
		//////////////////////////////////////////////////////////////////
		create: function() {
			atheos.modal.load(400, this.dialog + '?action=create');
			var listener = function(e) {
				e.preventDefault();

				var username = oX('#modal_content form input[name="username"]').value();
				var password1 = oX('#modal_content form input[name="password1"]').value();
				var password2 = oX('#modal_content form input[name="password2"]').value();

				var password = password1 === password2 ? password1 : false;

				// Check matching passwords
				if (!password) {
					atheos.toast.error(i18n('Passwords Do Not Match'));
				}

				// Check no spaces in username
				if (!/^[a-z0-9]+$/i.test(username) || username.length === 0) {
					atheos.toast.error(i18n('Username Must Be Alphanumeric String'));
					username = false;
				}
				if (password && username) {
					ajax({
						url: user.controller,
						type: 'post',
						data: {
							'action': 'create',
							'username': username,
							'password': password
						},
						success: function(data) {
							var createResponse = atheos.jsend.parse(data);
							if (createResponse !== 'error') {
								atheos.toast.success(i18n('User Account Created'));
								user.list();
							}
						}
					});
				}
			};
			atheos.modal.ready.then(function() {
				oX('#modal_content form').on('submit', listener);
			});
		},

		//////////////////////////////////////////////////////////////////
		// Delete User
		//////////////////////////////////////////////////////////////////
		delete: function(username) {
			atheos.modal.load(400, this.dialog + '?action=delete&username=' + username);

			var listener = function(e) {
				e.preventDefault();
				var username = oX('#modal-content form input[name="username"]').value();
				ajax({
					url: user.controller,
					type: 'post',
					data: {
						'action': 'delete',
						'username': username
					},
					success: function(data) {
						var deleteResponse = atheos.jsend.parse(data);
						if (deleteResponse !== 'error') {
							atheos.toast.success('Account Deleted');
							user.list();
						}
					}
				});
			};

			atheos.modal.ready.then(function() {
				oX('#modal_content form').on('submit', listener);
			});
		},

		//////////////////////////////////////////////////////////////////
		// Set Project Access
		//////////////////////////////////////////////////////////////////
		showUserACL: function(username) {
			atheos.modal.load(400, user.dialog + '?action=projects&username=' + username);

			var listener = function(e) {
				e.preventDefault();

				var data = atheos.common.serializeForm(oX('#modal_content form').el);
				data.action = 'changeUserACL';

				if (data.acl === 'false') {
					data.project = 'full';
				}
				
				// Check and make sure if access level not full that at least on project is selected
				if (data.acl === 'true' && !data.project) {
					atheos.toast.error('At Least One Project Must Be Selected');
				} else {
					ajax({
						url: user.controller,
						type: 'post',
						data: data,
						success: function(data) {
							atheos.modal.unload();
						}
					});
				}
			};

			atheos.modal.ready.then(function() {
				oX('#modal_content form').on('submit', listener);
			});
		},

		//////////////////////////////////////////////////////////////////
		// Change Password
		//////////////////////////////////////////////////////////////////

		password: function(username) {

			atheos.modal.load(400, user.dialog + '?action=password&username=' + username);

			var listener = function(e) {
				e.preventDefault();
				var username = oX('#modal_content form input[name="username"]').value();
				var password1 = oX('#modal_content form input[name="password1"]').value();
				var password2 = oX('#modal_content form input[name="password2"]').value();

				var password = password1 === password2 ? password1 : false;


				if (!password) {
					atheos.toast.error(i18n('Passwords Do Not Match'));
				} else {
					ajax({
						url: user.controller,
						type: 'post',
						data: {
							'action': 'password',
							'username': username,
							'password': password
						},
						success: function(data) {
							var passwordResponse = atheos.jsend.parse(data);
							if (passwordResponse !== 'error') {
								atheos.toast.success(i18n('Password Changed'));
								atheos.modal.unload();
							}
						}
					});
				}
			};

			atheos.modal.ready.then(function() {
				oX('#modal_content form').on('submit', listener);
			});

		},

		//////////////////////////////////////////////////////////////////
		// Change Current Project
		//////////////////////////////////////////////////////////////////

		saveActiveProject: function(project) {
			ajax({
				url: this.controller,
				type: 'post',
				data: {
					action: 'saveActiveProject',
					activeProject: project
				}
			});
		}
	};

})(this, jQuery);