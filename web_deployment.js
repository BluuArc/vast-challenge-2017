var express = require('express'),
    app = express();

var argv = require('yargs')
    .usage('Usage: $0 -p [integer] -i [string of IP address]')
    .default("p", 80)
    .default("i", '127.0.0.1')
    .alias('p', 'port')
    .alias('i', 'ip').alias('i', 'ip-address')
    .describe('p', 'Port to run server on')
    .describe('i', 'IP Address to run server on')
    .help('h')
    .alias('h', 'help')
    .argv;

app.use(express.static(__dirname));

var server = app.listen(argv.port,argv.ip,function(){
    console.log("Listening on " + this.address().address + ":" + this.address().port);
});