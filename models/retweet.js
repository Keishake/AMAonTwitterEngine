var common = require('../common');
var config = common.config();
var mongoose = require('mongoose')
  , Schema   = mongoose.Schema;

var RetweetSchema = new Schema({
  created_at: Date,
  username: String,
  text: String,
  id_str: {type: String, index: true },
  in_reply_to_status_id_str: {type: String, index: true },
  in_reply_to_user_id_str: {type: String, index: true },
  in_reply_to_screen_name: String,
  retweet_count: Number,
  favorite_count: Number,
  favorited: Boolean,
  retweeted: Boolean,
  lang: String,
  entities: {

  },
  user: {
    id_str: {type: String, index: true },
    name: String,
    screen_name: String,
    profile_image_url: String
  }
});
mongoose.model('Retweet', RetweetSchema);

module.exports = mongoose.model('Retweet');
