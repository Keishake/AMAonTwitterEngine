var consoleHolder = console;
function debug(bool){
    if(!bool){
        consoleHolder = console;
        console = {};
        console.log = function(){};
    }else
        console = consoleHolder;
}

var express = require('express')
  , http = require('http')
  , _ = require('underscore')
  , path = require('path');

var common = require('./common');
var config = common.config();

var app = express()
  , server = require('http').createServer(app)
  , io = require('socket.io').listen(server);
var RedisStore = require('socket.io/lib/stores/redis');
opts = {host:config.redis, port:6379};
io.set('store', new RedisStore({redisPub:opts, redisSub:opts, redisClient:opts}));

var redis = require('redis');
var sub = redis.createClient("6379",config.redis);
sub.subscribe('Pub');

/**
 *
 *  MongoDB model
 *
 */
var mongoose = require('mongoose');
mongoose.connect(config.mongo, config.mongo_options);
var Post = require('./models/posts');
var Reply = require('./models/replies');
var Retweet = require('./models/retweet');

/**
 *
 *  Express Config
 *
 */
// all environments
app.set('port', process.env.PORT || 3006);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser());
app.use(express.session({secret: "_asktokyo2014_ErjM0Kkv9BavM9NHNjv"}));
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  debug(true);
});

app.configure('production', function(){
  app.use(express.errorHandler());
  debug(false);
});

server.listen(3006);

/**
 *
 *  routing
 *
 */

app.get('/', function (req, res) {
  res.render('admin', {
    socketio_url: config.socketio_url_admin,
    from: req.query.from,
    max_tweet_length: 100
  });
});

app.get('/api/fetch_hash_tweets', function (req, res) {
  var query = Retweet.find({});
  query.sort({ created_at: -1 }).exec('find', function(err, docs){
    if(err){
      console.log(err);
      res.json({
        tweets:[]
      });
      return;
    }
    if(docs.length > 0){
      var tweets = _.map(docs, create_hash);
      var tweets = _.reject(tweets, function(tweet){
        return tweet.screen_name == 'AskTokyo2014';
      });
      res.json({
        tweets: tweets
      });
    }else{
      res.json({
        tweets:[]
      });
    }
  });
});

/**
 *
 *  socket.io
 *
 */

//sub.on('message', function (channel, message) {
//  console.log('sub message' + message);
//});


io.configure('production', function(){
  io.enable('browser client etag');
  io.enable('browser client minification');
  io.enable('browser client gzip');
  io.set('log level', 1);

  io.set('transports', [
    'flashsocket'
  , 'htmlfile'
  , 'xhr-polling'
  , 'jsonp-polling'
  ]);
});

io.sockets.on('connection', function (socket) {
  sub.on('message', function (channel, message) {
    console.log('sub channel ' +channel+ ' message' + message);
    message = JSON.parse(message);
    var type = message.type;
    console.log(type);
    if(type == 'retweet'){
      socket.emit('tweet', {message: JSON.stringify(message.data)});
    }
  });

});


function create_hash(data){
  var res = {
    screen_name: data.user.screen_name,
    id_str: data.id_str,
    text: data.text,
    profile_image_url: data.user.profile_image_url,
    created_at: data.created_at
  };
  return res;
}
