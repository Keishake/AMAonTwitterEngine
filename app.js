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
  , routes = require('./routes')
  , http = require('http')
  , _ = require('underscore')
  , twitter = require('ntwitter')
  , passport = require('passport')
  , TwitterStrategy = require('passport-twitter').Strategy
  , path = require('path');

var common = require('./common');
var config = common.config();

var app = express()
  , server = require('http').createServer(app)
  , io = require('socket.io').listen(server);
var RedisStore = require('socket.io/lib/stores/redis');
opts = {host:config.redis, port:6379};
io.set('store', new RedisStore({redisPub:opts, redisSub:opts, redisClient:opts}));
 
var SessionStore = require('session-mongoose')(express)

var redis = require('redis');
var pub = redis.createClient("6379",config.redis);
var sub = redis.createClient("6379",config.redis);
sub.subscribe('Pub');

var TWITTER_CONSUMER_KEY = config.twitter_consumer_key;
var TWITTER_CONSUMER_SECRET = config.twitter_secret;
// Passport sessionのセットアップ
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

// PassportでTwitterStrategyを使うための設定
passport.use(new TwitterStrategy({
  consumerKey: TWITTER_CONSUMER_KEY,
  consumerSecret: TWITTER_CONSUMER_SECRET,
  callbackURL: "http://"+config.host+"/auth/twitter/callback"
},
function(token, tokenSecret, profile, done) {
    profile.twitter_token = token;
    profile.twitter_token_secret = tokenSecret;

    process.nextTick(function () {
      return done(null, profile);
    });
  }
));

/**
 *
 *  MongoDB model
 *
 */
var mongoose = require('mongoose');
mongoose.connect(config.mongo, config.mongo_options);
var Post = require('./models/posts');
var Reply = require('./models/replies');

/**
 *
 *  Express Config
 *
 */
// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser());
//app.use(express.session({secret: "_asktokyo2014_ErjM0Kkv9BavM9NHNjv"}));
// セッションストアを設定
app.use(express.session({
  secret: '_asktokyo2014_ErjM0Kkv9BavM9NHNjv',
  store: new SessionStore({
    url: config.session_host,
    connection: mongoose.connection,
    interval: 7 * 24 * 60 * 60 * 1000 // Interval in seconds to clear expired sessions. 1week
  }),
  cookie: {
    httpOnly: false,
    // 60 * 60 * 1000 = 3600000 msec = 1 hour
    maxAge: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  }
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  debug(true);
});

app.configure('staging', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  debug(true);
});

app.configure('production', function(){
  app.use(express.errorHandler());
  debug(false);
});

server.listen(config.port);

/**
 *
 *  routing
 *
 */

app.get('/', function (req, res) {
  res.render('index', {
    socketio_url: config.socketio_url,
    from: req.query.from,
    max_tweet_length: 100
  });
});

app.get('/api/fetch_hash_tweets', function (req, res) {
  var limit = req.query.limit;
  var from_id = req.query.from_id;
  if(!limit){limit = 20;}
  if(limit > 100){limit = 100;}
  if(limit < 0 ){limit = 1;}
  var query = Post.find({});
  if(from_id){
    query.where('_id').lt(from_id);
  }
  query.sort({ created_at: -1 }).limit(limit).exec('find', function(err, docs){
    if(err){
      console.log(err);
      res.json({
        from_id: null,
        to_id: null,
        tweets:[]
      });
      return;
    }
    if(docs.length > 0){
      var tweets = _.map(docs, create_hash);
      res.json({
        from_id: _.first(docs)._id,
        to_id: _.last(docs)._id,
        tweets: tweets
      });
    }else{
      res.json({
        from_id: null,
        to_id: null,
        tweets:[]
      });
    }
  });
});

app.get('/api/answers', function (req, res) {
  Reply.find({}).sort({ updated_at : -1 }).skip(0).exec('find', function(err, replies){
    var tweets = [];
    for(var i = 0; i < replies.length; i++){
      var answers = _.map(replies[i].posts, create_hash);
      tweets.push({
        q_id_str: replies[i].q_id_str,
        a_user_id_str: replies[i].a_user_id_str,
        a_user_name: replies[i].a_user_name,
        question: replies[i].question,
        created_at: replies[i].created_at,
        updated_at: replies[i].updated_at,
        answers: answers
      });
    }
    res.json({tweets: tweets});
  });
});

// Twitterの認証
app.get("/auth/twitter", passport.authenticate('twitter'));

// Twitterからのcallback
app.get("/auth/twitter/callback", passport.authenticate('twitter', {
  successRedirect: '/tweet',
  failureRedirect: '/'
}));

// タイムラインへ投稿
app.post('/tweet', function(req,res){
  var text = req.body.text;
  text += " " + config.twitter_add_hashtag + " " + config.twitter_add_url;
  console.log('text', text);
  // TODO: text validation
  if(!req.user){
    // 認証ページへ
    console.log('a');
    req.session.text = text;
    res.redirect('/auth/twitter');
    return true;
  }else if(!req.user.twitter_token && !req.user.twitter_token_secret){
    console.log('b');
    // 認証ページへ
    req.session.text = text;
    res.redirect('/auth/twitter');
    return true;
  }
  var twit = new twitter({
    consumer_key: TWITTER_CONSUMER_KEY,
    consumer_secret: TWITTER_CONSUMER_SECRET,
    access_token_key: req.user.twitter_token,
    access_token_secret: req.user.twitter_token_secret
  });
  twit.post( "https://api.twitter.com/1.1/statuses/update.json",
            {
              status : text
            },
            function(err, data){
              if(err){
                console.log(err.data);
                res.send({stat: 'error'});
                return;
              }
              var post = new Post(data);
              post.created_at = new Date();
              post.save( function(err) {
                if (err) consoleHolder.error(err);
              });
              var json_data = {
                username:data.user.screen_name,
                icon:data.user.profile_image_url,
                text:data.text,
                id_str:data.id_str,
                mongo_id: post._id,
                created_at: new Date()
              }
              var pub_data = {type : 'stream', data : json_data};
              pub.publish('Pub', JSON.stringify(pub_data));
              res.send({stat: 'success'});
            });
});

// タイムラインへ投稿(認証画面からのリダイレクト)
app.get('/tweet', function(req,res){
  console.log('get');
  var text = req.session.text;
  // TODO: validation
  if(!req.user && !req.user.twitter_token && !req.user.twitter_token_secret){
    // 認証ページへ
    req.session.text = text;
    res.redirect('/auth/twitter');
    return true;
  }
  var twit = new twitter({
    consumer_key: TWITTER_CONSUMER_KEY,
    consumer_secret: TWITTER_CONSUMER_SECRET,
    access_token_key: req.user.twitter_token,
    access_token_secret: req.user.twitter_token_secret
  });
  twit.post( "https://api.twitter.com/1.1/statuses/update.json",
            {
              status : text
            },
            function(err, data){
              if(err){
                console.log(err.data);
                res.redirect('/');
                return;
              }
              var post = new Post(data);
              post.created_at = new Date();
              post.save( function(err) {
                if (err) consoleHolder.error(err);
              });
              var json_data = {
                username:data.user.screen_name,
                icon:data.user.profile_image_url,
                text:data.text,
                id_str:data.id_str,
                mongo_id: post._id,
                created_at: new Date()
              }
              var pub_data = {type : 'stream', data : json_data};
              pub.publish('Pub', JSON.stringify(pub_data));
              res.redirect('/?from=twitter');
            });
});

/**
 *  for debug
 */

app.get('/api/fetch_hash_tweets_test', function (req, res) {
  var limit = req.query.limit;
  if(!limit){limit = 20;}
  if(limit > 100){limit = 100;}
  if(limit < 0 ){limit = 1;}
  var dammy = [];
  for(var i = 0; i < limit; i++ ){
    dammy.push({
        screen_name:'tsuda',
        id_str:'1234565544556654323',
        text:'ほげほげー！！',
        profile_image_url:'http://twitter.com/image/hogehoge.png',
        created_at:'Sun Jan 19 15:32:30 +0000 2014'
      });
  }
  res.json({
    from_id: 'hoge',
    to_id: 'hoge',
    tweets: dammy
  });
});

app.get('/api/answers_test', function (req, res) {
  var dammy = [];
  for(var i = 0; i < 30; i++ ){
    dammy.push({
      'q_id_str':'123456789',
      'a_user_id_str':'21229837123343',
      'a_user_name':'toshio_tamogami',
      'created_at':'2014-01-22T16:14:31.141Z',
      'updated_at':'2014-01-22T16:14:31.141Z',
      'dialogs':[
          {
              'screen_name':'tsuda',
              'id_str':'1234565544556654323',
              'text':'ほげほげー！！',
              'profile_image_url':'http://twitter.com/image/hogehoge.png',
              'created_at':'Sun Jan 19 15:32:30 +0000 2014'
          },
          {
              'screen_name':'tsuda',
              'id_str':'1234565544556654323',
              'text':'ほげほげー！！',
              'profile_image_url':'http://twitter.com/image/hogehoge.png',
              'created_at':'Sun Jan 19 15:32:30 +0000 2014'
          },
      ]
    });
  }
  res.json({
    tweets: dammy
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
    'websocket'
  , 'flashsocket'
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
    console.log(message.data);
    if(type == 'stream'){
      socket.emit('tweet', {message: JSON.stringify(message.data)});
    }else if(type == 'rep'){
      socket.emit('answer', {message: JSON.stringify(message.data)});
      console.log('emit answer');
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
