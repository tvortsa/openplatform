const Fs = require('fs');

NEWSCHEMA('Settings', function(schema) {

	schema.define('url', 'String(500)', true);
	schema.define('email', 'Email', true);
	schema.define('colorscheme', 'Lower(7)');
	schema.define('background', 'String(150)');
	schema.define('accesstoken', 'String(50)', true);
	schema.define('smtp', 'String(100)');
	schema.define('smtpsettings', 'JSON');

	schema.setGet(function($) {

		if (!$.user.sa) {
			$.invalid('error-permissions');
			return;
		}

		FUNC.settings.get(function(err, response) {
			var model = $.model;
			var options = response.smtpsettings;
			model.accesstoken = response.accesstoken;
			model.url = response.url;
			model.colorscheme = response.colorscheme;
			model.background = response.background;
			model.email = response.email;
			model.smtp = response.smtp;
			model.smtpsettings = typeof(options) === 'string' ? options : JSON.stringify(options);
			OP.id = response.url.crc32(true);
			$.callback();
		});
	});

	schema.setSave(function($) {

		if (!$.user.sa) {
			$.error.push('error-permissions');
			return $.callback();
		}

		var model = model.$clean();

		FUNC.settings.save(model, function() {

			FUNC.emit('settings.update', F.id);

			if (model.url.endsWith('/'))
				model.url = model.url.substring(0, model.url.length - 1);

			// Removing older background
			if (CONF.background && model.background !== CONF.background) {
				var path = 'backgrounds/' + CONF.background;
				Fs.unlink(F.path.public(path), NOOP);
				F.touch('/' + path);
			}

			CONF.url = model.url;
			CONF.email = model.email;
			CONF.colorscheme = model.colorscheme;
			CONF.background = model.background;
			CONF.mail_smtp = model.smtp;
			CONF.mail_smtp_options = model.smtpsettings.parseJSON();
			CONF.accesstoken = model.accesstoken;

			OP.id = CONF.url.crc32(true);

			$.success();
			FUNC.logger('settings', 'update: ' + JSON.stringify(model.$clean()), '@' + $.user.name, $.ip);
		});

	});

	schema.addWorkflow('init', function($) {

		FUNC.settings.get(function(response) {

			if (response) {
				CONF.url = response.url || '';
				CONF.author = response.author || '';
				CONF.email = response.email || '';
				CONF.accesstoken = response.accesstoken || '';
				CONF.colorscheme = response.colorscheme || '';
				CONF.background = response.background || '';
				CONF.mail_smtp = response.smtp || '';
				CONF.mail_smtp_options = typeof(response.smtpsettings) === 'string' ? response.smtpsettings.parseJSON() : response.smtpsettings;
				OP.id = CONF.url.crc32(true);
			}

			$.success(true);
		});
	});
});

NEWSCHEMA('SettingsSMTP').make(function(schema) {

	schema.define('smtp', 'String(100)', true);
	schema.define('smtpsettings', 'JSON');

	schema.addWorkflow('exec', function($) {

		if (!$.user.sa) {
			$.invalid('error-permissions');
			return;
		}

		var model = $.model;
		var options = model.smtpsettings.parseJSON();

		Mail.try(model.smtp, options, function(err) {

			if (err) {
				$.error.push('error-settings-smtp');
				$.error.replace('@', err.toString());
			}

			$.success();
		});
	});
});