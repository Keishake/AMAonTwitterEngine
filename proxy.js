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
  , request = require('request')
  , ntwitter = require('immortal-ntwitter')
  , util = require('util')
  , http = require('http')
  , _ = require('underscore')
  , routes = require('./routes');

var common = require('./common');
var config = common.config();


/**
 *  @utsunomiyakenji  宇都宮けんじ : 914304680
 *  @MasuzoeYoichi 舛添要一 :  153717550
 *  @toshio_tamogami 田母神俊雄 : 102388128
 *  @morihirotokyo 細川護煕 : 2291282737
 *  @hbkr 家入一真 : 12392332
 *
 *  @AskTokyo2014 : 2311332774
 *
 *  @shakezoomer : 220981536
 *
 *  テスト用アカウント
 *  @shakeshaketest : 2148215468 // 公式アカウントとする
 *  @testtest1111 : 1525225614  // 一般ユーザーとする
 *  @testtest2222 : 1525274156  // 候補者とする
 *  @testtest3333 : 1525299727  // 候補者とする
 *  @testtest4444 : 1525296428  // 候補者とする
 */

var tweet_list = [];
var redis = require('redis');
var app = express()
  , server = http.createServer(app)
  , io = require('socket.io').listen(server);
var HASH_TAG = config.twitter_tracking_hashtag;
var utsunomiya = "914304680",
    masuzoe = "153717550",
    hosokawa = "2291282737",
    ieiri = "12392332",
    tamogami = "102388128";
var testtest1111 = "1525225614";
var testtest2222 = "1525274156";
var testtest3333 = "1525299727";
var testtest4444 = "1525296428";

var USER_IDS = utsunomiya + "," + masuzoe + "," + tamogami+ "," + hosokawa + "," + ieiri;
var USER_ARRAY = [utsunomiya, masuzoe, tamogami, hosokawa, ieiri];

// test
//var USER_IDS = testtest2222 + "," + testtest3333 + "," + testtest4444;
//var USER_ARRAY = [testtest2222, testtest3333, testtest4444];

var AskTokyo2014 = "2311332774"; // 本物
//var AskTokyo2014 = "220981536"; // shakezoomer
//var AskTokyo2014 = "2148215468"; // shakeshaketest
USER_IDS += "," + AskTokyo2014;
//USER_ARRAY.push(AskTokyo2014); // デバッグ用

var pub = redis.createClient("6379",config.redis);

var mongoose = require('mongoose');
mongoose.connect(config.mongo, config.mongo_options);
var Post = require('./models/posts');
var Reply = require('./models/replies');
var Retweet = require('./models/retweet');

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.enable('jsonp callback');
app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  debug(true);
});

app.configure('production', function(){
  app.use(express.errorHandler());
  debug(false);
});

process.on('uncaughtException', function (err) {
    consoleHolder.log('uncaughtException => ' + err.stack);
});


var twit = ntwitter.create({
      consumer_key:         config.twitter_consumer_key,
      consumer_secret:      config.twitter_secret,
      access_token_key:     config.twitter_access_token,
      access_token_secret:  config.twitter_access_secret
    });

twit.immortalStream('statuses/filter', {track: HASH_TAG, follow: USER_IDS, replies:'all'}, function(immortalStream) {
    immortalStream.on('data', function(data){
      if(!data){ return true}
      if(!data.user){ return true}
      if(!_.contains(USER_ARRAY, data.user.id_str)){
        if(data.entities.hashtags.length == 0){
          return true;
        }
        for(var i=0; i<data.entities.hashtags.length; i++){
          if(data.entities.hashtags[i].text == config.raw_hashtag){
            // 候補者のツイート以外をDBに保存
            console.log('have hashtag');
            if(data.source.indexOf(config.tweet_source) == -1){
              console.log('souce is other ');
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
            }
          }
        }
      }
      if(data.in_reply_to_status_id_str){
        // リプライあり
        //if(_.contains(USER_ARRAY, data.in_reply_to_user_id_str)){
        //  // 候補者へのリプライ
        //  make_replies(data);
        //} 
        if(_.contains(USER_ARRAY, data.user.id_str)){
          // 候補者からのリプライ
          make_replies(data);
          console.log("reply!!!!!!");
        }
      }
      if(data.user.id_str == AskTokyo2014){
        // 運営アカウントのツイート
        console.log(data);
        console.log("RT!!!!!!!");
        if(data.retweeted_status){
          // 運営アカウントのリツイート
          var retweet = new Retweet(data.retweeted_status);
          retweet.created_at = new Date();
          retweet.save( function(err) {
            if (err) consoleHolder.error(err);
          });
          var json_data = {
            screen_name: retweet.user.screen_name,
            profile_image_url: retweet.user.profile_image_url,
            text: retweet.text,
            id_str: retweet.id_str,
            mongo_id: retweet._id,
            created_at: new Date()
          }
          var pub_data = {type : 'retweet', data : json_data};
          pub.publish('Pub', JSON.stringify(pub_data));
         // if(data.retweeted_status.in_reply_to_status_id_str){
         //   // 誰かへのリプライをリツイート
         //   var reply_id = data.retweeted_status.in_reply_to_status_id_str;
         //   Reply.findOne({}).elemMatch( 'posts', { id_str: reply_id}).exec(function(err, rep){
         //     if(err){
         //       consoleHolder.error(err);
         //       return err;
         //     }
         //     //rep.posts.push()
         //   });
         // }
        }
      }
    });
});


function make_replies(post){
  var rep_id = post.in_reply_to_status_id_str;
  console.log('rep_id', rep_id);
  Reply.findOne({'q_id_str': rep_id, 'a_user_id_str' : post.user.id_str}, function(err, rep){
    if(err){
      consoleHolder.error(err);
      return err;
    }
  //  console.log("Reply data",rep)
    if(rep){
      // 既に保存されている会話に追加
      console.log("have reply data");
      rep.posts.push(post);
      rep.updated_at = new Date();
      rep.save(function(err){
        if (err) consoleHolder.error(err);
      });
      var answers = [];
      for(var i=0; i<rep.posts.length; i++){
        answers.push(create_hash(rep.posts[i]));
      }
      var json = {
        type : 'rep',
        data : {
          q_id_str: rep.q_id_str,
          a_user_id_str: post.user.id_str,
          question : rep.question,
          answers: answers,
          created_at: rep.created_at,
          updated_at: rep.updated_at
        }
      };
      pub.publish('Pub', JSON.stringify(json));
    }else{
      Retweet.findOne({'id_str' : rep_id}, function (err, tweet) {
        if(err){
          consoleHolder.error(err);
          return err;
        }
      //  console.log("Post data", tweet)
        if(tweet){
          // Postに保存されているものに対して返事
          console.log('have Post data');
          var reply = new Reply();
          reply.posts.push(post);
          reply.q_id_str = tweet.id_str;
          reply.a_user_id_str = post.user.id_str;
          reply.a_user_name = post.user.screen_name;
          reply.question.screen_name = tweet.user.screen_name;
          reply.question.id_str = tweet.id_str;
          reply.question.text = tweet.text;
          reply.question.profile_image_url = tweet.user.profile_image_url;
          reply.question.created_at = tweet.created_at;
          reply.created_at = new Date();
          reply.updated_at = new Date();
          reply.save( function(err) {
            if (err) console.error(err);
          });
          var question = create_hash(tweet);
          var answers = [create_hash(post)];
          var json = {
            type : 'rep',
            data : {
              q_id_str: tweet.id_str,
              a_user_id_str: post.user.id_str,
              question: question,
              answers: answers,
              created_at: reply.created_at
            }
          }
          pub.publish('Pub', JSON.stringify(json));
        }else{
          console.log('no data');
        }
      });

    }
  });

}

function create_hash(data){
  var res = {
    screen_name: data.user.screen_name,
    id_str: data.id_str,
    in_reply_to_status_id_str: data.in_reply_to_status_id_str,
    text: data.text,
    profile_image_url: data.user.profile_image_url,
    created_at: data.created_at
  };
  return res;
}

server.listen(config.proxy_port);
