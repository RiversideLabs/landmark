/**
 * Configures and starts a Landmark app in encapsulated mode.
 *
 * Connects to the database, runs updates and listens for incoming requests.
 *
 * Events are fired during initialisation to allow customisation, including:
 *
 *   - onMount
 *   - onStart
 *   - onHttpServerCreated
 *   - onHttpsServerCreated
 *
 * If the events argument is a function, it is assumed to be the started event.
 *
 *
 * ####Options:
 *
 * Landmark supports the following options specifically for running in encapsulated mode:
 *
 *   - name
 *   - port
 *   - views
 *   - view engine
 *   - compress
 *   - favico
 *   - less
 *   - static
 *   - headless
 *   - logger
 *   - cookie secret
 *   - session
 *   - 404
 *   - 500
 *   - routes
 *   - locals
 *   - auto update
 *   - ssl
 *   - sslport
 *   - sslkey
 *   - sslcert
 *
 *
 * @api public
 */

var fs = require('fs'),
	http = require('http'),
	https = require('https');

var dashes = '\n------------------------------------------------\n';

function start(events) {
	
	// Validate arguments
	
	if ('function' === typeof events) {
		events = { onStart: events };
	}
	
	if (!events) events = {};
	
	// Ensure Landmark has been initialised
	
	if (!this.app) {
		throw new Error('LandmarkJS Initialization Error:\n\napp must be initialized. Call landmark.init() or landmark.connect(new Express()) first.\n\n');
	}
	
	// Localise references to this for closures
	
	var landmark = this,
		app = this.app;
		
	// Maintain passed in onMount binding but override to start http servers
	// (call user-defined onMount first if present)
	
	var onMount = events.onMount;
	
	events.onMount = function() {
		
		onMount && onMount();
		
		var startupMessages = ['LandmarkJS Started:'],
			waitForServers = 2;
			
		// Log the startup messages and calls the onStart method
		
		var serverStarted = function() {
			waitForServers--;
			if (waitForServers) return;
			if (landmark.get('logger')) {
				console.log(dashes + startupMessages.join('\n') + dashes);
			}
			events.onStart && events.onStart();
		};
		
		// Create the http server and listens to the specified port and host or listen option.
		//
		// For more information on how these options work, see
		// http://nodejs.org/api/http.html#http_server_listen_port_hostname_backlog_callback
		// and for history, see https://github.com/JedWatson/landmark/issues/154
		
		landmark.httpServer = http.createServer(app);
		events.onHttpServerCreated && events.onHttpServerCreated();
		
		var host = landmark.get('host'),
			port = landmark.get('port'),
			listen = landmark.get('listen'),
			ssl = landmark.get('ssl');
			
		// start the http server unless we're in ssl-only mode
		
		if (ssl !== 'only') {
			
			var httpStarted = function(msg) {
				return function() {
					startupMessages.push(msg);
					serverStarted();
				};
			};
				
			if (port || port === 0) {
				
				app.set('port', port);
				
				var httpReadyMsg = landmark.get('name') + ' is ready';
				
				if (host) {
					httpReadyMsg += ' on http://' + host;
					if (port) {
						httpReadyMsg += ':' + port;
					}
					// start listening on the specified host and port
					landmark.httpServer.listen(port, host, httpStarted(httpReadyMsg));
				} else {
					if (port) {
						httpReadyMsg += ' on port ' + port;
					}
					// start listening on any IPv4 address (INADDR_ANY) and the specified port
					landmark.httpServer.listen(port, httpStarted(httpReadyMsg));
				}
				
			} else if (host) {
				// start listening on a specific host address and default port 3000
				app.set('port', 3000);
				landmark.httpServer.listen(3000, host, httpStarted(landmark.get('name') + ' is ready on ' + host + ':3000'));
			} else if (listen) {
				// start listening to a unix socket
				landmark.httpServer.listen(listen, httpStarted(landmark.get('name') + ' is ready' + (('string' === typeof listen) ? ' on ' + listen : '')));
			} else {
				// default: start listening on any IPv4 address (INADDR_ANY) and default port 3000
				app.set('port', 3000);
				landmark.httpServer.listen(3000, httpStarted(landmark.get('name') + ' is ready on default port 3000'));
			}
			
		} else {
			waitForServers--;
		}
		
		// start the ssl server if configured
		
		if (ssl) {
			
			var sslOpts = {};
			
			if (landmark.get('ssl cert') && fs.existsSync(landmark.getPath('ssl cert'))) {
				sslOpts.cert = fs.readFileSync(landmark.getPath('ssl cert'));
			}
			if (landmark.get('ssl key') && fs.existsSync(landmark.getPath('ssl key'))) {
				sslOpts.key = fs.readFileSync(landmark.getPath('ssl key'));
			}
			
			if (!sslOpts.key || !sslOpts.cert) {
				
				if (ssl === 'only') {
					console.log(landmark.get('name') + ' failed to start: invalid ssl configuration');
					process.exit();
				} else {
					startupMessages.push('Warning: Invalid SSL Configuration');
					serverStarted();
				}
				
			} else {
				
				var httpsStarted = function(msg) {
					return function() {
						startupMessages.push(msg);
						serverStarted();
						};
					};
					
				landmark.httpsServer = https.createServer(sslOpts, app);
				events.onHttpsServerCreated && events.onHttpsServerCreated();
				
				var sslHost = landmark.get('ssl host') || host,
					sslPort = landmark.get('ssl port') || 3001;
					
				var httpsReadyMsg = (ssl === 'only') ? landmark.get('name') + ' (SSL) is ready on ' : 'SSL Server is ready on ';
				
				if (sslHost) {
					landmark.httpsServer.listen(sslPort, sslHost, httpsStarted(httpsReadyMsg + 'https://' + sslHost + ':' + sslPort));
				} else {
					var httpsPortMsg = (landmark.get('ssl port')) ? 'port: ' + landmark.get('ssl port') : 'default port 3001';
					landmark.httpsServer.listen(sslPort, httpsStarted(httpsReadyMsg + httpsPortMsg));
				}
				
			}
			
		} else {
			waitForServers--;
		}
		
		process.on('uncaughtException', function(e) {
			if (e.code === 'EADDRINUSE') {
				console.log(dashes +
					landmark.get('name') + ' failed to start: address already in use\n' +
					'Please check you are not already running a server on the specified port.\n');
				process.exit();
			}/* else if (e.code === 'ECONNRESET') {
				// Connection reset by peer, ignore it instead of exiting server with a throw.
				// Disabled for release 0.2.16 while further research is being done.
				console.log('Connection reset by peer');
				console.log(e);
			} */else {
				console.log(e.stack || e);
				process.exit(1);
			}
		});
		
	};
	
	//mount the express app
	this.mount(events);
	
	return this;
	
}

module.exports = start;
