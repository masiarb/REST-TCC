/* 
* Server for Cloud TCC
* Extended with database support (MongoDB & Mongoose)
* @author Masiar Babazadeh 
* babazadm@usi.ch
*/

var express  = require('express'),
	http = require ('http'),
	XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest,
	querystring = require('querystring'),
	parse = require('url').parse;
	

//FOR HTTPS (TODO later)
//var app = require('express').createServer({ key: ... });

var app = express.createServer();
app.use(express.logger());
app.use(express.cookieParser());
app.use(express.session({ 
	secret: 'keyboard cat',
	maxAge : new Date(Date.now() + 3600000), //1 hour
}));

//setup of the ports & cookie
var PORT = process.argv[2] ? parseInt(process.argv[2]) : 3000;
var ITEM_PORT = 3010;
var cookie;

//Handles post requests
app.use(require('connect').bodyParser());
//Handles put requests
app.use(express.methodOverride());

app.listen(PORT);

/*
* GET base page, login or register
*/
app.get('/', function(req, res){
	var options = {
		host: 'cloudservertest.nodester.com',
		port: 80,
		path: '/',
		method: 'GET'
	};
	
	var req = http.request(options, function(res){
		console.log('status: ' + res.statusCode);
		console.log('headers: ' + JSON.stringify(res.headers));
		res.setEncoding('utf8');
		res.on('data', function(chunk){
			console.log("body: " + chunk);
		});
	});
	
	req.on('error', function(e) {
		console.log('problem with request: ' + e.message);
	});

	// write data to request body
	req.write('data\n');
	req.write('data\n');
	req.end();
});

/*
* Function to login on cloudserver
*/
var login = function() {
	var data = querystring.stringify({
			username: 'm',
			password: 'm',
		});

	var options = {
	    host: 'grid.inf.unisi.ch',
	    port: 3000,
	    path: '/login',
	    method: 'POST',
	    headers: {
	        'Content-Type': 'application/x-www-form-urlencoded',
	        'Content-Length': data.length
	    }
	};

	var req = http.request(options, function(res) {
		console.log('status: ' + res.statusCode);
		console.log('cookie: ' + JSON.stringify(res.headers["set-cookie"][0]));
		cookie = res.headers["set-cookie"][0];
		res.setEncoding('utf8');
		res.on('data', function (chunk) {
			//after login, do some orders 
			
			//XXX: JUST TESTING
			doOrder(1);
			
		});
	});
	
	req.on('error', function(e) {
		console.log('problem with request: ' + e.message);
	});

	req.write(data);
	req.end();
}

/*
* Function to do some orders
*/
var doOrders = function() {
	//call many times doOrder with different ids?
}

/*
* Function to place one single order on one single object
*/
var doOrder = function(item_id){
	var options = {
	    host: 'grid.inf.unisi.ch',
	    port: ITEM_PORT,
	    path: '/item/' + item_id,
	    method: 'POST',
	    headers: {
	        'cookie' : cookie,
			'accept' : 'application/json+tcc',
	    }
	};

	var req = http.request(options, function(res) {
		res.setEncoding('utf8');
		res.on('data', function (chunk) {
			//have to check if the headers contain 'Link' and 'XTCC'
			if(res.headers["link"] && res.headers["link"].indexOf("XTCC") != -1){
				console.log("has a link, link is for TCC");
				//parse url
				var str = res.headers["link"].substr(0, res.headers["link"].indexOf(">"));
				str = str.substring(1, str.length);
				console.log("PARSED URL: " + str);
				if(res.headers["deadline"] == undefined){
					//deadline undefined, get more info through the link
					getInfoForItem(str);
				}
			}
		});
	});
	
	req.on('error', function(e) {
		console.log('problem with request: ' + e.message);
	});

	req.write('data\n');
	req.write('data\n');
	req.end();
}

/*
* Function to get more info from the reserved item
*/
var getInfoForItem = function(uri) {
	//parse data from uri to fill options variable
	var data = parse(uri);
	
	var options = {
	  	host: data.hostname,
	    port: data.port,
	    path: data.path,
		headers: {
			'cookie' : cookie,
			'accept' : 'application/json',
		}
	};

	http.get(options, function(res) {
		console.log("Got response: " + res.statusCode);
		res.setEncoding('utf8');
		res.on('data', function(chunk){
			chunk = JSON.parse(chunk);
			//store data and/or send it directly to CloudServer
			var receivedData = {
				confirmationLink: chunk.uri,
				deadline: chunk.deadline,
				title: chunk.title,
				uniqueIdTx : chunk.uniqueIdTx,
			};
			
			sendDataToCloud(receivedData);
		});
	}).on('error', function(e) {
		console.log("Got error: " + e.message);
	});
}

/*
* Function to send data of a single reservation order
* to the CloudServer.
*/
var sendDataToCloud = function(receivedData){
	var data = querystring.stringify(receivedData);
	//setup the options
	var options = {
	    host: 'grid.inf.unisi.ch',
	    port: 3000,
	    path: '/addTransaction',
	    method: 'POST',
	    headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Content-Length': data.length,
	        'cookie' : cookie,
	    }
	};
	
	var req = http.request(options, function(res) {
		res.setEncoding('utf8');
		res.on('data', function (chunk) {
			console.log(chunk);
			deleteTransaction(receivedData.uniqueIdTx);
		});
	});
	
	req.on('error', function(e) {
		console.log('problem with request: ' + e.message);
	});

	req.write(data);
	req.end();
}

/*
* Function to confirm all of what we have
*/
var confirm = function() {
	var options = {
	    host: 'grid.inf.unisi.ch',
	    port: 3000,
	    path: '/tx/confirm',
	    method: 'PUT',
	    headers: {
			'cookie' : cookie,
	    }
	};
	
	var req = http.request(options, function(res) {
		res.setEncoding('utf8');
		res.on('data', function (chunk) {
			console.log(chunk);
		});
	});
	
	req.on('error', function(e) {
		console.log('problem with request: ' + e.message);
	});

	req.write('data\n');
	req.write('data\n');
	req.end();
}

/*
* Function to delete something
*/
var deleteTransaction = function(item_id){
	var options = {
	    host: 'grid.inf.unisi.ch',
	    port: 3000,
	    path: '/tx/delete/' + item_id,
	    method: 'DELETE',
	    headers: {
			'cookie' : cookie,
	    }
	};
	
	var req = http.request(options, function(res) {
		res.setEncoding('utf8');
		res.on('data', function (chunk) {
			console.log(chunk);
		});
	});
	
	req.on('error', function(e) {
		console.log('problem with request: ' + e.message);
	});

	req.write('data\n');
	req.write('data\n');
	req.end();
}

/*
* Test code to run the code as soon as the server is started
*/
login();
